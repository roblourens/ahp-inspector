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

export interface LineSplitterOptions {
  /**
   * Opt-in tolerant mode. When set, the splitter does not throw on
   * overflow. Instead, the oversized line is silently discarded and
   * parsing resumes at the next newline (or at end-of-input, see
   * {@link LineSplitter.endOfInput}). The callback fires exactly once
   * per skipped line. `bytesDropped` is the UTF-8 byte count of the
   * dropped line content (excluding the terminator). `terminatorBytes`
   * is the number of terminator bytes consumed: `1` for `\n`, `2` for
   * `\r\n`, or `0` if `endOfInput()` flushed an unterminated tail.
   * Caller should advance any byte-offset cursor by
   * `bytesDropped + terminatorBytes`.
   */
  onOversizedLineSkipped?: (bytesDropped: number, terminatorBytes: number) => void;
}

export interface SplitLine {
  readonly text: string;
  readonly byteLength: number;
  readonly terminatorBytes: 0 | 1 | 2;
}

export interface LineSplitResult {
  readonly lines: SplitLine[];
  /** Bytes consumed before the first returned line (BOM or a delayed terminator). */
  readonly leadingBytes: number;
}

/**
 * Count UTF-8 bytes in a JS (UTF-16) string without allocating an
 * intermediate buffer. Matches `Buffer.byteLength(s, "utf8")` exactly.
 */
function utf8ByteLength(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      // High surrogate — consume the low surrogate too (4 UTF-8 bytes total).
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Streaming line splitter. Holds a partial trailing line until the next
 * chunk arrives. Strips a leading BOM exactly once per stream (Pitfall 4)
 * so an inline U+FEFF inside a JSON string later in the file survives.
 */
export class LineSplitter {
  private buf = "";
  private bomConsumed = false;
  private readonly onOversized:
    | ((bytesDropped: number, terminatorBytes: number) => void)
    | undefined;
  // Tolerant-mode state: true while discarding bytes of an oversized line
  // until we find its terminating newline.
  private skipping = false;
  private skipBytesAccumulated = 0;
  private skipPendingCr = false;
  private finalizedAtEof = false;
  private finalizedPendingCr = false;

  constructor(options?: LineSplitterOptions) {
    this.onOversized = options?.onOversizedLineSkipped;
  }

  /**
   * Push a chunk; returns zero or more complete lines (without trailing
   * `\n` or `\r`). Holds any partial trailing line for the next call.
   *
   * @throws {ParseOverflowError} when the internal buffer would exceed
   *   {@link MAX_BUF_BYTES} before a newline is seen AND tolerant mode
   *   (`onOversizedLineSkipped`) is not configured.
   */
  push(chunk: string): string[] {
    return this.pushDetailed(chunk).lines.map((line) => line.text);
  }

  /**
   * Split a chunk while retaining the exact UTF-8 byte length and line
   * terminator width needed for source-relative offsets.
   */
  pushDetailed(chunk: string): LineSplitResult {
    let s = chunk;
    let leadingBytes = 0;

    if (this.finalizedAtEof) {
      if (s.length === 0) return { lines: [], leadingBytes };
      if (this.finalizedPendingCr) {
        this.finalizedPendingCr = false;
        this.finalizedAtEof = false;
        if (s.startsWith("\n")) {
          leadingBytes += 2;
          s = s.slice(1);
        } else {
          s = `\r${s}`;
        }
      } else if (s.startsWith("\r\n")) {
        this.finalizedAtEof = false;
        leadingBytes += 2;
        s = s.slice(2);
      } else if (s.startsWith("\n")) {
        this.finalizedAtEof = false;
        leadingBytes += 1;
        s = s.slice(1);
      } else if (s === "\r") {
        this.finalizedPendingCr = true;
        return { lines: [], leadingBytes };
      } else if (s.length > 0) {
        this.finalizedAtEof = false;
      }
    }

    if (!this.bomConsumed) {
      if (s.length > 0) {
        if (s.charCodeAt(0) === 0xfeff) {
          s = s.slice(1);
          leadingBytes += 3;
        }
        this.bomConsumed = true;
      }
    }

    if (this.skipping) {
      if (s.length === 0) return { lines: [], leadingBytes };
      if (this.skipPendingCr) {
        this.skipPendingCr = false;
        if (s.startsWith("\n")) {
          this.onOversized?.(this.skipBytesAccumulated, 2);
          this.skipBytesAccumulated = 0;
          this.skipping = false;
          s = s.slice(1);
          if (s.length === 0) return { lines: [], leadingBytes };
        } else {
          this.skipBytesAccumulated += 1;
        }
      }
    }

    if (this.skipping) {
      const nlIdx = s.indexOf("\n");
      if (nlIdx === -1) {
        // Whole chunk is part of the oversized line — drop it.
        if (s.endsWith("\r")) {
          this.skipBytesAccumulated += utf8ByteLength(s.slice(0, -1));
          this.skipPendingCr = true;
        } else {
          this.skipBytesAccumulated += utf8ByteLength(s);
        }
        return { lines: [], leadingBytes };
      }
      // Found the terminating newline. Account for bytes up to (but not
      // including) any CRLF or LF, then resume normal splitting on the
      // remainder.
      let end = nlIdx;
      const terminatorBytes = end > 0 && s.charCodeAt(end - 1) === 0x0d ? 2 : 1;
      if (terminatorBytes === 2) end--;
      this.skipBytesAccumulated += utf8ByteLength(s.slice(0, end));
      this.onOversized?.(this.skipBytesAccumulated, terminatorBytes);
      this.skipBytesAccumulated = 0;
      this.skipping = false;
      s = s.slice(nlIdx + 1);
      if (s.length === 0) return { lines: [], leadingBytes };
    }

    s = this.buf + s;
    const out: SplitLine[] = [];
    let start = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 0x0a /* \n */) {
        let end = i;
        const terminatorBytes = end > start && s.charCodeAt(end - 1) === 0x0d ? 2 : 1;
        if (terminatorBytes === 2) end--;
        // Emit even when empty so parseLine can flag the empty line —
        // VERIFY-01 fixtures rely on 1:1 line-in / line-out.
        const text = s.slice(start, end);
        out.push({ text, byteLength: utf8ByteLength(text), terminatorBytes });
        start = i + 1;
      }
    }
    const tail = s.slice(start);
    if (tail.length > MAX_BUF_BYTES) {
      // Reset buffered state regardless so subsequent pushes do not keep
      // amplifying the failure (16 MB string + N MB chunk concatenations).
      this.buf = "";
      if (this.onOversized) {
        // Tolerant mode: enter skip-until-newline state, count the
        // already-buffered bytes, and return any pre-overflow lines.
        this.skipping = true;
        if (tail.endsWith("\r")) {
          this.skipBytesAccumulated = utf8ByteLength(tail.slice(0, -1));
          this.skipPendingCr = true;
        } else {
          this.skipBytesAccumulated = utf8ByteLength(tail);
        }
        return { lines: out, leadingBytes };
      }
      throw new ParseOverflowError(
        `LineSplitter tail buffer exceeded ${MAX_BUF_BYTES} bytes without a newline`,
      );
    }
    this.buf = tail;
    return { lines: out, leadingBytes };
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
    this.skipping = false;
    this.skipBytesAccumulated = 0;
    this.skipPendingCr = false;
    this.finalizedAtEof = false;
    this.finalizedPendingCr = false;
  }

  /**
   * Signal that the caller has reached end-of-input (e.g. initial bulk read
   * complete, file truncated to current size). In tolerant mode, if we are
   * still discarding an oversized line that never received a terminating
   * newline, fire the callback now with the accumulated byte count and
   * clear skip state. No-op when not skipping.
   */
  endOfInput(): void {
    if (!this.skipping) return;
    const dropped = this.skipBytesAccumulated + (this.skipPendingCr ? 1 : 0);
    this.skipping = false;
    this.skipBytesAccumulated = 0;
    this.skipPendingCr = false;
    if (dropped > 0) this.onOversized?.(dropped, 0);
  }

  /**
   * Account for oversized bytes discarded up to a stable snapshot boundary
   * without ending the live line. A pending CR is retained until the next
   * chunk determines whether it belongs to a CRLF terminator.
   */
  checkpoint(): number {
    if (!this.skipping) return 0;
    const dropped = this.skipBytesAccumulated;
    this.skipBytesAccumulated = 0;
    return dropped;
  }

  /**
   * Emit a buffered EOF line only when the caller confirms it is complete.
   * A following LF/CRLF is consumed without producing a duplicate empty line.
   */
  finalizeIf(predicate: (text: string) => boolean): SplitLine[] {
    if (this.buf.length === 0 || !predicate(this.buf)) return [];
    const text = this.buf;
    this.buf = "";
    this.finalizedAtEof = true;
    return [{ text, byteLength: utf8ByteLength(text), terminatorBytes: 0 }];
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
