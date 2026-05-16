// SSE client (Plan 02-06). Bridges the server's log stream into the
// Zustand store. Maps each SSE event kind to one store mutation.
//
// Frame contract is defined by packages/server/src/app-state.ts SsePayload.
// Streamed row/progress frames drain in scheduled batches so snapshots become
// visible progressively without forcing one store write per transport frame.
//
// T-02-06-02: graceful `bye` closes the EventSource and prevents browser
// auto-reconnect storms. Before the first snapshot, transient `onerror` keeps
// connection at 'connecting'. After data has loaded, any stream error is
// user-visible as disconnected so the retry banner appears promptly.

import type { EventRow, LatencyBand, Status } from "@ahp-inspector/core";
import { useAppStore } from "../state/store.js";
import { apiUrl } from "./api-base.js";

export interface ConnectionHandle {
  close(): void;
}

interface SnapshotBeginPayload {
  meta: { filename: string; sizeBytes: number; startedAt: number; logKey?: string };
  total: number;
}
interface SnapshotChunkPayload {
  rows: EventRow[];
  from: number;
}
interface AppendPayload {
  rows: EventRow[];
  from: number;
}
interface PatchPayload {
  updates: Array<{
    idx: number;
    status: Status;
    latencyMs: number | null;
    latencyBand: LatencyBand | null;
    summary?: string;
    pairIdx?: number | null;
  }>;
}
interface LoadProgressPayload {
  phase: "idle" | "loading" | "complete";
  loadedRows: number;
  loadedBytes: number;
  totalBytes?: number;
  percent?: number;
}
interface StreamBacklogPayload {
  queuedFrames: number;
  queuedRows: number;
}

type QueuedFrame =
  | { kind: "snapshot-chunk"; payload: SnapshotChunkPayload }
  | { kind: "snapshot-end" }
  | { kind: "append"; payload: AppendPayload }
  | { kind: "patch"; payload: PatchPayload }
  | { kind: "load-progress"; payload: LoadProgressPayload }
  | { kind: "stream-backlog"; payload: StreamBacklogPayload };

const MAX_DRAIN_FRAMES = 50;

export interface ConnectOpts {
  /** Override stream URL. Default `/api/log/stream`. */
  url?: string;
  /** Override EventSource constructor. Tests inject a fake. */
  EventSourceCtor?: typeof EventSource;
}

export function connectLogStream(opts: ConnectOpts = {}): ConnectionHandle {
  const url = opts.url ?? apiUrl("/api/log/stream");
  const Ctor = opts.EventSourceCtor ?? globalThis.EventSource;
  if (!Ctor) {
    // Defensive: in jsdom without a polyfill, return a no-op handle so the
    // app doesn't crash. Connection stays at whatever it was.
    return { close: () => {} };
  }
  useAppStore.getState().setConnection("connecting");

  const es = new Ctor(url);
  const queuedFrames: QueuedFrame[] = [];
  let queuedFrameStart = 0;
  let drainScheduled = false;
  let drainGeneration = 0;
  let graceful = false;
  let closedByCaller = false;
  let hasConnected = false;

  const clearQueuedFrames = (): void => {
    queuedFrames.length = 0;
    queuedFrameStart = 0;
    drainScheduled = false;
    drainGeneration += 1;
  };
  const drainFrames = (): void => {
    drainScheduled = false;
    const store = useAppStore.getState();
    let drained = 0;
    while (drained < MAX_DRAIN_FRAMES && queuedFrameStart < queuedFrames.length) {
      const frame = queuedFrames[queuedFrameStart++];
      if (!frame) continue;
      drained += 1;
      if (frame.kind === "snapshot-chunk")
        store.appendSnapshotRows(frame.payload.rows, frame.payload.from);
      else if (frame.kind === "snapshot-end") {
        hasConnected = true;
        store.setConnection("connected");
      } else if (frame.kind === "append") store.appendRows(frame.payload.rows, frame.payload.from);
      else if (frame.kind === "patch") store.applyPatch(frame.payload.updates);
      else if (frame.kind === "load-progress") store.setLoadProgress(frame.payload);
      else store.setStreamBacklog(frame.payload);
    }
    if (queuedFrameStart === queuedFrames.length) {
      queuedFrames.length = 0;
      queuedFrameStart = 0;
    }
    if (queuedFrameStart < queuedFrames.length) scheduleDrain();
  };
  const scheduleDrain = (): void => {
    if (drainScheduled || graceful || closedByCaller) return;
    drainScheduled = true;
    const generation = drainGeneration;
    const run = (): void => {
      if (generation !== drainGeneration || graceful || closedByCaller) return;
      drainFrames();
    };
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => run());
    } else {
      queueMicrotask(run);
    }
  };
  const enqueue = (frame: QueuedFrame): void => {
    queuedFrames.push(frame);
    scheduleDrain();
  };

  const onSnapshotBegin = (ev: Event): void => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as SnapshotBeginPayload;
      clearQueuedFrames();
      const store = useAppStore.getState();
      store.setRows([]);
      store.setMeta({
        filename: data.meta.filename,
        eventCount: 0,
        sessionCount: 0,
      });
      if (typeof data.meta.logKey === "string" && data.meta.logKey.length > 0) {
        store.setLogKey(data.meta.logKey);
      }
    } catch {
      /* malformed frame — ignore */
    }
  };
  const onSnapshotChunk = (ev: Event): void => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as SnapshotChunkPayload;
      enqueue({ kind: "snapshot-chunk", payload: data });
    } catch {
      /* ignore */
    }
  };
  const onSnapshotEnd = (): void => {
    enqueue({ kind: "snapshot-end" });
  };
  const onAppend = (ev: Event): void => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as AppendPayload;
      enqueue({ kind: "append", payload: data });
    } catch {
      /* ignore */
    }
  };
  const onPatch = (ev: Event): void => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as PatchPayload;
      enqueue({ kind: "patch", payload: data });
    } catch {
      /* ignore */
    }
  };
  const onLoadProgress = (ev: Event): void => {
    try {
      enqueue({
        kind: "load-progress",
        payload: JSON.parse((ev as MessageEvent).data) as LoadProgressPayload,
      });
    } catch {
      /* ignore */
    }
  };
  const onStreamBacklog = (ev: Event): void => {
    try {
      enqueue({
        kind: "stream-backlog",
        payload: JSON.parse((ev as MessageEvent).data) as StreamBacklogPayload,
      });
    } catch {
      /* ignore */
    }
  };
  const onPing = (): void => {
    /* heartbeat — no store mutation */
  };
  const onRotation = (): void => {
    useAppStore.getState().setRotationNotice(true);
    useAppStore.getState().resetForRotation();
    clearQueuedFrames();
  };
  const onWatchError = (ev: Event): void => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as {
        code?: "read-error" | "watch-fatal";
        message?: string;
      };
      const code = data.code === "watch-fatal" ? "watch-fatal" : "read-error";
      useAppStore.getState().setLastWatchError({
        code,
        message: typeof data.message === "string" ? data.message : "",
      });
    } catch {
      useAppStore.getState().setLastWatchError({ code: "read-error", message: "" });
    }
  };
  const onLogReset = (): void => {
    useAppStore.getState().resetForLogSwitch();
    clearQueuedFrames();
  };
  const onBye = (): void => {
    if (closedByCaller) return;
    graceful = true;
    try {
      es.close();
    } catch {
      /* ignore */
    }
    useAppStore.getState().setConnection("disconnected");
  };
  const onError = (): void => {
    if (graceful || closedByCaller) return;
    // EventSource.CLOSED === 2. Browser implementations often report
    // CONNECTING while retrying after a server crash, but once the user has
    // seen data this is a real interruption that should expose Retry.
    if (hasConnected || es.readyState === 2) {
      useAppStore.getState().setConnection("disconnected");
    } else {
      useAppStore.getState().setConnection("connecting");
    }
  };

  es.addEventListener("snapshot-begin", onSnapshotBegin);
  es.addEventListener("snapshot-chunk", onSnapshotChunk);
  es.addEventListener("snapshot-end", onSnapshotEnd);
  es.addEventListener("append", onAppend);
  es.addEventListener("patch", onPatch);
  es.addEventListener("load-progress", onLoadProgress);
  es.addEventListener("stream-backlog", onStreamBacklog);
  es.addEventListener("ping", onPing);
  es.addEventListener("rotation", onRotation);
  es.addEventListener("watch-error", onWatchError);
  es.addEventListener("log-reset", onLogReset);
  es.addEventListener("bye", onBye);
  es.onerror = onError;

  return {
    close: () => {
      closedByCaller = true;
      graceful = true;
      clearQueuedFrames();
      try {
        es.close();
      } catch {
        /* ignore */
      }
    },
  };
}
