// Summary text shown in the Event-row "Summary" column.
//
// HOW THIS WORKS
// ──────────────
// `summarizeEvent(event, pairMethod)` first narrows the opaque AhpEvent into
// a typed view (`narrowEvent` in `./event-narrow.ts`), then dispatches on
// `narrowed.kind`. Each kind has its own dedicated `summarize*` function so
// you can find — and tweak — the wording for one event shape without touching
// the others.
//
// Current actions narrow by their exact `ActionType`. Current notifications
// narrow by their JSON-RPC method; legacy `method:"notification"` wrappers
// stay explicitly unknown instead of being cast to the current protocol.
//
// HOW TO TWEAK
// ────────────
// • Reword a known action          → edit the matching `case` in
//                                    `summarizeKnownAction`.
// • Add a new known action case    → add a `case ActionType.X:` clause.
// • Reword a generic kind          → edit `summarizeRequest`,
//                                    `summarizeResponse`, etc.
// • Truncate / redact differently  → edit `clip`, `safePrimitive`, or
//                                    `summarizeValue` at the bottom.

import { ActionType, type StateAction } from "@ahp-inspector/protocol";
import type { AhpEvent } from "@ahp-inspector/shared";
import {
  isKnownAction,
  type KnownProtocolNotification,
  type NarrowedAction,
  type NarrowedClientNotification,
  type NarrowedLog,
  type NarrowedParseError,
  type NarrowedProtocolNotification,
  type NarrowedRequest,
  type NarrowedResponse,
  type NarrowedServerNotification,
  narrowEvent,
  type UnknownTypedPayload,
} from "./event-narrow.js";

// ── Public entry point ───────────────────────────────────────────────────────

export function summarizeEvent(event: AhpEvent, pairMethod: string | null): string {
  const view = narrowEvent(event, pairMethod);
  switch (view.kind) {
    case "parse-error":
      return summarizeParseError(view);
    case "request":
      return summarizeRequest(view);
    case "response":
      return summarizeResponse(view);
    case "client-notification":
      return summarizeClientNotification(view);
    case "server-notification":
      return summarizeServerNotification(view);
    case "action":
      return summarizeAction(view);
    case "protocol-notification":
      return summarizeProtocolNotification(view);
    case "log":
      return summarizeLog(view);
  }
}

// ── Per-kind handlers ────────────────────────────────────────────────────────

function summarizeParseError(view: NarrowedParseError): string {
  return `parse error line ${view.event.seq + 1}: ${view.reason}`;
}

function summarizeRequest(view: NarrowedRequest): string {
  if (view.method === "resourceList") return summarizeResourceList(view.params);
  if (view.method === "dispatchAction" && view.innerAction) {
    return innerActionTypeLine(view.innerAction);
  }
  if (view.innerAction) return innerActionTypeAndDetail(view.innerAction);
  return summarizeValue(view.params);
}

function summarizeClientNotification(view: NarrowedClientNotification): string {
  if (view.method === "dispatchAction" && view.innerAction) {
    return innerActionTypeLine(view.innerAction);
  }
  if (view.innerAction) return innerActionTypeAndDetail(view.innerAction);
  const params = asRecord(view.params);
  const message = firstString(params?.message, params?.text, params?.detail, params?.reason);
  if (message) return clip(message);
  const state = firstString(params?.state, params?.status);
  if (state) return clip(state);
  return summarizeValue(view.params);
}

function summarizeServerNotification(view: NarrowedServerNotification): string {
  if (view.notification) {
    return summarizeKnownNotification(view.notification);
  }
  const params = asRecord(view.params);
  const message = firstString(params?.message, params?.text, params?.detail, params?.reason);
  if (message) return clip(message);
  const state = firstString(params?.state, params?.status);
  if (state) return clip(state);
  return summarizeValue(view.params);
}

function summarizeResponse(view: NarrowedResponse): string {
  if (view.error) {
    const code = view.error.code === null ? "unknown" : String(view.error.code);
    const message = view.error.message ? clip(view.error.message) : "details unavailable";
    return `error ${code}: ${message}`;
  }
  const resultText = view.result ? summarizeValue(view.result.value) : "empty result";
  return view.pairMethod ? `${view.pairMethod} result ${resultText}` : `result ${resultText}`;
}

function summarizeAction(view: NarrowedAction): string {
  if (isKnownAction(view.action as StateAction)) {
    return summarizeKnownAction(view.action as StateAction, view.envelope?.channel ?? null);
  }
  return summarizeUnknownAction(view.action as UnknownTypedPayload);
}

function summarizeProtocolNotification(view: NarrowedProtocolNotification): string {
  return summarizeUnknownNotification(view.notification);
}

function summarizeLog(view: NarrowedLog): string {
  return `log ${clip(view.message ?? "details unavailable")}`;
}

// ── Known-action handler (one case per ActionType) ───────────────────────────
//
// Edit a `case` to change wording for that exact action. Add a new `case` to
// surface a richer summary for an action that currently falls through.

function summarizeKnownAction(action: StateAction, channel: string | null): string {
  switch (action.type) {
    case ActionType.ChatDelta:
      return `delta "${clip(action.content)}"`;
    case ActionType.ChatResponsePart:
      return `responsePart ${summarizeResponsePart(action.part)}`;
    case ActionType.ChatToolCallStart:
      return `tool start ${action.toolName}${action.displayName ? ` (${clip(action.displayName, 32)})` : ""}`;
    case ActionType.ChatToolCallDelta:
      return summarizeToolCallDelta(action);
    case ActionType.ChatToolCallReady:
      return `tool ready ${action.toolCallId} ${stringOrMd(action.invocationMessage, 48)}`;
    case ActionType.ChatToolCallComplete:
      return `tool result ${action.toolCallId} success=${action.result.success}`;
    case ActionType.ChatToolCallContentChanged:
      return summarizeToolCallContentChanged(action);
    case ActionType.ChatTurnStarted:
      return `turn start ${shortId(action.turnId)}`;
    case ActionType.ChatTurnComplete:
      return `turn complete ${shortId(action.turnId)}`;
    case ActionType.ChatTurnCancelled:
      return `turn cancelled ${shortId(action.turnId)}`;
    case ActionType.ChatError:
      return `error ${clip(action.part.error.message, 60)}`;
    case ActionType.SessionTitleChanged:
      return `title "${clip(action.title, 48)}"`;
    case ActionType.ChatUsage: {
      const { inputTokens, outputTokens } = action.usage;
      return `usage in=${inputTokens ?? "?"} out=${outputTokens ?? "?"}`;
    }
    case ActionType.ChatReasoning:
      return `reasoning "${clip(action.content, 60)}"`;
    case ActionType.SessionReady:
      return channel ? `session ready ${shortId(channel)}` : "session ready";
    case ActionType.TerminalData:
      return channel
        ? `terminal data ${shortId(channel)} +${action.data.length}b`
        : `terminal data +${action.data.length}b`;
    case ActionType.TerminalCommandFinished:
      return `terminal cmd done exit=${action.exitCode ?? "?"}`;
    default:
      // Known type with no custom phrasing yet — show the type plus a generic
      // dump of its non-discriminant fields. Add a `case` above to improve.
      return innerActionTypeAndDetail(toUnknownPayload(action));
  }
}

function summarizeToolCallDelta(
  action: StateAction & { type: ActionType.ChatToolCallDelta },
): string {
  const content = typeof action.content === "string" ? action.content : null;
  return content === null
    ? `tool delta ${action.toolCallId}`
    : `tool delta ${action.toolCallId} +${content.length}b`;
}

function summarizeToolCallContentChanged(
  action: StateAction & { type: ActionType.ChatToolCallContentChanged },
): string {
  const content = Array.isArray(action.content) ? action.content : null;
  return content === null
    ? `tool content ${action.toolCallId}`
    : `tool content ${action.toolCallId} (${content.length} parts)`;
}

function summarizeUnknownAction(action: UnknownTypedPayload): string {
  if (!action.type) return "action details unavailable";

  // Heuristic shortcuts for common legacy / provider-specific shapes that the
  // protocol union doesn't cover. Keep these tight — anything reusable should
  // become its own typed case in `summarizeKnownAction` once it's added to
  // the protocol.
  const t = action.type;
  const f = action.fields;
  if (t === "session/toolCallDelta") {
    const toolCallId = firstString(f.toolCallId) ?? "unknown";
    const content = firstString(f.content);
    return content ? `tool delta ${toolCallId} +${content.length}b` : `tool delta ${toolCallId}`;
  }
  if (t === "session/toolCallContentChanged") {
    const toolCallId = firstString(f.toolCallId) ?? "unknown";
    return Array.isArray(f.content)
      ? `tool content ${toolCallId} (${f.content.length} parts)`
      : `tool content ${toolCallId}`;
  }
  if (/delta/i.test(t)) {
    const text = firstString(f.delta, f.content, f.text, f.message);
    if (text) return `delta "${clip(text)}"`;
  }
  if (/^text$/i.test(t)) {
    const text = firstString(f.text, f.content, f.message);
    if (text) return `text "${clip(text)}"`;
  }
  if (/tool[._-]?call/i.test(t)) {
    const name = firstString(f.toolName, f.name) ?? "unknown";
    return `tool call ${name} ${summarizeValue(f.args ?? {})}`;
  }
  if (/tool[._-]?result/i.test(t)) {
    const name = firstString(f.toolName, f.name) ?? "unknown";
    return `tool result ${name} ${summarizeValue(f.result)}`;
  }
  if (/status|progress/i.test(t)) {
    const state = firstString(f.state, f.message);
    return `status ${state ? clip(state) : "details unavailable"}`;
  }
  return innerActionTypeAndDetail(action);
}

// ── Known-notification handler ───────────────────────────────────────────────

function summarizeKnownNotification(notification: KnownProtocolNotification): string {
  switch (notification.method) {
    case "root/sessionAdded":
      return `${notification.method} ${clip(notification.params.summary.title, 48)}`;
    case "root/sessionRemoved":
      return `${notification.method} ${shortId(notification.params.session)}`;
    case "root/sessionSummaryChanged": {
      const fields = Object.keys(notification.params.changes).join(",") || "(none)";
      return `${notification.method} ${shortId(notification.params.session)} [${fields}]`;
    }
    case "root/progress":
      return `${notification.method} ${notification.params.progress}/${notification.params.total ?? "?"}`;
    case "auth/required":
      return `${notification.method} ${notification.params.resource.resource}${notification.params.reason ? ` (${notification.params.reason})` : ""}`;
    case "otlp/exportLogs":
    case "otlp/exportTraces":
    case "otlp/exportMetrics":
      return `${notification.method} ${summarizeValue(notification.params)}`;
  }
}

function summarizeUnknownNotification(notif: UnknownTypedPayload): string {
  const type = notif.type;
  const f = notif.fields;
  const state = firstString(f.state, f.status);
  const message = firstString(f.message, f.text, f.detail, f.reason);
  if (type && /status|progress/i.test(type)) {
    const detail = state ?? message;
    return `status ${detail ? clip(detail) : "details unavailable"}`;
  }
  if (type && state) return `${type} ${clip(state)}`;
  if (type && message) return `${type} ${clip(message)}`;
  if (type) return `${type} ${summarizeValue(f)}`;
  return summarizeValue(f);
}

// ── Helpers shared across handlers ───────────────────────────────────────────

function summarizeResourceList(params: unknown): string {
  const p = asRecord(params);
  if (!p) return "uri=details unavailable";
  const resource = p.resource;
  const resources = p.resources;
  const fromResource =
    typeof resource === "string"
      ? resource
      : isRecord(resource)
        ? stringField(resource, "uri")
        : null;
  const firstResource =
    Array.isArray(resources) && isRecord(resources[0]) ? stringField(resources[0], "uri") : null;
  const uri = firstString(p.uri, fromResource, firstResource, p.path);
  return `uri=${uri ? safePathLabel(uri) : "details unavailable"}`;
}

function summarizeResponsePart(part: unknown): string {
  if (isRecord(part) && typeof part.markdown === "string") {
    return `markdown "${clip(part.markdown, 48)}"`;
  }
  return summarizeValue(part);
}

function stringOrMd(value: { markdown: string } | string, max = 80): string {
  if (typeof value === "string") return clip(value, max);
  return clip(value.markdown, max);
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(-8)}` : id;
}

function toUnknownPayload(value: object): UnknownTypedPayload {
  const rec = value as Record<string, unknown>;
  const type = typeof rec.type === "string" ? rec.type : null;
  return { type, fields: rec };
}

/**
 * Render `<type> <detail>` for a typed-but-unhandled payload, dropping the
 * `type` field from the detail. Used as the generic fallback.
 */
function innerActionTypeAndDetail(
  payload:
    | { type: string | null; fields?: Record<string, unknown> }
    | StateAction
    | UnknownTypedPayload,
): string {
  if ("fields" in payload && payload.fields) {
    if (!payload.type) return summarizeValue(payload.fields);
    const rest = { ...payload.fields };
    delete rest.type;
    const detail = summarizeValue(rest);
    return detail === "{…}" || detail === "empty" ? payload.type : `${payload.type} ${detail}`;
  }
  // StateAction-shaped object
  const rec = payload as unknown as Record<string, unknown>;
  const type = typeof rec.type === "string" ? rec.type : null;
  if (!type) return summarizeValue(rec);
  const rest = { ...rec };
  delete rest.type;
  const detail = summarizeValue(rest);
  return detail === "{…}" || detail === "empty" ? type : `${type} ${detail}`;
}

function innerActionTypeLine(payload: StateAction | UnknownTypedPayload): string {
  if ("fields" in payload) return payload.type ?? summarizeValue(payload.fields);
  const rec = payload as unknown as Record<string, unknown>;
  return typeof rec.type === "string" ? rec.type : summarizeValue(rec);
}

// ── Generic value formatters (exported for custom callers) ───────────────────

/** Trim, collapse whitespace, ellipsize. Returns `"empty"` for blank input. */
export function clip(text: string, max = 80): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return "empty";
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/** Reduce a path/URI to its last segment so we don't leak the full filesystem. */
export function safePathLabel(value: string): string {
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? value;
}

/** Render a single key/value pair; redacts secrets, shortens path-ish values. */
export function safePrimitive(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return `${key}=[${value.length}]`;
  if (typeof value === "object") return `${key}={…}`;
  if (typeof value === "string") {
    if (/token|secret|cookie|authorization|key/i.test(key)) return `${key}=redacted`;
    if (/path|uri|file/i.test(key)) return `${key}=${safePathLabel(value)}`;
    return `${key}=${clip(value, 32)}`;
  }
  if (typeof value === "number" || typeof value === "boolean") return `${key}=${String(value)}`;
  return null;
}

/** One-line description of an unknown value. */
export function summarizeValue(value: unknown): string {
  if (value === null || value === undefined) return "empty";
  if (typeof value === "string") return clip(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const parts = Object.entries(rec)
      .map(([key, item]) => safePrimitive(key, item))
      .filter((item): item is string => item !== null)
      .slice(0, 3);
    return parts.length > 0 ? parts.join(" ") : "{…}";
  }
  return String(value);
}

// ── Tiny accessors ───────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return isRecord(v) ? v : null;
}

function stringField(parent: Record<string, unknown> | null, key: string): string | null {
  if (!parent) return null;
  const value = parent[key];
  return typeof value === "string" ? value : null;
}

function firstString(...values: Array<unknown>): string | null {
  for (const v of values) if (typeof v === "string") return v;
  return null;
}
