// Streaming JSONL line splitter and per-line tolerant parser.
//
// Pattern 2 + 3 from 01-RESEARCH.md. Both surfaces are pure: no I/O, no
// throws on bad input. Caller (LogStream feeder, Plan 03) owns chunk
// boundaries, byte-offset accounting, and dispatch into normalize().

/**
 * Maximum bytes the splitter will buffer waiting for the next newline.
 *
 * If a single unterminated "line" exceeds this, `push` throws
 * {@link ParseOverflowError} so the caller can decide whether to emit a
 * parse-error event or abort. Mitigates T-02-01 (parse DoS via 100 GB
 * unterminated line — RESEARCH §"Security Domain").
 */
export const MAX_BUF_BYTES = 16 * 1024 * 1024;

export class ParseOverflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseOverflowError";
  }
}

/**
 * Streaming line splitter. Holds a partial trailing line until the next
 * chunk arrives. Strips a leading BOM exactly once per stream (Pitfall 4)
 * so an inline U+FEFF inside a JSON string later in the file survives.
 */
export class LineSplitter {
  private buf = "";
  private bomConsumed = false;

  /**
   * Push a chunk; returns zero or more complete lines (without trailing
   * `\n` or `\r`). Holds any partial trailing line for the next call.
   *
   * @throws {ParseOverflowError} when the internal buffer would exceed
   *   {@link MAX_BUF_BYTES} before a newline is seen.
   */
  push(chunk: string): string[] {
    let s = chunk;
    if (!this.bomConsumed) {
      if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
      this.bomConsumed = true;
    }
    s = this.buf + s;
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 0x0a /* \n */) {
        let end = i;
        if (end > start && s.charCodeAt(end - 1) === 0x0d /* \r */) end--;
        // Emit even when empty so parseLine can flag the empty line —
        // VERIFY-01 fixtures rely on 1:1 line-in / line-out.
        out.push(s.slice(start, end));
        start = i + 1;
      }
    }
    const tail = s.slice(start);
    if (tail.length > MAX_BUF_BYTES) {
      // Reset state so subsequent pushes do not keep amplifying the failure.
      this.buf = "";
      throw new ParseOverflowError(
        `LineSplitter tail buffer exceeded ${MAX_BUF_BYTES} bytes without a newline`,
      );
    }
    this.buf = tail;
    return out;
  }

  /**
   * Drop the buffered partial-line state. Used after a rotation/shrink so the
   * next `push()` starts cleanly from offset 0 (Phase 4 INGEST-04). Also
   * clears the BOM-consumed flag so a freshly rotated file behaves like a
   * brand-new splitter instance.
   */
  reset(): void {
    this.buf = "";
    this.bomConsumed = false;
  }

  /** Flush any remaining buffered bytes as a final line. Idempotent. */
  flush(): string[] {
    if (this.buf.length === 0) return [];
    const last = this.buf;
    this.buf = "";
    return [last];
  }
}

/** Result of {@link parseLine}: the parsed JSON or a structured error. */
export interface ParsedLine {
  readonly raw: unknown;
  readonly text: string;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly error?: { reason: string };
}

/**
 * Tolerant per-line JSON parser. Never throws.
 *
 * - Empty / whitespace-only line → `error.reason === 'empty-line'`.
 * - Invalid JSON              → `error.reason` carries the parser message.
 * - Valid JSON                → `raw` holds the parsed value, no error.
 */
export function parseLine(text: string, byteOffset: number, byteLength: number): ParsedLine {
  if (text.length === 0 || /^\s*$/.test(text)) {
    return { raw: undefined, text, byteOffset, byteLength, error: { reason: "empty-line" } };
  }
  try {
    return { raw: JSON.parse(text), text, byteOffset, byteLength };
  } catch (e) {
    return {
      raw: undefined,
      text,
      byteOffset,
      byteLength,
      error: { reason: (e as Error).message },
    };
  }
}
