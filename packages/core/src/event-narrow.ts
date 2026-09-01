// Narrowing helpers — turn an opaque `AhpEvent` (whose `raw` is `unknown`)
// into a discriminated, properly-typed view of its payload.
//
// Use this anywhere you want to inspect protocol-specific fields without
// hand-rolling Record<string, unknown> drilling. Each branch carries types
// from `@ahp-inspector/protocol` so callers get autocomplete and exhaustive
// switching.

import {
  ACTION_INTRODUCED_IN,
  type ActionOrigin,
  NOTIFICATION_INTRODUCED_IN,
  type ProtocolNotificationMethod,
  type ServerNotificationMap,
  type StateAction,
} from "@ahp-inspector/protocol";
import type { AhpEvent } from "@ahp-inspector/shared";

// ── Public types ─────────────────────────────────────────────────────────────

/** Pulled out of a JSON-RPC error response. */
export interface ErrorPayload {
  readonly code: number | string | null;
  readonly message: string | null;
  readonly data: unknown;
}

/**
 * Anything wearing `{ type: "...", ... }` that may or may not match a known
 * `StateAction` shape. Used for legacy log fixtures, removed protocol shapes,
 * and provider-specific extensions.
 */
export interface UnknownTypedPayload {
  readonly type: string | null;
  readonly fields: Record<string, unknown>;
}

/**
 * Discriminated view of an `AhpEvent`'s payload. Each variant has the fields
 * a summary / inspector / debugger needs without re-parsing `event.raw`.
 */
export type NarrowedEvent =
  | NarrowedParseError
  | NarrowedRequest
  | NarrowedResponse
  | NarrowedClientNotification
  | NarrowedServerNotification
  | NarrowedAction
  | NarrowedProtocolNotification
  | NarrowedLog;

export interface NarrowedParseError {
  readonly kind: "parse-error";
  readonly event: AhpEvent;
  readonly reason: string;
}

export interface NarrowedRequest {
  readonly kind: "request";
  readonly event: AhpEvent;
  readonly method: string;
  readonly params: unknown;
  /** Inner action when `method === "dispatchAction"`, else null. */
  readonly innerAction: StateAction | UnknownTypedPayload | null;
}

export interface NarrowedResponse {
  readonly kind: "response";
  readonly event: AhpEvent;
  /** Method of the request this response was correlated to. */
  readonly pairMethod: string | null;
  /** Defined iff the response carries a `result` (success). */
  readonly result: { readonly value: unknown } | null;
  /** Defined iff the response carries an `error`. */
  readonly error: ErrorPayload | null;
}

export interface NarrowedClientNotification {
  readonly kind: "client-notification";
  readonly event: AhpEvent;
  readonly method: string;
  readonly params: unknown;
  /** Inner action when `method === "dispatchAction"`, else null. */
  readonly innerAction: StateAction | UnknownTypedPayload | null;
}

export interface NarrowedServerNotification {
  readonly kind: "server-notification";
  readonly event: AhpEvent;
  readonly method: string | null;
  readonly params: unknown;
  /** Canonical method/params pair when the method is in the current protocol. */
  readonly notification: KnownProtocolNotification | null;
}

export type KnownProtocolNotification = {
  readonly [M in ProtocolNotificationMethod]: {
    readonly method: M;
    readonly params: ServerNotificationMap[M]["params"];
  };
}[ProtocolNotificationMethod];

export interface NarrowedActionEnvelope {
  readonly channel: string;
  readonly action: StateAction | UnknownTypedPayload;
  readonly serverSeq: number;
  readonly origin: ActionOrigin | undefined;
  readonly rejectionReason?: string;
}

export interface NarrowedAction {
  readonly kind: "action";
  readonly event: AhpEvent;
  /** Full envelope when shape is recognized; null for malformed actions. */
  readonly envelope: NarrowedActionEnvelope | null;
  /**
   * Inner action — typed `StateAction` when the `type` is a known
   * `ActionType`, otherwise `UnknownTypedPayload` for legacy / unknown shapes.
   */
  readonly action: StateAction | UnknownTypedPayload;
}

export interface NarrowedProtocolNotification {
  readonly kind: "protocol-notification";
  readonly event: AhpEvent;
  /** Legacy `method:"notification"` payload; never cast to current protocol types. */
  readonly notification: UnknownTypedPayload;
}

export interface NarrowedLog {
  readonly kind: "log";
  readonly event: AhpEvent;
  readonly message: string | null;
  readonly raw: Record<string, unknown> | null;
}

// ── Entry point ──────────────────────────────────────────────────────────────

export function narrowEvent(event: AhpEvent, pairMethod: string | null = null): NarrowedEvent {
  switch (event.kind) {
    case "parse-error":
      return {
        kind: "parse-error",
        event,
        reason: event.parseError?.reason ?? "unknown parse error",
      };
    case "request": {
      const params = paramsOf(event.raw);
      return {
        kind: "request",
        event,
        method: event.method ?? "",
        params,
        innerAction: event.method === "dispatchAction" ? readInnerAction(params) : null,
      };
    }
    case "response": {
      const raw = asRecord(event.raw);
      const result = raw && "result" in raw ? { value: raw.result } : null;
      const error = readError(raw);
      return { kind: "response", event, pairMethod, result, error };
    }
    case "client-notification": {
      const params = paramsOf(event.raw);
      return {
        kind: "client-notification",
        event,
        method: event.method ?? "",
        params,
        innerAction: event.method === "dispatchAction" ? readInnerAction(params) : null,
      };
    }
    case "server-notification": {
      const params = paramsOf(event.raw);
      return {
        kind: "server-notification",
        event,
        method: event.method,
        params,
        notification: readKnownNotification(event.method, params),
      };
    }
    case "action": {
      const params = paramsOf(event.raw);
      const envelope = readActionEnvelope(params);
      const rawAction = asRecord(isRecord(params) ? params.action : null);
      const action =
        envelope?.action ??
        (rawAction
          ? (readKnownAction(rawAction) ?? unknownPayload(rawAction))
          : unknownPayload(null));
      return { kind: "action", event, envelope, action };
    }
    case "protocol-notification": {
      const params = paramsOf(event.raw);
      const notif = asRecord(isRecord(params) ? params.notification : null) ?? asRecord(params);
      return {
        kind: "protocol-notification",
        event,
        notification: unknownPayload(notif),
      };
    }
    case "log": {
      const raw = asRecord(event.raw);
      const params = paramsOf(event.raw);
      const message = firstString(
        isRecord(params) ? params.message : null,
        raw ? raw.message : null,
      );
      return { kind: "log", event, message, raw };
    }
  }
}

// ── Type guards ──────────────────────────────────────────────────────────────
//
// The generated version registries are exhaustive runtime maps. Checking
// exact keys avoids treating unknown future actions that happen to reuse a
// current channel prefix as fully typed current-protocol actions.

function isKnownActionType(type: string): type is StateAction["type"] {
  return Object.hasOwn(ACTION_INTRODUCED_IN, type);
}

function isKnownNotificationMethod(method: string): method is ProtocolNotificationMethod {
  return Object.hasOwn(NOTIFICATION_INTRODUCED_IN, method);
}

export function isKnownAction(
  action: { type: string | null } | StateAction,
): action is StateAction {
  return typeof action.type === "string" && isKnownActionType(action.type);
}

// ── Internal readers ─────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return isRecord(v) ? v : null;
}

function paramsOf(raw: unknown): unknown {
  return isRecord(raw) ? raw.params : undefined;
}

function firstString(...values: Array<unknown>): string | null {
  for (const v of values) if (typeof v === "string") return v;
  return null;
}

function unknownPayload(value: Record<string, unknown> | null): UnknownTypedPayload {
  if (!value) return { type: null, fields: {} };
  const type = typeof value.type === "string" ? value.type : null;
  return { type, fields: value };
}

function readInnerAction(params: unknown): StateAction | UnknownTypedPayload | null {
  const action = isRecord(params) ? asRecord(params.action) : null;
  if (!action) return null;
  return readKnownAction(action) ?? unknownPayload(action);
}

function readKnownAction(value: Record<string, unknown>): StateAction | null {
  if (typeof value.type !== "string" || !isKnownActionType(value.type)) return null;
  // Trust the discriminant; protocol shapes are validated upstream.
  return value as unknown as StateAction;
}

function readActionEnvelope(value: unknown): NarrowedActionEnvelope | null {
  if (!isRecord(value)) return null;
  if (typeof value.channel !== "string") return null;
  if (typeof value.serverSeq !== "number") return null;
  const action = asRecord(value.action);
  if (!action || typeof action.type !== "string") return null;
  const origin =
    isRecord(value.origin) &&
    typeof value.origin.clientId === "string" &&
    typeof value.origin.clientSeq === "number"
      ? { clientId: value.origin.clientId, clientSeq: value.origin.clientSeq }
      : undefined;
  const narrowedAction = readKnownAction(action) ?? unknownPayload(action);
  return {
    channel: value.channel,
    action: narrowedAction,
    serverSeq: value.serverSeq,
    origin,
    ...(typeof value.rejectionReason === "string"
      ? { rejectionReason: value.rejectionReason }
      : {}),
  };
}

function readKnownNotification(
  method: string | null,
  params: unknown,
): KnownProtocolNotification | null {
  if (!method || !isKnownNotificationMethod(method)) {
    return null;
  }
  const value = asRecord(params);
  if (!value || typeof value.channel !== "string") {
    return null;
  }
  switch (method) {
    case "root/sessionAdded": {
      const summary = asRecord(value.summary);
      if (!summary || typeof summary.title !== "string") {
        return null;
      }
      break;
    }
    case "root/sessionRemoved":
      if (typeof value.session !== "string") {
        return null;
      }
      break;
    case "root/sessionSummaryChanged":
      if (typeof value.session !== "string" || !isRecord(value.changes)) {
        return null;
      }
      break;
    case "root/progress":
      if (
        typeof value.progressToken !== "string" ||
        typeof value.progress !== "number" ||
        (value.total !== undefined && typeof value.total !== "number")
      ) {
        return null;
      }
      break;
    case "auth/required": {
      const resource = asRecord(value.resource);
      if (!resource || typeof resource.resource !== "string") {
        return null;
      }
      break;
    }
    case "otlp/exportLogs":
    case "otlp/exportTraces":
    case "otlp/exportMetrics":
      if (!isRecord(value.payload)) {
        return null;
      }
      break;
  }
  return { method, params } as KnownProtocolNotification;
}

function readError(raw: Record<string, unknown> | null): ErrorPayload | null {
  if (!raw) return null;
  const error = asRecord(raw.error);
  if (!error) return null;
  const code = error.code;
  const codeOut: number | string | null =
    typeof code === "number" || typeof code === "string" ? code : null;
  const message = firstString(error.message, asRecord(error.data)?.message);
  return { code: codeOut, message, data: error.data };
}
