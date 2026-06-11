import type { AhpEvent, Direction, EventKind } from "@ahp-inspector/shared";
import { summarizeEvent } from "./summary.js";
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
  const watched = formatResourceWatchChannel(sessionId);
  if (watched) return watched;

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

/**
 * Resource-watch channels look like `ahp-resource-watch://r/<base64>` where the
 * base64 payload is JSON such as `{"root":"file:///…/settings.json"}`. Decode
 * it so the timeline shows the watched resource (e.g. `watch:settings.json`)
 * instead of an opaque base64 blob.
 */
function formatResourceWatchChannel(sessionId: string): string | null {
  const match = sessionId.match(/^ahp-resource-watch:\/\/[^/]*\/(.+)$/u);
  if (!match) return null;
  const encoded = match[1];
  if (!encoded) return null;
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalized);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const root = parsed.root ?? parsed.uri ?? parsed.resource;
    if (typeof root !== "string") return null;
    const tail = root.split(/[/\\]/u).filter(Boolean).at(-1) ?? root;
    const name = decodeURIComponent(tail);
    return `watch:${name.length <= 24 ? name : `${name.slice(0, 23)}…`}`;
  } catch {
    return null;
  }
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

function capSummary(summary: string): string {
  return summary.length > 160 ? `${summary.slice(0, 159)}…` : summary;
}

/**
 * Compute the label shown in the timeline's Event column. Mirrors the UI's
 * `primaryLabel` so projection-side post-processing can avoid emitting a
 * summary that just repeats it.
 */
function primaryLabelFor(
  kind: AhpEvent["kind"],
  method: string | null,
  actionType: string | null,
): string | null {
  if (kind === "action" || kind === "protocol-notification") return actionType ?? method;
  return method ?? actionType;
}

/** Strip the Event-column label from the start of summary so it adds info. */
function dropLabelPrefix(summary: string, label: string | null): string {
  if (!label) return summary;
  const lc = summary.toLowerCase();
  const lcLabel = label.toLowerCase();
  if (lc === lcLabel) return summary;
  if (!lc.startsWith(`${lcLabel} `)) return summary;
  const stripped = summary.slice(label.length).trim();
  return stripped.length > 0 ? stripped : summary;
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
      summary: capSummary(summarizeEvent(event, null)),
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
    summary: capSummary(
      dropLabelPrefix(
        summarizeEvent(event, pairMethod),
        primaryLabelFor(event.kind, event.method, event.actionType),
      ),
    ),
    pairIdx: extras.pairIdx ?? null,
    parseErrorReason: null,
    lineIndex: null,
    ...extras,
  };
}
