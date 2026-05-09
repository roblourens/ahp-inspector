// SSE client (Plan 02-06). Bridges the server's log stream into the
// Zustand store. Maps each SSE event kind to one store mutation.
//
// Frame contract is defined by packages/server/src/app-state.ts SsePayload.
// Snapshot rows are buffered locally until `snapshot-end` so the store sees
// a single setRows() call (avoids transient flicker for large baselines).
//
// T-02-06-02: graceful `bye` closes the EventSource and prevents browser
// auto-reconnect storms. Before the first snapshot, transient `onerror` keeps
// connection at 'connecting'. After data has loaded, any stream error is
// user-visible as disconnected so the retry banner appears promptly.

import type { EventRow, LatencyBand, Status } from "@ahp-inspector/core";
import { useAppStore } from "../state/store.js";

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

export interface ConnectOpts {
  /** Override stream URL. Default `/api/log/stream`. */
  url?: string;
  /** Override EventSource constructor. Tests inject a fake. */
  EventSourceCtor?: typeof EventSource;
}

export function connectLogStream(opts: ConnectOpts = {}): ConnectionHandle {
  const url = opts.url ?? "/api/log/stream";
  const Ctor = opts.EventSourceCtor ?? globalThis.EventSource;
  if (!Ctor) {
    // Defensive: in jsdom without a polyfill, return a no-op handle so the
    // app doesn't crash. Connection stays at whatever it was.
    return { close: () => {} };
  }
  useAppStore.getState().setConnection("connecting");

  const es = new Ctor(url);
  let snapshotRows: EventRow[] = [];
  let graceful = false;
  let closedByCaller = false;
  let hasConnected = false;

  const onSnapshotBegin = (ev: Event): void => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as SnapshotBeginPayload;
      snapshotRows = [];
      const store = useAppStore.getState();
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
      snapshotRows = snapshotRows.concat(data.rows);
    } catch {
      /* ignore */
    }
  };
  const onSnapshotEnd = (): void => {
    useAppStore.getState().setRows(snapshotRows);
    snapshotRows = [];
    hasConnected = true;
    useAppStore.getState().setConnection("connected");
  };
  const onAppend = (ev: Event): void => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as AppendPayload;
      useAppStore.getState().appendRows(data.rows, data.from);
    } catch {
      /* ignore */
    }
  };
  const onPatch = (ev: Event): void => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as PatchPayload;
      useAppStore.getState().applyPatch(data.updates);
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
    snapshotRows = [];
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
    snapshotRows = [];
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
      try {
        es.close();
      } catch {
        /* ignore */
      }
    },
  };
}
