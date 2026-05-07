import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AhpEvent, NormalizeMeta } from "@ahp-viewer/shared";
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

  it("throws ParseOverflowError when an unterminated line exceeds MAX_BUF_BYTES", () => {
    const s = new LineSplitter();
    const huge = "x".repeat(MAX_BUF_BYTES + 1);
    expect(() => s.push(huge)).toThrow(ParseOverflowError);
    // Internal state reset after overflow so subsequent pushes work.
    expect(s.push("ok\n")).toEqual(["ok"]);
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
  const lines = [...splitter.push(text), ...splitter.flush()];
  const events: AhpEvent[] = [];
  let offset = 0;
  let seq = 0;
  for (const line of lines) {
    const byteLength = Buffer.byteLength(line, "utf8");
    const parsed = parseLine(line, offset, byteLength);
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
      byteLength,
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
        byteLength,
        raw: undefined,
        parse: "error",
        parseError: { reason: parsed.error.reason, rawText: line },
      });
    } else {
      events.push(normalize(parsed.raw, meta));
    }
    offset += byteLength + 1; // +1 for the consumed newline
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
