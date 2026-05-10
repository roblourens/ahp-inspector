/**
 * Webview transport (Plan 11-03 Task 3).
 *
 * Implements `AhpViewerClient` over `acquireVsCodeApi().postMessage` /
 * `window.addEventListener('message', ...)`. The extension-host
 * `ViewerSessionBridge` is the counterpart.
 *
 * Lifecycle invariants:
 *   - Pending requests are stored in a map keyed by `requestId`.
 *   - On `dispose()` the map is cleared so callers don't hang forever.
 *   - The live stream subscription is reused — `connectLogStream` issues
 *     a `stream/start` request and forwards every `stream` notification
 *     into the same Zustand store the SSE client uses.
 */

import type { EventRow, LatencyBand, Status } from "@ahp-inspector/core";
import type { WebviewRequest, WebviewSsePayload } from "@ahp-inspector/shared";
import { isExtensionNotification } from "@ahp-inspector/shared";
import { useAppStore } from "../state/store.js";
import type { SafeCandidate } from "../types/safe-candidate.js";
import type {
  AhpViewerClient,
  DetailResponse,
  LogMetaProbeResult,
  LogStreamHandle,
  OpenSessionResult,
  SearchResult,
  StateAtSuccessResponse,
} from "./client.js";
import type { FetchStateAtOptions } from "./state-client.js";

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

let cachedApi: VsCodeApi | null = null;
function getVsCodeApi(): VsCodeApi {
  if (cachedApi) return cachedApi;
  const acquire = typeof window !== "undefined" ? window.acquireVsCodeApi : undefined;
  if (!acquire) {
    throw new Error(
      "acquireVsCodeApi is not available; webview-client must run inside a VS Code webview",
    );
  }
  cachedApi = acquire();
  return cachedApi;
}

export function isVsCodeWebviewRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.acquireVsCodeApi === "function";
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

const REQUEST_TIMEOUT_MS = 30_000;

export interface WebviewClientOptions {
  /** Override for tests; defaults to the global VS Code API. */
  readonly api?: VsCodeApi;
  /** Override for tests; defaults to `window`. */
  readonly target?: EventTarget;
}

export function createWebviewAhpViewerClient(opts: WebviewClientOptions = {}): AhpViewerClient {
  const api = opts.api ?? getVsCodeApi();
  const target = opts.target ?? window;
  const pending = new Map<string, PendingRequest>();
  let nextId = 0;
  const newRequestId = (): string => `r-${(++nextId).toString(36)}-${Date.now().toString(36)}`;

  function send<T>(req: WebviewRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(req.requestId);
        reject(new Error(`webview request timed out: ${req.kind}`));
      }, REQUEST_TIMEOUT_MS);
      pending.set(req.requestId, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      api.postMessage(req);
    });
  }

  const onMessage = (ev: Event): void => {
    const data = (ev as MessageEvent).data;
    if (!isExtensionNotification(data)) return;
    if (data.kind === "response") {
      const entry = pending.get(data.requestId);
      if (!entry) return;
      pending.delete(data.requestId);
      if (data.ok) {
        entry.resolve(data.value);
      } else {
        const err = new Error(data.message);
        (err as { code?: string }).code = data.code;
        entry.reject(err);
      }
      return;
    }
    if (data.kind === "stream") {
      applyStreamPayload(data.payload);
      return;
    }
    // initialLog: ignored for now — Plan 11-04 may surface it as an
    // open-by-path hint via the discovery state.
  };
  target.addEventListener("message", onMessage);

  return {
    async probeLogMeta(): Promise<LogMetaProbeResult> {
      try {
        await send<unknown>({ kind: "log/meta", requestId: newRequestId() });
        return "ready";
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "no-active-log") return "no-log";
        return "no-server";
      }
    },
    async fetchCandidates(): Promise<readonly SafeCandidate[]> {
      const value = await send<{ candidates: SafeCandidate[] }>({
        kind: "session/discover",
        requestId: newRequestId(),
      });
      return value.candidates ?? [];
    },
    async openSessionByCandidate(id: string): Promise<OpenSessionResult> {
      return send<OpenSessionResult>({
        kind: "session/openCandidate",
        requestId: newRequestId(),
        id,
      });
    },
    async openSessionByPath(path: string): Promise<OpenSessionResult> {
      return send<OpenSessionResult>({
        kind: "session/openPath",
        requestId: newRequestId(),
        path,
      });
    },
    connectLogStream(): LogStreamHandle {
      useAppStore.getState().setConnection("connecting");
      const requestId = newRequestId();
      void send<unknown>({ kind: "stream/start", requestId }).catch(() => {
        useAppStore.getState().setConnection("disconnected");
      });
      let closed = false;
      return {
        close(): void {
          if (closed) return;
          closed = true;
          void send<unknown>({ kind: "stream/stop", requestId: newRequestId() }).catch(() => {});
        },
      };
    },
    async fetchEvent(
      idx: number,
      _signal?: AbortSignal,
      logKey?: string | null,
    ): Promise<DetailResponse | null> {
      const req: WebviewRequest =
        logKey === undefined
          ? { kind: "log/event", requestId: newRequestId(), idx }
          : { kind: "log/event", requestId: newRequestId(), idx, logKey };
      try {
        return await send<DetailResponse | null>(req);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "not-found") return null;
        throw err;
      }
    },
    async searchEvents(q: string, _signal?: AbortSignal): Promise<SearchResult> {
      return send<SearchResult>({ kind: "log/search", requestId: newRequestId(), q });
    },
    async fetchStateAt(
      idx: number,
      options?: FetchStateAtOptions,
    ): Promise<StateAtSuccessResponse | null> {
      const requestId = newRequestId();
      const req: WebviewRequest = {
        kind: "state/at",
        requestId,
        idx,
        ...(options?.logKey !== undefined ? { logKey: options.logKey } : {}),
        ...(options?.resourceKind !== undefined ? { resourceKind: options.resourceKind } : {}),
        ...(options?.resourceUri !== undefined ? { resourceUri: options.resourceUri } : {}),
      };
      try {
        return await send<StateAtSuccessResponse>(req);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "not-found") return null;
        throw err;
      }
    },
  };
}

// Stream payload → store. Mirrors the SSE client's mutations so both
// transports converge on the same UI state shape.

interface SnapshotBeginPayload {
  meta: { filename: string; sizeBytes: number; startedAt: number; logKey?: string };
  total: number;
}

let snapshotRows: EventRow[] = [];

function applyStreamPayload(payload: WebviewSsePayload): void {
  const store = useAppStore.getState();
  switch (payload.kind) {
    case "snapshot-begin": {
      const meta = (payload as unknown as SnapshotBeginPayload).meta;
      snapshotRows = [];
      store.setMeta({
        filename: meta.filename,
        eventCount: 0,
        sessionCount: 0,
      });
      if (typeof meta.logKey === "string" && meta.logKey.length > 0) {
        store.setLogKey(meta.logKey);
      }
      return;
    }
    case "snapshot-chunk": {
      snapshotRows = snapshotRows.concat(payload.rows as EventRow[]);
      return;
    }
    case "snapshot-end": {
      store.setRows(snapshotRows);
      snapshotRows = [];
      store.setConnection("connected");
      return;
    }
    case "append": {
      store.appendRows(payload.rows as EventRow[], payload.from);
      return;
    }
    case "patch": {
      store.applyPatch(
        payload.updates as Array<{
          idx: number;
          status: Status;
          latencyMs: number | null;
          latencyBand: LatencyBand | null;
          summary?: string;
          pairIdx?: number | null;
        }>,
      );
      return;
    }
    case "ping":
      return;
    case "rotation": {
      store.setRotationNotice(true);
      store.resetForRotation();
      snapshotRows = [];
      return;
    }
    case "watch-error": {
      store.setLastWatchError({ code: payload.code, message: payload.message });
      return;
    }
    case "log-reset": {
      store.resetForLogSwitch();
      snapshotRows = [];
      return;
    }
    case "bye":
      store.setConnection("disconnected");
      return;
    case "error":
      // Surfaced via watch-error; nothing else to do here.
      return;
  }
}
