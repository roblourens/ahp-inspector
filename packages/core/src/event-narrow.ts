// Narrowing helpers — turn an opaque `AhpEvent` (whose `raw` is `unknown`)
// into a discriminated, properly-typed view of its payload.
//
// Use this anywhere you want to inspect protocol-specific fields without
// hand-rolling Record<string, unknown> drilling. Each branch carries types
// from `@ahp-inspector/protocol` so callers get autocomplete and exhaustive
// switching.

import type { AhpEvent } from "@ahp-inspector/shared";
import {
  type ActionEnvelope,
  ActionType,
  NotificationType,
  type ProtocolNotification,
  type StateAction,
} from "@ahp-inspector/protocol";

// ── Public types ─────────────────────────────────────────────────────────────

/** Pulled out of a JSON-RPC error response. */
export interface ErrorPayload {
  readonly code: number | string | null;
  readonly message: string | null;
  readonly data: unknown;
}

/**
 * Anything wearing `{ type: "...", ... }` that may or may not match a known
 * `StateAction` / `ProtocolNotification` shape. Used for legacy log fixtures
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
}

export interface NarrowedAction {
  readonly kind: "action";
  readonly event: AhpEvent;
  /** Full envelope when shape is recognized; null for malformed actions. */
  readonly envelope: ActionEnvelope | null;
  /**
   * Inner action — typed `StateAction` when the `type` is a known
   * `ActionType`, otherwise `UnknownTypedPayload` for legacy / unknown shapes.
   */
  readonly action: StateAction | UnknownTypedPayload;
}

export interface NarrowedProtocolNotification {
  readonly kind: "protocol-notification";
  readonly event: AhpEvent;
  /** Typed when known, otherwise UnknownTypedPayload. */
  readonly notification: ProtocolNotification | UnknownTypedPayload;
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
    case "server-notification":
      return {
        kind: "server-notification",
        event,
        method: event.method,
        params: paramsOf(event.raw),
      };
    case "action": {
      const params = paramsOf(event.raw);
      const envelope = readActionEnvelope(params);
      const rawAction = envelope
        ? (envelope.action as unknown as Record<string, unknown>)
        : asRecord(isRecord(params) ? params.action : null);
      const action = rawAction
        ? (readKnownAction(rawAction) ?? unknownPayload(rawAction))
        : unknownPayload(null);
      return { kind: "action", event, envelope, action };
    }
    case "protocol-notification": {
      const params = paramsOf(event.raw);
      const notif = asRecord(isRecord(params) ? params.notification : null) ?? asRecord(params);
      return {
        kind: "protocol-notification",
        event,
        notification: readProtocolNotification(notif) ?? unknownPayload(notif),
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

const KNOWN_ACTION_TYPES = new Set<string>(Object.values(ActionType));
const KNOWN_NOTIFICATION_TYPES = new Set<string>(Object.values(NotificationType));

export function isKnownAction(action: { type: string | null } | StateAction): action is StateAction {
  return typeof action.type === "string" && KNOWN_ACTION_TYPES.has(action.type);
}

export function isKnownNotification(
  notif: { type: string | null } | ProtocolNotification,
): notif is ProtocolNotification {
  return typeof notif.type === "string" && KNOWN_NOTIFICATION_TYPES.has(notif.type);
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
  if (typeof value.type !== "string" || !KNOWN_ACTION_TYPES.has(value.type)) return null;
  // Trust the discriminant; protocol shapes are validated upstream.
  return value as unknown as StateAction;
}

function readActionEnvelope(value: unknown): ActionEnvelope | null {
  if (!isRecord(value)) return null;
  if (typeof value.serverSeq !== "number") return null;
  const action = asRecord(value.action);
  if (!action || typeof action.type !== "string") return null;
  const origin =
    isRecord(value.origin) &&
    typeof value.origin.clientId === "string" &&
    typeof value.origin.clientSeq === "number"
      ? { clientId: value.origin.clientId, clientSeq: value.origin.clientSeq }
      : undefined;
  const known = readKnownAction(action);
  return {
    action: known ?? (action as unknown as StateAction),
    serverSeq: value.serverSeq,
    origin,
    ...(typeof value.rejectionReason === "string"
      ? { rejectionReason: value.rejectionReason }
      : {}),
  };
}

function readProtocolNotification(
  value: Record<string, unknown> | null,
): ProtocolNotification | null {
  if (!value || typeof value.type !== "string") return null;
  if (!KNOWN_NOTIFICATION_TYPES.has(value.type)) return null;
  return value as unknown as ProtocolNotification;
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
