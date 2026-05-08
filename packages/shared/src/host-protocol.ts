// Host-protocol contracts. Types only — runtime implementation lives in
// `@ahp-viewer/host-node` (Node) and a future browser/VS Code adapter.
// Per RESEARCH Pattern 6: keep file discovery/watching/reading behind an
// abstraction so the same UI can later run in a VS Code webview.

/** Standard disposable: idempotent `dispose()`. */
export interface Disposable {
  dispose(): void;
}

/** A discovered candidate log file the host knows about. */
export interface LogCandidate {
  /** Opaque, server-issued id. On Node = sha256(absPath).slice(0,32). NEVER an absolute path (D-05). */
  readonly id: string;
  /** Basename-only display label for the picker UI. */
  readonly label: string;
  /** When the host last saw the file modified, epoch ms. */
  readonly mtimeMs: number;
  /** File size in bytes, when known. */
  readonly sizeBytes: number;
  /** Origin tag — "vscode", "vscode-insiders", "manual". */
  readonly origin: string;
  /** Confidence tier (Phase 4): "high" = canonical AHP JSONL, "medium" = AHP-named JSONL, "low" = legacy/agenthost.log. */
  readonly confidence: "high" | "medium" | "low";
  /** Optional breadcrumb (e.g. "20260407T223530 / window1 / exthost / GitHub.copilot-chat"); never an abs path. */
  readonly contextLabel?: string;
}

/** Result of a discovery walk; `truncated:true` indicates caps were hit. */
export interface DiscoveryResult {
  readonly candidates: readonly LogCandidate[];
  readonly truncated: boolean;
}

/** Opaque handle returned by the host adapter once a log is open. */
export interface LogHandle {
  readonly id: string;
}

/**
 * HostAdapter — the host-side surface the renderer drives.
 *
 * Implementations bridge to OS-specific APIs (fs/chokidar on Node, the VS Code
 * Workspace API in a webview). Portable code MUST NOT import an adapter
 * directly; the server/CLI wires one in.
 */
export interface HostAdapter {
  discoverLogs(): Promise<DiscoveryResult>;
  openLog(path: string): Promise<LogHandle>;
  watchLog(handle: LogHandle, onChunk: (bytes: Uint8Array) => void): Disposable;
  close(handle: LogHandle): Promise<void>;
}

// ─── HostMessage union (renderer ↔ host transport envelope) ──────────────────

export interface HostMessageDiscoverRequest {
  readonly kind: "discover/request";
  readonly requestId: string;
}
export interface HostMessageDiscoverResponse {
  readonly kind: "discover/response";
  readonly requestId: string;
  readonly result: DiscoveryResult;
}
export interface HostMessageOpenRequest {
  readonly kind: "open/request";
  readonly requestId: string;
  readonly path: string;
}
export interface HostMessageOpenResponse {
  readonly kind: "open/response";
  readonly requestId: string;
  readonly handle: LogHandle;
}
export interface HostMessageCloseRequest {
  readonly kind: "close/request";
  readonly requestId: string;
  readonly handle: LogHandle;
}
export interface HostMessageCloseResponse {
  readonly kind: "close/response";
  readonly requestId: string;
}
export interface HostMessageChunk {
  readonly kind: "chunk";
  readonly handle: LogHandle;
  /** Base64-encoded bytes (transport may be JSON-only). */
  readonly bytesB64: string;
  readonly byteOffset: number;
}
export interface HostMessageError {
  readonly kind: "error";
  readonly requestId?: string;
  readonly handle?: LogHandle;
  readonly code: string;
  readonly message: string;
}

/** Discriminated union of every host ↔ renderer transport message. */
export type HostMessage =
  | HostMessageDiscoverRequest
  | HostMessageDiscoverResponse
  | HostMessageOpenRequest
  | HostMessageOpenResponse
  | HostMessageCloseRequest
  | HostMessageCloseResponse
  | HostMessageChunk
  | HostMessageError;

/**
 * Renderer-side transport client. The `send` method is fire-and-forget; the
 * client correlates responses by `requestId` itself.
 */
export interface HostClient {
  send(msg: HostMessage): void;
  on(handler: (msg: HostMessage) => void): Disposable;
  close(): void;
}
