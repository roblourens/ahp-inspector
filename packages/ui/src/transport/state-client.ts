/**
 * Browser-only transport for lazy reconstructed state lookup.
 *
 * MUST NOT import node:, fs, path, hono, or @ahp-inspector/server.
 * boundary.test.ts enforces this at CI time.
 */

import type { ReplayResourceKind } from "@ahp-inspector/core";
import { apiUrl } from "./api-base.js";

export type ReplayConfidence = "complete" | "partial" | "unknown";
export type StateResourceKind = ReplayResourceKind;

export interface ReplayDiagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly eventIdx: number | null;
  readonly message: string;
  readonly details?: unknown;
}

export interface ReplayClientIntent {
  readonly eventIdx: number;
  readonly ts: number;
  readonly clientSeq: number | null;
  readonly actionType: string | null;
  readonly resource: { readonly kind: StateResourceKind; readonly uri: string } | null;
  readonly ignored: boolean;
  readonly acceptedByServerSeq: number | null;
}

export interface StateReplayCacheInfo {
  readonly hit: boolean;
  readonly size: number;
  readonly maxEntries: number;
}

export interface StateAtResourceMetadata {
  readonly kind: StateResourceKind;
  readonly uri: string;
  readonly confidence: ReplayConfidence;
  readonly baselineEventIdx: number;
  readonly lastAppliedEventIdx: number;
  readonly baselineFromSeq: number | null;
  readonly lastServerSeq: number | null;
  readonly diagnosticCount: number;
}

export interface StateAtSelectedResource extends StateAtResourceMetadata {
  readonly diagnostics: readonly ReplayDiagnostic[];
  readonly state: unknown;
}

export interface StateAtSuccessResponse {
  readonly logKey: string;
  readonly targetIndex: number;
  readonly totalEvents: number;
  readonly confidence: ReplayConfidence;
  readonly diagnostics: readonly ReplayDiagnostic[];
  readonly resources: readonly StateAtResourceMetadata[];
  readonly selectedResource: StateAtSelectedResource | null;
  readonly intents: readonly ReplayClientIntent[];
  readonly cache: StateReplayCacheInfo;
}

export type StateAtErrorCode = "bad-request" | "no-active-log" | "not-found" | "log-mismatch";

export interface StateAtErrorResponse {
  readonly code: StateAtErrorCode;
  readonly message: string;
  readonly totalEvents?: number;
}

export type StateAtResponse = StateAtSuccessResponse | StateAtErrorResponse;

export interface FetchStateAtOptions {
  readonly logKey?: string | null;
  readonly resourceKind?: Exclude<StateResourceKind, "unknown">;
  readonly resourceUri?: string;
  readonly signal?: AbortSignal;
}

export async function fetchStateAt(
  idx: number,
  options: FetchStateAtOptions = {},
): Promise<StateAtSuccessResponse | null> {
  if (!Number.isInteger(idx) || idx < 0) {
    throw new Error(`Invalid state index: ${idx}`);
  }
  if ((options.resourceKind === undefined) !== (options.resourceUri === undefined)) {
    throw new Error("resourceKind and resourceUri must be provided together");
  }

  const params = new URLSearchParams({ idx: String(idx) });
  if (options.logKey) params.set("logKey", options.logKey);
  if (options.resourceKind !== undefined && options.resourceUri !== undefined) {
    params.set("resourceKind", options.resourceKind);
    params.set("resourceUri", options.resourceUri);
  }

  const init: RequestInit = options.signal !== undefined ? { signal: options.signal } : {};
  const resp = await fetch(apiUrl(`/api/state-at?${params.toString()}`), init);
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const body = await readErrorBody(resp);
    const message = body?.message
      ? `${body.message} (${resp.status})`
      : `Failed to load state: ${resp.status}`;
    throw new Error(message);
  }
  return (await resp.json()) as StateAtSuccessResponse;
}

async function readErrorBody(resp: Response): Promise<StateAtErrorResponse | null> {
  try {
    return (await resp.json()) as StateAtErrorResponse;
  } catch {
    return null;
  }
}
