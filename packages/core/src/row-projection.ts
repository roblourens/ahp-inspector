import type { AhpEvent, Direction, EventKind } from "@ahp-inspector/shared";
import type { Status } from "./types.js";

export type LatencyBand = "fast" | "normal" | "slow" | "critical";
export type ActionFamily = "text" | "tool-call" | "tool-result" | "status" | "unknown";
export type KindTag = "REQ" | "RES" | "NTF" | "ACT" | "BAD" | "LOG";
export type DirGlyph = "→" | "←" | "·";

/** EventRow — locked Phase-2 row projection contract.
 *  Consumed by: server projector (snapshot/append SSE frames),
 *               UI <EventRow> component, UI virtualization tests.
 *  Adding fields is non-breaking; renaming/removing is breaking. */
export interface EventRow {
  readonly idx: number; // EventStore index; stable selection key
  readonly seq: number;
  readonly ts: number; // epoch ms
  readonly tsFmt: string; // 'HH:mm:ss.SSS' UTC
  readonly dir: Direction;
  readonly dirGlyph: DirGlyph;
  readonly kind: EventKind;
  readonly kindTag: KindTag;
  readonly method: string | null;
  readonly actionType: string | null;
  readonly actionFamily: ActionFamily | null;
  readonly sessionId: string | null;
  readonly sessionShort: string | null;
  readonly turnId: string | null;
  readonly turnShort: string | null;
  readonly keyId: string | null;
  readonly status: Status;
  readonly latencyMs: number | null;
  readonly latencyBand: LatencyBand | null;
  readonly payloadPreview: string;
  readonly summary?: string;
  readonly pairIdx?: number | null;
  // Parse-error specifics; null/empty for ok events.
  readonly parseErrorReason: string | null;
  readonly lineIndex: number | null; // 1-based source line; from seq+1
  // Phase 3 additions — additive, non-breaking (row-projection.ts:9-13)
  readonly errorCode: number | null;
  readonly serverSeq: number | null;
  readonly previousServerSeq: number | null;
  readonly gapBefore: boolean;
  readonly isAuthFailure: boolean;
}

/** Phase 3 additive extras — computed in AppState before projectRow call. */
export interface EventRowExtras {
  readonly errorCode: number | null;
  readonly serverSeq: number | null;
  readonly previousServerSeq: number | null;
  readonly gapBefore: boolean;
  readonly isAuthFailure: boolean;
  readonly pairIdx?: number | null;
}

const DEFAULT_EXTRAS: EventRowExtras = {
  errorCode: null,
  serverSeq: null,
  previousServerSeq: null,
  gapBefore: false,
  isAuthFailure: false,
  pairIdx: null,
};

export function bandFor(latencyMs: number | null): LatencyBand | null {
  if (latencyMs === null || latencyMs < 0) return null;
  if (latencyMs < 50) return "fast";
  if (latencyMs < 200) return "normal";
  if (latencyMs < 1000) return "slow";
  return "critical";
}

export function dirGlyphFor(dir: Direction): DirGlyph {
  return dir === "c2s" ? "→" : dir === "s2c" ? "←" : "·";
}

const KIND_TAG: Record<EventKind, KindTag> = {
  request: "REQ",
  response: "RES",
  "client-notification": "NTF",
  "server-notification": "NTF",
  "protocol-notification": "NTF",
  action: "ACT",
  "parse-error": "BAD",
  log: "LOG",
};

export function kindTagFor(kind: EventKind): KindTag {
  return KIND_TAG[kind];
}

export function actionFamilyFor(kind: EventKind, actionType: string | null): ActionFamily | null {
  if (kind !== "action") return null;
  if (!actionType) return "unknown";
  if (/^text$/i.test(actionType)) return "text";
  if (/^tool[._-]?call/i.test(actionType)) return "tool-call";
  if (/^tool[._-]?result/i.test(actionType)) return "tool-result";
  if (/^status/i.test(actionType)) return "status";
  return "unknown";
}

export function formatTs(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, w = 2): string => String(n).padStart(w, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(
    d.getUTCMilliseconds(),
    3,
  )}`;
}

export function formatSessionShort(sessionId: string): string {
  const parts = sessionId.split(/[/:]+/).filter(Boolean);
  let label = parts.at(-1) ?? sessionId;
  label = label.replace(/^session[-_:]?/i, "");
  label = label.replace(/[-_]\d{4}[-_]\d{2}[-_]\d{2}$/u, "");

  if (/^[0-9a-f]{16,}$/iu.test(label)) return label.slice(-8);
  const uuidFirstSegment = label.match(/^[0-9a-f]{8}(?=-[0-9a-f]{4}-)/iu)?.[0];
  if (uuidFirstSegment) return uuidFirstSegment;
  if (label.length <= 18) return label;
  return `${label.slice(0, 17)}…`;
}

export function payloadPreviewOf(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  let src: unknown = raw;
  if (typeof raw === "object" && raw !== null) {
    const r = raw as Record<string, unknown>;
    src = r.params ?? r.result ?? raw;
  }
  let s: string;
  try {
    s = JSON.stringify(src) ?? "";
  } catch {
    s = "";
  }
  s = s.replace(/\s+/g, " ");
  return s.length > 120 ? s.slice(0, 120) : s;
}

function objectRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function childRecord(
  parent: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!parent) return null;
  return objectRecord(parent[key]);
}

function stringField(parent: Record<string, unknown> | null, key: string): string | null {
  if (!parent) return null;
  const value = parent[key];
  return typeof value === "string" ? value : null;
}

function firstString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return null;
}

function clip(text: string, max = 80): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return "empty";
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function safePathLabel(value: string): string {
  const parts = value.split(/[\\/]/).filter(Boolean);
  const last = parts.at(-1);
  return last ?? value;
}

function safePrimitive(key: string, value: unknown): string | null {
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

function summarizeValue(value: unknown): string {
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

function paramsOf(raw: unknown): Record<string, unknown> | null {
  return childRecord(objectRecord(raw), "params");
}

function resultOf(raw: unknown): unknown {
  return objectRecord(raw)?.result;
}

function errorSummary(raw: unknown): string | null {
  const error = childRecord(objectRecord(raw), "error");
  if (!error) return null;
  const code = error.code;
  const message = firstString(error.message, stringField(childRecord(error, "data"), "message"));
  const codeText = typeof code === "number" || typeof code === "string" ? String(code) : "unknown";
  return `error ${codeText}: ${message ? clip(message) : "details unavailable"}`;
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

function actionOf(params: Record<string, unknown> | null): Record<string, unknown> | null {
  return childRecord(params, "action");
}

function notificationOf(params: Record<string, unknown> | null): Record<string, unknown> | null {
  return childRecord(params, "notification");
}

function eventSummaryOf(event: AhpEvent, _status: Status, pairMethod: string | null): string {
  if (event.kind === "parse-error") {
    return `parse error line ${event.seq + 1}: ${event.parseError?.reason ?? "unknown parse error"}`;
  }
  const raw = objectRecord(event.raw);
  const params = paramsOf(event.raw);
  const action = actionOf(params);
  const notification = notificationOf(params);

  const err = errorSummary(event.raw);
  if (err) return err;

  if (event.kind === "response") {
    const result = resultOf(event.raw);
    const resultText = result === undefined ? "empty result" : summarizeValue(result);
    return pairMethod ? `${pairMethod} result ${resultText}` : `result ${resultText}`;
  }

  const methodOrType = event.method ?? event.actionType;
  if (methodOrType === "resourceList" || event.method === "resourceList") {
    const uri = resourceUri(params);
    return `resourceList uri=${uri ? safePathLabel(uri) : "details unavailable"}`;
  }

  const delta = firstString(
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
  const type = event.actionType ?? "";
  if (/delta/i.test(type) && delta) return `delta "${clip(delta)}"`;
  if (/^text$/i.test(type) && delta) return `text "${clip(delta)}"`;

  const toolName = firstString(
    params?.toolName,
    params?.name,
    stringField(childRecord(params, "tool"), "name"),
    action?.toolName,
    action?.name,
  );
  const toolCallId = event.toolCallId ?? firstString(params?.toolCallId, action?.toolCallId);
  if (/tool[._-]?call/i.test(type)) {
    const args = action?.args ?? params?.args ?? {};
    const details = summarizeValue(args);
    return `tool call ${toolName ?? toolCallId ?? "unknown"} ${details}`;
  }
  if (/tool[._-]?result/i.test(type)) {
    const details = summarizeValue(action?.result ?? params?.result ?? resultOf(event.raw));
    return `tool result ${toolName ?? toolCallId ?? "unknown"} ${details}`;
  }

  if (/status|progress/i.test(type)) {
    const state = firstString(action?.state, action?.message, params?.state, params?.message);
    return `status ${state ? clip(state) : "details unavailable"}`;
  }

  if (event.kind === "protocol-notification") {
    const notifType = event.actionType ?? stringField(notification, "type") ?? "notification";
    return `notification ${notifType} ${summarizeValue(notification ?? params)}`;
  }
  if (event.kind === "client-notification" || event.kind === "server-notification") {
    return `${event.method ?? "notification"} ${summarizeValue(params)}`;
  }
  if (event.kind === "request") {
    return `${event.method ?? "request"} ${summarizeValue(params)}`;
  }
  if (event.kind === "log") {
    return `log ${clip(firstString(params?.message, raw?.message) ?? "details unavailable")}`;
  }
  if (event.kind === "action") {
    return event.actionType ? `action ${event.actionType}` : "action details unavailable";
  }
  return `${methodOrType ?? "event"} details unavailable`;
}

function capSummary(summary: string): string {
  return summary.length > 160 ? `${summary.slice(0, 159)}…` : summary;
}

export function projectRow(
  event: AhpEvent,
  idx: number,
  status: Status,
  latencyMs: number | null,
  extras: EventRowExtras = DEFAULT_EXTRAS,
  pairMethod: string | null = null,
): EventRow {
  if (event.kind === "parse-error") {
    return {
      idx,
      seq: event.seq,
      ts: event.ts,
      tsFmt: formatTs(event.ts),
      dir: event.dir,
      dirGlyph: dirGlyphFor(event.dir),
      kind: event.kind,
      kindTag: "BAD",
      method: null,
      actionType: null,
      actionFamily: null,
      sessionId: null,
      sessionShort: null,
      turnId: null,
      turnShort: null,
      keyId: null,
      status: "n/a",
      latencyMs: null,
      latencyBand: null,
      payloadPreview: "",
      summary: capSummary(eventSummaryOf(event, "n/a", null)),
      pairIdx: null,
      parseErrorReason: event.parseError?.reason ?? "unknown parse error",
      lineIndex: event.seq + 1,
      ...DEFAULT_EXTRAS,
    };
  }
  const session = event.sessionId;
  const turn = event.turnId;
  const idStr = event.id === null ? null : String(event.id);
  return {
    idx,
    seq: event.seq,
    ts: event.ts,
    tsFmt: formatTs(event.ts),
    dir: event.dir,
    dirGlyph: dirGlyphFor(event.dir),
    kind: event.kind,
    kindTag: kindTagFor(event.kind),
    method: event.method,
    actionType: event.actionType,
    actionFamily: actionFamilyFor(event.kind, event.actionType),
    sessionId: session,
    sessionShort: session ? formatSessionShort(session) : null,
    turnId: turn,
    turnShort: turn ? turn.slice(-6) : null,
    keyId: idStr ? (idStr.length > 12 ? idStr.slice(0, 12) : idStr) : null,
    status,
    latencyMs,
    latencyBand: bandFor(latencyMs),
    payloadPreview: payloadPreviewOf(event.raw),
    summary: capSummary(eventSummaryOf(event, status, pairMethod)),
    pairIdx: extras.pairIdx ?? null,
    parseErrorReason: null,
    lineIndex: null,
    ...extras,
  };
}
