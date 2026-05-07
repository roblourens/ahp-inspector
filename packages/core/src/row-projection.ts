import type { AhpEvent, Direction, EventKind } from "@ahp-viewer/shared";
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
  // Parse-error specifics; null/empty for ok events.
  readonly parseErrorReason: string | null;
  readonly lineIndex: number | null; // 1-based source line; from seq+1
}

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

export function projectRow(
  event: AhpEvent,
  idx: number,
  status: Status,
  latencyMs: number | null,
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
      parseErrorReason: event.parseError?.reason ?? "unknown parse error",
      lineIndex: event.seq + 1,
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
    sessionShort: session ? session.slice(-8) : null,
    turnId: turn,
    turnShort: turn ? turn.slice(-6) : null,
    keyId: idStr ? (idStr.length > 12 ? idStr.slice(0, 12) : idStr) : null,
    status,
    latencyMs,
    latencyBand: bandFor(latencyMs),
    payloadPreview: payloadPreviewOf(event.raw),
    parseErrorReason: null,
    lineIndex: null,
  };
}
