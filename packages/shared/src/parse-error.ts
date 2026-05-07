import type { AhpEvent, NormalizeMeta } from "./event.js";

/** Maximum bytes of raw line text retained on a parse-error event. */
export const MAX_RAW_TEXT_BYTES = 8 * 1024;

export interface ParseErrorDetail {
  readonly reason: string;
  readonly rawText: string;
}

/**
 * Build a canonical AhpEvent representing a parse failure.
 *
 * Defensive: caps `rawText` at {@link MAX_RAW_TEXT_BYTES} so adversarial
 * megabyte-sized lines cannot bloat memory or downstream logs (T-02-03).
 */
export function makeParseErrorEvent(
  meta: NormalizeMeta,
  reason: string,
  rawText: string,
): AhpEvent {
  const capped =
    rawText.length > MAX_RAW_TEXT_BYTES ? rawText.slice(0, MAX_RAW_TEXT_BYTES) : rawText;
  return {
    seq: meta.seq,
    ts: meta.ts,
    tsRaw: meta.tsRaw,
    dir: meta.dir,
    kind: "parse-error",
    method: null,
    actionType: null,
    id: null,
    idType: "null",
    sessionId: null,
    turnId: null,
    toolCallId: null,
    serverSeq: null,
    byteOffset: meta.byteOffset,
    byteLength: meta.byteLength,
    raw: undefined,
    parse: "error",
    parseError: { reason, rawText: capped },
  };
}
