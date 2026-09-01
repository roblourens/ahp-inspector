import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AhpEvent, NormalizeMeta } from "@ahp-inspector/shared";
import { describe, expect, it } from "vitest";
import { LineSplitter, MAX_BUF_BYTES, ParseOverflowError, parseLine } from "./jsonl.js";
import { normalize } from "./normalizer.js";

// ─── LineSplitter ────────────────────────────────────────────────────────────

describe("LineSplitter", () => {
  it("splits LF lines and buffers the trailing partial", () => {
    const s = new LineSplitter();
    expect(s.push("a\nb\nc")).toEqual(["a", "b"]);
    expect(s.flush()).toEqual(["c"]);
  });

  it("consumes BOM at file start exactly once (Pitfall 4)", () => {
    const s = new LineSplitter();
    expect(s.push('\uFEFF{"a":1}\n{"b":2}\n')).toEqual(['{"a":1}', '{"b":2}']);
    // A later BOM that appears INSIDE a JSON string must survive intact.
    expect(s.push('{"x":"\uFEFF"}\n')).toEqual(['{"x":"\uFEFF"}']);
  });

  it("strips CRLF endings (no trailing \\r)", () => {
    const s = new LineSplitter();
    expect(s.push("a\r\nb\r\n")).toEqual(["a", "b"]);
  });

  it("reports exact mixed LF and CRLF terminator byte counts", () => {
    const s = new LineSplitter();
    expect(s.pushDetailed("a\nbb\r\nccc\n").lines).toEqual([
      { text: "a", byteLength: 1, terminatorBytes: 1 },
      { text: "bb", byteLength: 2, terminatorBytes: 2 },
      { text: "ccc", byteLength: 3, terminatorBytes: 1 },
    ]);
  });

  it("reports CRLF split across chunks as a two-byte terminator", () => {
    const s = new LineSplitter();
    expect(s.pushDetailed("first\r").lines).toEqual([]);
    expect(s.pushDetailed("\nsecond\n").lines).toEqual([
      { text: "first", byteLength: 5, terminatorBytes: 2 },
      { text: "second", byteLength: 6, terminatorBytes: 1 },
    ]);
  });

  it("reports exact UTF-8 byte lengths for multibyte lines", () => {
    const s = new LineSplitter();
    expect(s.pushDetailed("a😀é\r\n").lines).toEqual([
      { text: "a😀é", byteLength: 7, terminatorBytes: 2 },
    ]);
  });

  it("buffers a partial line until the next chunk completes it", () => {
    const s = new LineSplitter();
    expect(s.push('{"a":')).toEqual([]);
    expect(s.push("1}\n")).toEqual(['{"a":1}']);
  });

  it("flush is idempotent when buffer is empty", () => {
    const s = new LineSplitter();
    expect(s.flush()).toEqual([]);
    expect(s.flush()).toEqual([]);
  });

  it("finalizes only a validity-approved EOF record without a newline", () => {
    const s = new LineSplitter();
    s.push('{"a":1}');
    expect(s.finalizeIf((text) => parseLine(text, 0, text.length).error === undefined)).toEqual([
      { text: '{"a":1}', byteLength: 7, terminatorBytes: 0 },
    ]);
    expect(s.pushDetailed("\n")).toEqual({ lines: [], leadingBytes: 1 });
    expect(s.pushDetailed('{"b":2}\n').lines).toEqual([
      { text: '{"b":2}', byteLength: 7, terminatorBytes: 1 },
    ]);
  });

  it("consumes a delayed split CRLF after EOF finalization exactly once", () => {
    const s = new LineSplitter();
    s.push('{"a":1}');
    s.finalizeIf((text) => parseLine(text, 0, text.length).error === undefined);
    expect(s.pushDetailed("\r")).toEqual({ lines: [], leadingBytes: 0 });
    expect(s.pushDetailed("\n")).toEqual({ lines: [], leadingBytes: 2 });
  });

  it("keeps an invalid live tail buffered until a later chunk completes it", () => {
    const s = new LineSplitter();
    s.push('{"a":');
    expect(s.finalizeIf((text) => parseLine(text, 0, text.length).error === undefined)).toEqual([]);
    expect(s.pushDetailed("1}\r").lines).toEqual([]);
    expect(s.pushDetailed("\n").lines).toEqual([
      { text: '{"a":1}', byteLength: 7, terminatorBytes: 2 },
    ]);
  });

  it("checkpoints discarded oversized bytes without ending the live line", () => {
    const skips: Array<{ bytes: number; term: number }> = [];
    const s = new LineSplitter({
      onOversizedLineSkipped: (bytes, term) => skips.push({ bytes, term }),
    });
    s.push("x".repeat(MAX_BUF_BYTES + 1));

    expect(s.checkpoint()).toBe(MAX_BUF_BYTES + 1);
    expect(s.checkpoint()).toBe(0);
    expect(skips).toEqual([]);
    expect(s.push("more\nnext\n")).toEqual(["next"]);
    expect(skips).toEqual([{ bytes: 4, term: 1 }]);
  });

  it("throws ParseOverflowError when an unterminated line exceeds MAX_BUF_BYTES", () => {
    const s = new LineSplitter();
    const huge = "x".repeat(MAX_BUF_BYTES + 1);
    expect(() => s.push(huge)).toThrow(ParseOverflowError);
    // Internal state reset after overflow so subsequent pushes work.
    expect(s.push("ok\n")).toEqual(["ok"]);
  });

  describe("tolerant mode (onOversizedLineSkipped)", () => {
    it("does NOT throw on overflow, drops the oversized line, and resumes after the next newline", () => {
      const skips: number[] = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (n) => skips.push(n),
      });
      // Push the oversized portion across multiple chunks (simulates how
      // TailReader feeds 256KB chunks to the splitter).
      const chunkSize = 1 * 1024 * 1024;
      const totalBytes = MAX_BUF_BYTES + 5 * chunkSize; // ~21MB
      const chunk = "x".repeat(chunkSize);
      const chunks = Math.ceil(totalBytes / chunkSize);
      for (let i = 0; i < chunks; i++) {
        expect(() => s.push(chunk)).not.toThrow();
      }
      // Skip callback hasn't fired yet — no terminator seen.
      expect(skips).toEqual([]);
      // Newline + a good line — splitter should fire skip callback and emit the next line.
      expect(s.push("\nafter\n")).toEqual(["after"]);
      expect(skips).toHaveLength(1);
      const skipped = skips[0];
      if (skipped === undefined) throw new Error("expected one skip report");
      expect(skipped).toBeGreaterThanOrEqual(MAX_BUF_BYTES);
    });

    it("returns pre-overflow lines from the same push that triggers overflow", () => {
      const skips: number[] = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (n) => skips.push(n),
      });
      const huge = "x".repeat(MAX_BUF_BYTES + 1);
      // good\n + 16MB+ tail in one chunk — `good` must still come out.
      expect(s.push(`good\n${huge}`)).toEqual(["good"]);
      expect(skips).toEqual([]); // no terminator yet
      expect(s.push("\nrecovered\n")).toEqual(["recovered"]);
      expect(skips).toHaveLength(1);
    });

    it("counts UTF-8 byte length correctly for non-ASCII oversized content", () => {
      const skips: number[] = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (n) => skips.push(n),
      });
      // The overflow trigger is JS string length (UTF-16 code units), so we
      // need > MAX_BUF_BYTES code units to overflow. Each "ä" contributes
      // 1 code unit but 2 UTF-8 bytes.
      const charCount = MAX_BUF_BYTES + 1;
      const huge = "ä".repeat(charCount);
      s.push(huge);
      s.push("\n");
      expect(skips).toHaveLength(1);
      const skipped = skips[0];
      if (skipped === undefined) throw new Error("expected one skip report");
      // Each "ä" contributes 2 UTF-8 bytes.
      expect(skipped).toBe(charCount * 2);
    });

    it("handles CRLF terminator on the skipped line", () => {
      const skips: Array<{ bytes: number; term: number }> = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (bytes, term) => skips.push({ bytes, term }),
      });
      s.push("x".repeat(MAX_BUF_BYTES + 1));
      // CRLF: the \r is one byte BEFORE the \n; splitter must NOT count it
      // as part of the oversized payload, and must report terminator = 2.
      expect(s.push("\r\nnext\n")).toEqual(["next"]);
      expect(skips).toHaveLength(1);
      expect(skips[0]?.term).toBe(2);
    });

    it("handles a skipped-line CRLF terminator split across chunks", () => {
      const skips: Array<{ bytes: number; term: number }> = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (bytes, term) => skips.push({ bytes, term }),
      });
      s.push(`${"x".repeat(MAX_BUF_BYTES + 1)}\r`);
      expect(s.push("\nnext\n")).toEqual(["next"]);
      expect(skips).toHaveLength(1);
      expect(skips[0]?.term).toBe(2);
      expect(skips[0]?.bytes).toBe(MAX_BUF_BYTES + 1);
    });

    it("reports terminator = 1 for LF terminator", () => {
      const skips: Array<{ bytes: number; term: number }> = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (bytes, term) => skips.push({ bytes, term }),
      });
      s.push("x".repeat(MAX_BUF_BYTES + 1));
      s.push("\n");
      expect(skips).toHaveLength(1);
      expect(skips[0]?.term).toBe(1);
    });

    it("endOfInput() flushes an oversized unterminated line with terminator = 0", () => {
      const skips: Array<{ bytes: number; term: number }> = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (bytes, term) => skips.push({ bytes, term }),
      });
      // Many chunks, no newline at all — simulates an 80MB single-line file.
      const chunk = "x".repeat(1024 * 1024);
      for (let i = 0; i < 20; i++) s.push(chunk);
      expect(skips).toEqual([]); // no terminator yet
      s.endOfInput();
      expect(skips).toHaveLength(1);
      expect(skips[0]?.term).toBe(0);
      expect(skips[0]?.bytes).toBeGreaterThanOrEqual(MAX_BUF_BYTES);
    });

    it("endOfInput() is a no-op when not skipping", () => {
      const skips: number[] = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (n) => skips.push(n),
      });
      s.push("normal\n");
      s.endOfInput();
      expect(skips).toEqual([]);
    });

    it("endOfInput() clears skip state so subsequent pushes start fresh", () => {
      const skips: number[] = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (n) => skips.push(n),
      });
      s.push("x".repeat(MAX_BUF_BYTES + 1));
      s.endOfInput();
      expect(skips).toHaveLength(1);
      // After endOfInput, the next push should behave as a fresh splitter.
      expect(s.push("hello\nworld\n")).toEqual(["hello", "world"]);
      expect(skips).toHaveLength(1); // no second skip fired
    });

    it("reset() clears tolerant-mode skip state", () => {
      const skips: number[] = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (n) => skips.push(n),
      });
      s.push("x".repeat(MAX_BUF_BYTES + 1));
      // skipping = true here; no terminator yet.
      s.reset();
      // After reset, the next push must behave as a fresh splitter — it
      // should NOT keep discarding bytes looking for a newline.
      expect(s.push("hello\nworld\n")).toEqual(["hello", "world"]);
      expect(skips).toEqual([]);
    });

    it("skip-then-skip: two oversized lines in a row fire the callback twice", () => {
      const skips: number[] = [];
      const s = new LineSplitter({
        onOversizedLineSkipped: (n) => skips.push(n),
      });
      const huge = "x".repeat(MAX_BUF_BYTES + 1);
      s.push(huge);
      s.push("\n");
      s.push(huge);
      s.push("\n");
      expect(skips).toHaveLength(2);
    });
  });
});

// ─── parseLine ───────────────────────────────────────────────────────────────

describe("parseLine", () => {
  it("flags empty / whitespace-only lines without throwing", () => {
    expect(parseLine("", 0, 0).error?.reason).toBe("empty-line");
    expect(parseLine("   ", 0, 3).error?.reason).toBe("empty-line");
    expect(parseLine("", 0, 0).raw).toBeUndefined();
  });

  it("returns parsed JSON on valid input", () => {
    const r = parseLine('{"a":1}', 0, 7);
    expect(r.error).toBeUndefined();
    expect(r.raw).toEqual({ a: 1 });
  });

  it("returns a structured error on invalid JSON; never throws", () => {
    const r = parseLine("{not-json", 0, 9);
    expect(r.error?.reason).toBeTruthy();
    expect(r.raw).toBeUndefined();
  });
});

// ─── Fixture round-trips ─────────────────────────────────────────────────────

const FIX = (name: string) => resolve("test/fixtures", name);

function streamFixture(path: string): AhpEvent[] {
  const text = readFileSync(path, "utf8");
  const splitter = new LineSplitter();
  const result = splitter.pushDetailed(text);
  const lines = result.lines;
  const events: AhpEvent[] = [];
  let offset = result.leadingBytes;
  let seq = 0;
  for (const line of lines) {
    const parsed = parseLine(line.text, offset, line.byteLength);
    // Direction is fixture-specific; tiny.jsonl encodes it positionally to
    // match the canonical generator: 1=c2s req, 2=s2c resp, 3=c2s notif,
    // 4=s2c action, 5=s2c notif, 6=s2c resp, 7=c2s req, 8=c2s req.
    const dirByIdx: Record<number, "c2s" | "s2c"> = {
      0: "c2s",
      1: "s2c",
      2: "c2s",
      3: "s2c",
      4: "s2c",
      5: "s2c",
      6: "c2s",
      7: "c2s",
    };
    const meta: NormalizeMeta = {
      seq,
      ts: 0,
      tsRaw: "",
      dir: dirByIdx[seq] ?? "c2s",
      byteOffset: offset,
      byteLength: line.byteLength,
    };
    if (parsed.error) {
      events.push({
        seq,
        ts: 0,
        tsRaw: "",
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
        byteOffset: offset,
        byteLength: line.byteLength,
        raw: undefined,
        parse: "error",
        parseError: { reason: parsed.error.reason, rawText: line.text },
      });
    } else {
      events.push(normalize(parsed.raw, meta));
    }
    offset += line.byteLength + line.terminatorBytes;
    seq += 1;
  }
  return events;
}

describe("fixture round-trips (VERIFY-01)", () => {
  it("tiny.jsonl yields 8 events with no parse-errors", () => {
    const evs = streamFixture(FIX("tiny.jsonl"));
    expect(evs).toHaveLength(8);
    expect(evs.every((e) => e.kind !== "parse-error")).toBe(true);
    const kinds = new Set(evs.map((e) => e.kind));
    for (const expected of [
      "request",
      "response",
      "client-notification",
      "action",
      "protocol-notification",
    ] as const) {
      expect(kinds.has(expected), `missing kind ${expected}`).toBe(true);
    }
  });

  it("malformed.jsonl yields 5 events with 3 parse-errors and 2 ok", () => {
    const evs = streamFixture(FIX("malformed.jsonl"));
    expect(evs).toHaveLength(5);
    expect(evs.filter((e) => e.kind === "parse-error")).toHaveLength(3);
    expect(evs.filter((e) => e.parse === "ok")).toHaveLength(2);
  });

  it("crlf.jsonl yields the same 8 events as tiny.jsonl", () => {
    const evs = streamFixture(FIX("crlf.jsonl"));
    expect(evs).toHaveLength(8);
    expect(evs.every((e) => e.kind !== "parse-error")).toBe(true);
  });

  it("bom.jsonl yields 3 valid events and the leading BOM is stripped exactly once", () => {
    const evs = streamFixture(FIX("bom.jsonl"));
    expect(evs).toHaveLength(3);
    expect(evs.every((e) => e.kind !== "parse-error")).toBe(true);
    // The first event must parse as a request — i.e. the BOM did not leak
    // into its source text (otherwise JSON.parse would have rejected it).
    expect(evs[0]?.kind).toBe("request");
  });
});
