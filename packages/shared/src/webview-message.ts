// Webview ↔ extension-host message envelopes (Phase 11 Plan 11-03).
//
// Types live in @ahp-inspector/shared so both the extension package and the
// browser-only UI can import them without violating package-boundary
// rules (boundary.test.ts forbids the UI from importing the extension).
// `packages/extension/src/messageProtocol.ts` re-exports these for the
// extension host's convenience.

import type { AhpEvent } from "./event.js";

// Mirror of @ahp-inspector/core Status — duplicated here so this protocol
// file can stay in @ahp-inspector/shared without taking a runtime dep on
// @ahp-inspector/core. Plan 11-03 contract tests pin it to core's shape.
type WebviewStatus = "ok" | "error" | "pending" | "unmatched" | "orphan" | "n/a";

// Server-route response shapes are not exported from any portable
// package today, so we redeclare the message-shaped subset here. These
// MUST stay in lock-step with the equivalents in
// packages/server/src/{detail,search,state}-routes.ts and
// packages/server/src/app-state.ts. Plan 11-03 contract tests guard the
// alignment.

export interface WebviewLogMeta {
  readonly filename: string;
  readonly sizeBytes: number;
  readonly startedAt: number;
  readonly logKey: string;
}

export interface WebviewSafeCandidate {
  readonly id: string;
  readonly label: string;
  readonly origin: "vscode" | "vscode-insiders" | "vscode-oss-dev" | "manual";
  readonly confidence: "high" | "medium" | "low";
  readonly mtimeMs: number;
  readonly sizeBytes: number;
  readonly contextLabel?: string;
}

export interface WebviewOpenSessionResult {
  readonly active: {
    readonly logKey: string;
    readonly meta: WebviewLogMeta;
  };
}

export interface WebviewDetailResponse {
  readonly event: AhpEvent;
  readonly pair: AhpEvent | null;
  readonly latencyMs: number | null;
  readonly status: WebviewStatus;
  readonly pairIdx: number | null;
}

export interface WebviewSearchResult {
  readonly matches: readonly number[];
  readonly total: number;
  readonly truncated: boolean;
}

export type WebviewStateResourceKind = "root" | "session" | "terminal" | "unknown";

// state-at projection — the webview client needs to deserialize the same
// shape as the HTTP /api/state-at success response. We import-by-shape
// rather than re-export from the server module so this file stays
// portable.
export interface WebviewStateAtSuccessResponse {
  readonly logKey: string;
  readonly targetIndex: number;
  readonly totalEvents: number;
  readonly confidence: "complete" | "partial" | "unknown";
  readonly diagnostics: ReadonlyArray<unknown>;
  readonly resources: ReadonlyArray<unknown>;
  readonly selectedResource: unknown;
  readonly intents: ReadonlyArray<unknown>;
  readonly cache: unknown;
}

// Frame envelope re-emitted by the bridge from AppState.SsePayload. Keeping
// the kinds aligned with the SSE contract lets the UI use the same store
// mutations regardless of transport.
export type WebviewSsePayload =
  | { readonly kind: "snapshot-begin"; readonly meta: WebviewLogMeta; readonly total: number }
  | {
      readonly kind: "snapshot-chunk";
      readonly rows: ReadonlyArray<unknown>;
      readonly from: number;
    }
  | { readonly kind: "snapshot-end" }
  | { readonly kind: "append"; readonly rows: ReadonlyArray<unknown>; readonly from: number }
  | { readonly kind: "patch"; readonly updates: ReadonlyArray<unknown> }
  | { readonly kind: "ping" }
  | { readonly kind: "bye" }
  | { readonly kind: "error"; readonly code: string; readonly message: string }
  | { readonly kind: "rotation"; readonly newSize: number; readonly reason: "shrink" | "rename" }
  | {
      readonly kind: "watch-error";
      readonly code: "read-error" | "watch-fatal";
      readonly message: string;
    }
  | { readonly kind: "log-reset" };

export type WebviewRequest =
  | { readonly kind: "session/discover"; readonly requestId: string }
  | { readonly kind: "session/openPath"; readonly requestId: string; readonly path: string }
  | { readonly kind: "session/openCandidate"; readonly requestId: string; readonly id: string }
  | { readonly kind: "log/meta"; readonly requestId: string }
  | {
      readonly kind: "log/event";
      readonly requestId: string;
      readonly idx: number;
      readonly logKey?: string | null;
    }
  | { readonly kind: "log/search"; readonly requestId: string; readonly q: string }
  | {
      readonly kind: "state/at";
      readonly requestId: string;
      readonly idx: number;
      readonly logKey?: string | null;
      readonly resourceKind?: "root" | "session" | "terminal";
      readonly resourceUri?: string;
    }
  | { readonly kind: "stream/start"; readonly requestId: string }
  | { readonly kind: "stream/stop"; readonly requestId: string };

export type WebviewResponseSuccess<T = unknown> = {
  readonly kind: "response";
  readonly requestId: string;
  readonly ok: true;
  readonly value: T;
};

export interface WebviewResponseError {
  readonly kind: "response";
  readonly requestId: string;
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export type WebviewResponse = WebviewResponseSuccess | WebviewResponseError;

export type ExtensionNotification =
  | WebviewResponse
  | { readonly kind: "stream"; readonly payload: WebviewSsePayload }
  | { readonly kind: "initialLog"; readonly path: string | null };

// Type guards used on the webview side (untrusted JSON arrives as `unknown`).
export function isExtensionNotification(value: unknown): value is ExtensionNotification {
  if (!value || typeof value !== "object") return false;
  const v = value as { kind?: unknown };
  if (typeof v.kind !== "string") return false;
  return v.kind === "response" || v.kind === "stream" || v.kind === "initialLog";
}
