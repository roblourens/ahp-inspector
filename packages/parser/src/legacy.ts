// Legacy human-readable sample-log adapter.
//
// Reads VS Code's current `~/agenthost.*.log` text format (header line +
// indented JSON block) and emits canonical AhpEvents through normalize().
//
// This module is intentionally isolated (Pitfall 6): it exports EXACTLY two
// functions and is NOT re-exported from `@ahp-viewer/parser`'s main barrel.
// Only the parser's own tests may import it. A regex-grep test in
// `legacy.test.ts` enforces both invariants.

import type { AhpEvent, Direction, NormalizeMeta } from "@ahp-viewer/shared";
import { makeParseErrorEvent } from "@ahp-viewer/shared";
import { normalize } from "./normalizer.js";

const HEADER_RE = /^\[(?<ts>[^\]]+)\]\s+(?<marker>>>|<<|!!|\*\*)\s+(?<label>\S+)/;

// Portable byte-length: avoid Node's `Buffer` so the parser stays runnable
// in a browser/webview context (T-03).
const TEXT_ENCODER = new TextEncoder();
function utf8ByteLength(s: string): number {
  return TEXT_ENCODER.encode(s).length;
}

interface LegacyMeta {
  readonly seq: number;
  readonly byteOffset: number;
  readonly byteLength: number;
}

function dirFromMarker(marker: string): Direction {
  // `>>` is the only client→server marker. `<<`, `!!`, `**` are all s2c
  // (response, server-side error, action / notification respectively).
  return marker === ">>" ? "c2s" : "s2c";
}

/**
 * Parse a single legacy block (`[ISO] marker label` header + indented
 * JSON payload) into an AhpEvent via normalize(). Never throws.
 */
export function parseLegacyBlock(
  headerLine: string,
  payloadBlock: string,
  meta: LegacyMeta,
): AhpEvent {
  const h = HEADER_RE.exec(headerLine);
  if (!h?.groups) {
    return makeParseErrorEvent(
      {
        seq: meta.seq,
        ts: Date.now(),
        tsRaw: headerLine,
        dir: "c2s",
        byteOffset: meta.byteOffset,
        byteLength: meta.byteLength,
      },
      "unrecognised header",
      headerLine,
    );
  }
  const tsRaw = h.groups.ts ?? "";
  const marker = h.groups.marker ?? ">>";
  const dir = dirFromMarker(marker);
  const parsedTs = Date.parse(tsRaw);
  const ts = Number.isFinite(parsedTs) ? parsedTs : Date.now();

  const trimmed = payloadBlock.trim();
  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return makeParseErrorEvent(
      {
        seq: meta.seq,
        ts,
        tsRaw,
        dir,
        byteOffset: meta.byteOffset,
        byteLength: meta.byteLength,
      },
      "legacy payload not JSON",
      trimmed.slice(0, 8 * 1024),
    );
  }

  const normMeta: NormalizeMeta = {
    seq: meta.seq,
    dir,
    ts,
    tsRaw,
    byteOffset: meta.byteOffset,
    byteLength: meta.byteLength,
  };
  return normalize(payload, normMeta);
}

/**
 * Walk a synthesised legacy log: each header line is followed by an
 * indented JSON body until the next header (or EOF). Every block is
 * routed through {@link parseLegacyBlock} so the adapter never constructs
 * an AhpEvent directly.
 */
export function parseLegacyStream(text: string): AhpEvent[] {
  const lines = text.split(/\r?\n/);
  const out: AhpEvent[] = [];
  let i = 0;
  let seq = 0;
  let byteOffset = 0;

  const isHeader = (line: string): boolean => HEADER_RE.test(line);

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.length === 0) {
      byteOffset += 1; // for the consumed newline
      i += 1;
      continue;
    }
    if (isHeader(line)) {
      const headerLine = line;
      const headerByteLen = utf8ByteLength(headerLine);
      const blockStart = byteOffset;
      let bodyByteLen = 0;
      const bodyParts: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j] ?? "";
        if (next.length > 0 && isHeader(next)) break;
        bodyParts.push(next);
        bodyByteLen += utf8ByteLength(next) + 1; // +1 for \n
        j += 1;
      }
      const blockByteLen = headerByteLen + 1 + bodyByteLen; // +1 = header's \n
      out.push(
        parseLegacyBlock(headerLine, bodyParts.join("\n"), {
          seq,
          byteOffset: blockStart,
          byteLength: blockByteLen,
        }),
      );
      seq += 1;
      byteOffset += blockByteLen;
      i = j;
    } else {
      // Stray non-header, non-blank line — flag it so silent log drift is visible.
      out.push(
        makeParseErrorEvent(
          {
            seq,
            ts: Date.now(),
            tsRaw: line,
            dir: "c2s",
            byteOffset,
            byteLength: utf8ByteLength(line),
          },
          "unrecognised header",
          line,
        ),
      );
      seq += 1;
      byteOffset += utf8ByteLength(line) + 1;
      i += 1;
    }
  }

  return out;
}
