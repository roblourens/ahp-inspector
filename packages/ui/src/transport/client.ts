/**
 * Shared UI transport contract (Plan 11-02 Task 1).
 *
 * The React app calls a single `AhpViewerClient` instead of importing the
 * concrete browser HTTP/SSE helpers directly. Two implementations:
 *   - `createBrowserAhpViewerClient` (Plan 11-02): same-origin `fetch`/SSE
 *     against the standalone loopback server.
 *   - `createWebviewAhpViewerClient` (Plan 11-03): `postMessage`/`message`
 *     against a VS Code extension host bridge.
 *
 * This module MUST stay browser-safe: no `node:` imports, no `vscode`
 * imports, no `@ahp-inspector/server` or `@ahp-inspector/host-node` imports.
 */

import type { SafeCandidate } from "../types/safe-candidate.js";
import type { DetailResponse } from "./http-client.js";
import type { SearchResult } from "./search-client.js";
import type { OpenSessionResult } from "./sessions-client.js";
import type { FetchStateAtOptions, StateAtSuccessResponse } from "./state-client.js";

export type { DetailResponse, OpenSessionResult, SearchResult, StateAtSuccessResponse };

export type LogMetaProbeResult = "no-log" | "no-server" | "ready";

export interface LogStreamHandle {
  close(): void;
}

export interface AhpViewerClient {
  /** Returns the connection-bootstrap state (replaces App's manual fetch). */
  probeLogMeta(): Promise<LogMetaProbeResult>;
  fetchCandidates(): Promise<readonly SafeCandidate[]>;
  openSessionByCandidate(id: string): Promise<OpenSessionResult>;
  openSessionByPath(path: string): Promise<OpenSessionResult>;
  /** Opens the live event stream and pipes frames into the Zustand store. */
  connectLogStream(): LogStreamHandle;
  fetchEvent(
    idx: number,
    signal?: AbortSignal,
    logKey?: string | null,
  ): Promise<DetailResponse | null>;
  searchEvents(q: string, signal?: AbortSignal): Promise<SearchResult>;
  fetchStateAt(idx: number, options?: FetchStateAtOptions): Promise<StateAtSuccessResponse | null>;
}
