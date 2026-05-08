// JSON-RPC discriminator → canonical AhpEvent. Never throws.
// 01-RESEARCH.md Code Examples (Normalizer discriminant).
//
// Locked policy (RESEARCH line 202): one event per JSONL line.
//   - method:'action'        (s2c)  → kind:'action'                + lift action.type / serverSeq
//   - method:'notification'  (s2c)  → kind:'protocol-notification' + lift notification.type
//   - other notifications           → kind:'client|server-notification' (by dir)
//   - request / response            → kind:'request' / 'response'
//   - anything else                 → kind:'parse-error' via makeParseErrorEvent

import type { ActionEnvelope, ProtocolNotification } from "@ahp-viewer/protocol";
import type { AhpEvent, EventKind, IdType, NormalizeMeta } from "@ahp-viewer/shared";
import { makeParseErrorEvent } from "@ahp-viewer/shared";
import { extractSessionId, extractToolCallId, extractTurnId } from "./extract.js";

function coerceId(v: unknown): number | string | null {
  if (typeof v === "number" || typeof v === "string" || v === null) return v;
  // booleans/objects/etc → treat as null id (Pitfall 1); never crash.
  return null;
}

function safeStringify(raw: unknown): string {
  try {
    return JSON.stringify(raw) ?? "";
  } catch {
    return String(raw);
  }
}

/**
 * Convert one parsed payload into a canonical AhpEvent. Never throws —
 * any unexpected shape is folded into a `kind:'parse-error'` event.
 */
export function normalize(raw: unknown, meta: NormalizeMeta): AhpEvent {
  if (typeof raw !== "object" || raw === null) {
    return makeParseErrorEvent(meta, "non-object payload", safeStringify(raw));
  }
  const m = raw as Record<string, unknown>;

  const hasMethod = typeof m.method === "string";
  const hasId = "id" in m;
  const hasResult = "result" in m;
  const hasError = "error" in m;

  let kind: EventKind;
  let actionType: string | null = null;
  let serverSeq: number | null = null;

  if (hasMethod && hasId) {
    kind = "request";
  } else if (hasId && (hasResult || hasError)) {
    kind = "response";
  } else if (hasMethod) {
    if (m.method === "action" && meta.dir === "s2c") {
      const env = (m.params ?? {}) as Partial<ActionEnvelope>;
      kind = "action";
      const action = (env as { action?: { type?: unknown } }).action;
      actionType =
        action && typeof action === "object" && typeof action.type === "string"
          ? action.type
          : null;
      serverSeq = typeof env.serverSeq === "number" ? env.serverSeq : null;
    } else if (m.method === "notification" && meta.dir === "s2c") {
      const params = (m.params ?? {}) as { notification?: ProtocolNotification };
      kind = "protocol-notification";
      const notif = params.notification;
      actionType =
        notif && typeof notif === "object" && typeof (notif as { type?: unknown }).type === "string"
          ? (notif as { type: string }).type
          : null;
    } else {
      kind = meta.dir === "c2s" ? "client-notification" : "server-notification";
    }
  } else {
    return makeParseErrorEvent(meta, "unrecognised JSON-RPC shape", safeStringify(raw));
  }

  const id = hasId ? coerceId(m.id) : null;
  const idType: IdType = id === null ? "null" : typeof id === "number" ? "number" : "string";

  const method = typeof m.method === "string" ? m.method : null;
  const params = m.params;
  const sessionId = extractSessionId(method, params);
  const turnId = extractTurnId(method, params);
  const toolCallId = extractToolCallId(method, params);

  return {
    seq: meta.seq,
    ts: meta.ts,
    tsRaw: meta.tsRaw,
    dir: meta.dir,
    kind,
    method,
    actionType,
    id,
    idType,
    sessionId,
    turnId,
    toolCallId,
    serverSeq,
    byteOffset: meta.byteOffset,
    byteLength: meta.byteLength,
    raw,
    parse: "ok",
  };
}
