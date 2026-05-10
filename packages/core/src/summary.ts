// Summary text shown in the Event-row "Summary" column.
//
// HOW THIS WORKS
// ──────────────
// `summarizeEvent(event, pairMethod)` walks `SUMMARY_RULES` in order. The
// first rule whose handler returns a non-null string wins. If none match,
// `FALLBACK_SUMMARY` is returned.
//
// Each rule is one small named function focused on a single event shape.
// Rules read from `SummaryContext` (a pre-extracted view of the event) and
// use the helpers below to format their payload.
//
// HOW TO TWEAK
// ────────────
// • Change wording for a kind          → edit that rule's handler.
// • Add a special case (e.g. a method) → write a new rule, insert it into
//                                        SUMMARY_RULES *before* the generic
//                                        rule it should override.
// • Truncate / redact differently      → edit `clip`, `safePrimitive`, or
//                                        `summarizeValue`.
//
// Order matters. Specific rules go first, generic kind-based rules last.

import type { AhpEvent } from "@ahp-inspector/shared";

// ── Context ──────────────────────────────────────────────────────────────────

/** Pre-extracted view of an event, passed to every summary rule. */
export interface SummaryContext {
  readonly event: AhpEvent;
  /** `event.raw` as a plain object record, or null if not an object. */
  readonly raw: Record<string, unknown> | null;
  /** `raw.params` as a record, or null. */
  readonly params: Record<string, unknown> | null;
  /** `params.action` as a record, or null. */
  readonly action: Record<string, unknown> | null;
  /** `params.notification` as a record, or null. */
  readonly notification: Record<string, unknown> | null;
  /** Method of the correlated request, when this event is a response. */
  readonly pairMethod: string | null;
}

/** A summary rule. Return null to defer to the next rule. */
export interface SummaryRule {
  readonly name: string;
  readonly handler: (ctx: SummaryContext) => string | null;
}

const FALLBACK_SUMMARY = "event details unavailable";

// ── Public entry point ───────────────────────────────────────────────────────

export function summarizeEvent(event: AhpEvent, pairMethod: string | null): string {
  const ctx = makeContext(event, pairMethod);
  for (const rule of SUMMARY_RULES) {
    const result = rule.handler(ctx);
    if (result !== null) return result;
  }
  const methodOrType = event.method ?? event.actionType;
  return `${methodOrType ?? "event"} details unavailable` || FALLBACK_SUMMARY;
}

function makeContext(event: AhpEvent, pairMethod: string | null): SummaryContext {
  const raw = objectRecord(event.raw);
  const params = childRecord(raw, "params");
  return {
    event,
    raw,
    params,
    action: childRecord(params, "action"),
    notification: childRecord(params, "notification"),
    pairMethod,
  };
}

// ── Rules (order matters: specific → generic) ────────────────────────────────

/** Tolerant fallback envelopes emitted when JSONL parsing fails. */
const parseErrorRule: SummaryRule = {
  name: "parse-error",
  handler: ({ event }) => {
    if (event.kind !== "parse-error") return null;
    const reason = event.parseError?.reason ?? "unknown parse error";
    return `parse error line ${event.seq + 1}: ${reason}`;
  },
};

/** Any JSON-RPC response carrying an `error` object. */
const errorResponseRule: SummaryRule = {
  name: "error-response",
  handler: ({ raw }) => {
    const error = childRecord(raw, "error");
    if (!error) return null;
    const code = error.code;
    const message = firstString(error.message, stringField(childRecord(error, "data"), "message"));
    const codeText = typeof code === "number" || typeof code === "string" ? String(code) : "unknown";
    return `error ${codeText}: ${message ? clip(message) : "details unavailable"}`;
  },
};

/** Successful JSON-RPC response — pulled to top so other rules don't snag it. */
const responseRule: SummaryRule = {
  name: "response",
  handler: ({ event, raw, pairMethod }) => {
    if (event.kind !== "response") return null;
    const result = raw?.result;
    const resultText = result === undefined ? "empty result" : summarizeValue(result);
    return pairMethod ? `${pairMethod} result ${resultText}` : `result ${resultText}`;
  },
};

/** `resourceList` always reports a single URI in a stable shape. */
const resourceListRule: SummaryRule = {
  name: "resourceList",
  handler: ({ event, params }) => {
    if (event.method !== "resourceList") return null;
    const uri = resourceUri(params);
    return `uri=${uri ? safePathLabel(uri) : "details unavailable"}`;
  },
};

/**
 * `dispatchAction` wraps an inner `action.type` that is the entire useful
 * payload for the timeline. Show just the type so it doesn't repeat the
 * Event-column label.
 */
const dispatchActionRule: SummaryRule = {
  name: "dispatchAction",
  handler: ({ event, action, params }) => {
    if (event.method !== "dispatchAction") return null;
    return stringField(action, "type") ?? summarizeValue(params);
  },
};

/** Streaming text deltas from the model: `delta` or `text` action envelopes. */
const deltaTextRule: SummaryRule = {
  name: "delta/text",
  handler: ({ event, params, action, raw }) => {
    const type = event.actionType ?? "";
    if (!/delta/i.test(type) && !/^text$/i.test(type)) return null;
    const text = firstString(
      params?.delta,
      params?.content,
      params?.text,
      params?.message,
      action?.delta,
      action?.content,
      action?.text,
      action?.message,
      childRecord(raw, "result")?.content,
      childRecord(raw, "result")?.text,
    );
    if (!text) return null;
    return /delta/i.test(type) ? `delta "${clip(text)}"` : `text "${clip(text)}"`;
  },
};

/** `tool.call` action — name + summarized args. */
const toolCallRule: SummaryRule = {
  name: "tool-call",
  handler: ({ event, action, params }) => {
    if (!/tool[._-]?call/i.test(event.actionType ?? "")) return null;
    const name = toolName(action, params) ?? toolCallId(event, action, params) ?? "unknown";
    const args = action?.args ?? params?.args ?? {};
    return `tool call ${name} ${summarizeValue(args)}`;
  },
};

/** `tool.result` action — name + summarized result payload. */
const toolResultRule: SummaryRule = {
  name: "tool-result",
  handler: ({ event, action, params, raw }) => {
    if (!/tool[._-]?result/i.test(event.actionType ?? "")) return null;
    const name = toolName(action, params) ?? toolCallId(event, action, params) ?? "unknown";
    const payload = action?.result ?? params?.result ?? raw?.result;
    return `tool result ${name} ${summarizeValue(payload)}`;
  },
};

/** `status` / `progress` action envelopes — show the state/message. */
const statusProgressRule: SummaryRule = {
  name: "status/progress",
  handler: ({ event, action, params }) => {
    if (!/status|progress/i.test(event.actionType ?? "")) return null;
    const state = firstString(action?.state, action?.message, params?.state, params?.message);
    return `status ${state ? clip(state) : "details unavailable"}`;
  },
};

/** Server-emitted protocol notifications (`method: "notification"`). */
const protocolNotificationRule: SummaryRule = {
  name: "protocol-notification",
  handler: ({ event, notification, params }) => {
    if (event.kind !== "protocol-notification") return null;
    const notifType = event.actionType ?? stringField(notification, "type") ?? null;
    const payload = notification ?? params;
    const state = firstString(payload?.state, payload?.status);
    const message = firstString(payload?.message, payload?.text, payload?.detail, payload?.reason);
    if (notifType && state) return `${notifType} ${clip(state)}`;
    if (notifType && message) return `${notifType} ${clip(message)}`;
    if (notifType) return `${notifType} ${summarizeValue(payload)}`;
    return summarizeValue(payload);
  },
};

/** Generic client/server notifications. dispatchAction is handled earlier. */
const notificationRule: SummaryRule = {
  name: "notification",
  handler: ({ event, action, params }) => {
    if (event.kind !== "client-notification" && event.kind !== "server-notification") return null;
    const inner = innerActionTypeAndDetail(action);
    if (inner) return inner;
    const message = firstString(params?.message, params?.text, params?.detail, params?.reason);
    if (message) return clip(message);
    const state = firstString(params?.state, params?.status);
    if (state) return clip(state);
    return summarizeValue(params);
  },
};

/** Generic JSON-RPC requests not handled by a method-specific rule above. */
const requestRule: SummaryRule = {
  name: "request",
  handler: ({ event, action, params }) => {
    if (event.kind !== "request") return null;
    const inner = innerActionTypeAndDetail(action);
    if (inner) return inner;
    return summarizeValue(params);
  },
};

/** Transport-level log lines. */
const logRule: SummaryRule = {
  name: "log",
  handler: ({ event, params, raw }) => {
    if (event.kind !== "log") return null;
    const message = firstString(params?.message, raw?.message) ?? "details unavailable";
    return `log ${clip(message)}`;
  },
};

/** Bare `action` envelopes that didn't match a more specific action rule. */
const actionRule: SummaryRule = {
  name: "action",
  handler: ({ event }) => {
    if (event.kind !== "action") return null;
    return event.actionType ? `action ${event.actionType}` : "action details unavailable";
  },
};

/**
 * Last-resort rule. Always matches; emits `<method-or-type> details unavailable`.
 * Keep at the end of SUMMARY_RULES.
 */
const fallbackRule: SummaryRule = {
  name: "fallback",
  handler: ({ event }) => {
    const methodOrType = event.method ?? event.actionType;
    return `${methodOrType ?? "event"} details unavailable`;
  },
};

/** Ordered list of rules. First non-null match wins. */
export const SUMMARY_RULES: readonly SummaryRule[] = [
  parseErrorRule,
  errorResponseRule,
  responseRule,
  resourceListRule,
  dispatchActionRule,
  deltaTextRule,
  toolCallRule,
  toolResultRule,
  statusProgressRule,
  protocolNotificationRule,
  notificationRule,
  requestRule,
  logRule,
  actionRule,
  fallbackRule,
];

// ── Shared shape helpers (used by multiple rules) ────────────────────────────

/**
 * For request / notification envelopes whose `params.action` carries an inner
 * `type` plus extra fields. Returns `"<type> <detail>"` or just `"<type>"` if
 * the rest summarizes to nothing useful.
 */
function innerActionTypeAndDetail(
  action: Record<string, unknown> | null,
): string | null {
  if (!action) return null;
  const type = stringField(action, "type");
  if (!type) return null;
  const rest = { ...action };
  delete (rest as Record<string, unknown>).type;
  const detail = summarizeValue(rest);
  return detail === "{…}" || detail === "empty" ? type : `${type} ${detail}`;
}

function toolName(
  action: Record<string, unknown> | null,
  params: Record<string, unknown> | null,
): string | null {
  return firstString(
    params?.toolName,
    params?.name,
    stringField(childRecord(params, "tool"), "name"),
    action?.toolName,
    action?.name,
  );
}

function toolCallId(
  event: AhpEvent,
  action: Record<string, unknown> | null,
  params: Record<string, unknown> | null,
): string | null {
  return event.toolCallId ?? firstString(params?.toolCallId, action?.toolCallId);
}

function resourceUri(params: Record<string, unknown> | null): string | null {
  if (!params) return null;
  const resource = params.resource;
  const resources = params.resources;
  const fromResource =
    typeof resource === "string"
      ? resource
      : typeof resource === "object" && resource !== null
        ? stringField(resource as Record<string, unknown>, "uri")
        : null;
  const firstResource =
    Array.isArray(resources) && typeof resources[0] === "object" && resources[0] !== null
      ? stringField(resources[0] as Record<string, unknown>, "uri")
      : null;
  return firstString(params.uri, fromResource, firstResource, params.path);
}

// ── Generic value formatters (exported so custom rules can reuse them) ───────

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

/**
 * Render a single key/value pair for `summarizeValue`. Redacts secrets and
 * shortens path-ish values; objects/arrays get a placeholder.
 */
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

/**
 * One-line description of an unknown value. Used as the generic last-resort
 * formatter inside most rules.
 */
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

// ── Tiny accessor helpers ────────────────────────────────────────────────────

export function objectRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

export function childRecord(
  parent: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!parent) return null;
  return objectRecord(parent[key]);
}

export function stringField(
  parent: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!parent) return null;
  const value = parent[key];
  return typeof value === "string" ? value : null;
}

export function firstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return null;
}
