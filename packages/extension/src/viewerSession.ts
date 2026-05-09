// Extension-host session bridge (Plan 11-03 Task 2).
//
// Owns the local AHP session lifecycle for one webview panel. Reuses the
// same `LogSessionManager` + `AppState` machinery as the standalone
// loopback server, but speaks the typed `WebviewRequest` /
// `ExtensionNotification` protocol instead of HTTP/SSE.
//
// Trust posture (T-11-03-01..04):
//   - Requests are rejected unless they carry a known `kind` and a
//     `requestId` string. Unknown messages are dropped silently.
//   - Path/id payloads are validated as strings and length-clamped.
//   - Responses never carry absolute file paths — the LogMeta shape
//     already exposes basename/logKey only.
//   - `dispose()` closes the active session, removes session-manager
//     and AppState subscriptions, and ignores any further requests.

import { discoverVsCodeLogs, NodeHostAdapter, resolveCandidateId } from "@ahp-viewer/host-node";
import {
  createLogSessionManager,
  type LogSessionManager,
  type SsePayload,
} from "@ahp-viewer/server";
import type {
  ExtensionNotification,
  WebviewRequest,
  WebviewResponseError,
  WebviewSsePayload,
} from "@ahp-viewer/shared";

const MAX_PATH_LEN = 4096;
const MAX_QUERY_LEN = 256;
const SNAPSHOT_CHUNK = 2000;

export interface ViewerSessionBridgeOptions {
  /** Called to send a notification back to the webview. */
  readonly postMessage: (notification: ExtensionNotification) => void;
  /** Direction inference (CLI uses `classifyDirection`); optional for tests. */
  readonly directionInference?: Parameters<typeof createLogSessionManager>[0]["directionInference"];
}

export class ViewerSessionBridge {
  private readonly post: (n: ExtensionNotification) => void;
  private readonly host = new NodeHostAdapter();
  private readonly sessions: LogSessionManager;
  private readonly offChange: () => void;
  private streamSub: (() => void) | null = null;
  private disposed = false;

  constructor(opts: ViewerSessionBridgeOptions) {
    this.post = opts.postMessage;
    const managerOpts: Parameters<typeof createLogSessionManager>[0] = {
      host: this.host,
      resolveCandidateId,
      ...(opts.directionInference ? { directionInference: opts.directionInference } : {}),
    };
    this.sessions = createLogSessionManager(managerOpts);
    // Active-session transitions reset the webview stream the same way
    // sse-routes emits `log-reset` on the HTTP transport.
    this.offChange = this.sessions.onChange(() => {
      this.detachStream();
      this.post({ kind: "stream", payload: { kind: "log-reset" } });
    });
  }

  /** Optional: forward an active-editor candidate to the webview. */
  notifyInitialLog(path: string | null): void {
    if (this.disposed) return;
    this.post({ kind: "initialLog", path });
  }

  /** Open the active-editor candidate up-front (used after panel init). */
  async openInitialLogPath(path: string): Promise<void> {
    if (this.disposed) return;
    if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LEN) return;
    try {
      await this.sessions.open({ path });
    } catch {
      // Surfacing as an error frame would require a requestId; the webview
      // discovers via probe → no-log instead.
    }
  }

  async handle(message: unknown): Promise<void> {
    if (this.disposed) return;
    const req = parseRequest(message);
    if (!req) return;
    switch (req.kind) {
      case "session/discover":
        await this.handleDiscover(req.requestId);
        return;
      case "session/openPath":
        await this.handleOpen(req.requestId, { path: req.path });
        return;
      case "session/openCandidate":
        await this.handleOpen(req.requestId, { id: req.id });
        return;
      case "log/meta":
        this.handleMeta(req.requestId);
        return;
      case "log/event":
        this.handleEvent(req.requestId, req.idx);
        return;
      case "log/search":
        this.handleSearch(req.requestId, req.q);
        return;
      case "state/at":
        this.handleStateAt(req);
        return;
      case "stream/start":
        this.handleStreamStart(req.requestId);
        return;
      case "stream/stop":
        this.handleStreamStop(req.requestId);
        return;
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.detachStream();
    try {
      this.offChange();
    } catch {
      /* ignore */
    }
    await this.sessions.dispose().catch(() => undefined);
  }

  private async handleDiscover(requestId: string): Promise<void> {
    try {
      const r = await discoverVsCodeLogs();
      this.respond(requestId, { candidates: r.candidates, truncated: r.truncated });
    } catch (err) {
      this.error(requestId, "discover-failed", (err as Error).message ?? "discover failed");
    }
  }

  private async handleOpen(
    requestId: string,
    input: { path: string } | { id: string },
  ): Promise<void> {
    try {
      const active = await this.sessions.open(input);
      this.respond(requestId, {
        active: { logKey: active.logKey, meta: active.appState.meta },
      });
    } catch (err) {
      const e = err as { code?: string };
      const code = typeof e.code === "string" ? e.code : "not-found";
      this.error(requestId, code, code);
    }
  }

  private handleMeta(requestId: string): void {
    const a = this.sessions.current();
    if (!a) {
      // probeLogMeta semantics: surface "no-log" rather than a hard error.
      this.error(requestId, "no-active-log", "no active log");
      return;
    }
    this.respond(requestId, a.appState.meta);
  }

  private handleEvent(requestId: string, idx: number): void {
    if (!Number.isInteger(idx) || idx < 0) {
      this.error(requestId, "bad-request", "invalid idx");
      return;
    }
    const a = this.sessions.current();
    if (!a) {
      this.error(requestId, "no-active-log", "no active log");
      return;
    }
    const event = a.appState.eventAt(idx);
    if (!event) {
      this.respond(requestId, null);
      return;
    }
    const correlator = a.appState.correlatorDataFor(idx);
    const pair = correlator.pairIdx !== null ? a.appState.eventAt(correlator.pairIdx) : null;
    this.respond(requestId, {
      event,
      pair,
      latencyMs: correlator.latencyMs,
      status: correlator.status,
      pairIdx: correlator.pairIdx,
    });
  }

  private handleSearch(requestId: string, rawQ: string): void {
    const a = this.sessions.current();
    if (!a) {
      this.error(requestId, "no-active-log", "no active log");
      return;
    }
    const q = (typeof rawQ === "string" ? rawQ : "").toLowerCase().slice(0, MAX_QUERY_LEN);
    const { matches, truncated } = a.appState.searchIndex.scan(q, 5000);
    this.respond(requestId, { matches, total: matches.length, truncated });
  }

  private handleStateAt(req: Extract<WebviewRequest, { kind: "state/at" }>): void {
    const a = this.sessions.current();
    if (!a) {
      this.error(req.requestId, "no-active-log", "no active log");
      return;
    }
    if (!Number.isInteger(req.idx) || req.idx < 0) {
      this.error(req.requestId, "bad-request", "invalid idx");
      return;
    }
    if (req.logKey != null && req.logKey !== a.logKey) {
      this.error(req.requestId, "log-mismatch", "active log changed");
      return;
    }
    const stateAt = a.appState.stateAtIndex(req.idx);
    if (req.idx >= stateAt.totalEvents) {
      this.error(req.requestId, "not-found", "event index not found");
      return;
    }
    // Mirror state-routes' projection contract.
    const resources = stateAt.result.resources.map((resource) => ({
      kind: resource.key.kind,
      uri: resource.key.uri,
      confidence: resource.confidence,
      baselineEventIdx: resource.baselineEventIdx,
      lastAppliedEventIdx: resource.lastAppliedEventIdx,
      baselineFromSeq: resource.baselineFromSeq,
      lastServerSeq: resource.lastServerSeq,
      diagnosticCount: resource.diagnostics.length,
    }));
    let selectedResource: unknown = null;
    if (req.resourceKind && req.resourceUri) {
      const match = stateAt.result.resources.find(
        (r) => r.key.kind === req.resourceKind && r.key.uri === req.resourceUri,
      );
      if (match) {
        selectedResource = {
          kind: match.key.kind,
          uri: match.key.uri,
          confidence: match.confidence,
          baselineEventIdx: match.baselineEventIdx,
          lastAppliedEventIdx: match.lastAppliedEventIdx,
          baselineFromSeq: match.baselineFromSeq,
          lastServerSeq: match.lastServerSeq,
          diagnosticCount: match.diagnostics.length,
          diagnostics: match.diagnostics,
          state: match.state,
        };
      }
    }
    this.respond(req.requestId, {
      logKey: a.logKey,
      targetIndex: stateAt.result.targetIndex,
      totalEvents: stateAt.totalEvents,
      confidence: aggregateConfidence(
        stateAt.result.resources,
        selectedResource,
        req.resourceKind !== undefined,
      ),
      diagnostics: stateAt.result.diagnostics,
      resources,
      selectedResource,
      intents: stateAt.result.intents,
      cache: stateAt.cache,
    });
  }

  private handleStreamStart(requestId: string): void {
    const a = this.sessions.current();
    if (!a) {
      this.error(requestId, "no-active-log", "no active log");
      return;
    }
    this.detachStream();
    // Replay snapshot, then subscribe to live frames.
    const snap = a.appState.snapshot();
    this.post({
      kind: "stream",
      payload: { kind: "snapshot-begin", meta: snap.meta, total: snap.rows.length },
    });
    for (let i = 0; i < snap.rows.length; i += SNAPSHOT_CHUNK) {
      this.post({
        kind: "stream",
        payload: {
          kind: "snapshot-chunk",
          rows: snap.rows.slice(i, i + SNAPSHOT_CHUNK),
          from: i,
        },
      });
    }
    this.post({ kind: "stream", payload: { kind: "snapshot-end" } });
    this.streamSub = a.appState.subscribe((payload: SsePayload) => {
      this.post({ kind: "stream", payload: payload as WebviewSsePayload });
    });
    this.respond(requestId, { ok: true });
  }

  private handleStreamStop(requestId: string): void {
    this.detachStream();
    this.respond(requestId, { ok: true });
  }

  private detachStream(): void {
    if (!this.streamSub) return;
    try {
      this.streamSub();
    } catch {
      /* ignore */
    }
    this.streamSub = null;
  }

  private respond(requestId: string, value: unknown): void {
    this.post({ kind: "response", requestId, ok: true, value });
  }

  private error(requestId: string, code: string, message: string): void {
    const err: WebviewResponseError = {
      kind: "response",
      requestId,
      ok: false,
      code,
      message,
    };
    this.post(err);
  }
}

function parseRequest(value: unknown): WebviewRequest | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { kind?: unknown; requestId?: unknown };
  if (typeof v.kind !== "string" || typeof v.requestId !== "string") return null;
  switch (v.kind) {
    case "session/discover":
    case "log/meta":
    case "stream/start":
    case "stream/stop":
      return v as WebviewRequest;
    case "session/openPath": {
      const path = (v as { path?: unknown }).path;
      if (typeof path !== "string" || path.length === 0 || path.length > MAX_PATH_LEN) return null;
      return v as WebviewRequest;
    }
    case "session/openCandidate": {
      const id = (v as { id?: unknown }).id;
      if (typeof id !== "string" || id.length === 0) return null;
      return v as WebviewRequest;
    }
    case "log/event": {
      const idx = (v as { idx?: unknown }).idx;
      if (typeof idx !== "number") return null;
      return v as WebviewRequest;
    }
    case "log/search": {
      const q = (v as { q?: unknown }).q;
      if (typeof q !== "string") return null;
      return v as WebviewRequest;
    }
    case "state/at": {
      const idx = (v as { idx?: unknown }).idx;
      if (typeof idx !== "number") return null;
      return v as WebviewRequest;
    }
    default:
      return null;
  }
}

function aggregateConfidence(
  resources: ReadonlyArray<{ confidence: "complete" | "partial" | "unknown" }>,
  selected: unknown,
  hadSelection: boolean,
): "complete" | "partial" | "unknown" {
  if (selected && typeof selected === "object" && "confidence" in selected) {
    const c = (selected as { confidence: "complete" | "partial" | "unknown" }).confidence;
    return c;
  }
  if (hadSelection || resources.length === 0) return "unknown";
  return resources.some((r) => r.confidence === "partial") ? "partial" : "complete";
}
