import type { NormalizeMeta } from "@ahp-viewer/shared";
import { describe, expect, it } from "vitest";
import { LineSplitter, parseLine } from "./jsonl.js";
import { normalize } from "./normalizer.js";

// ~2 MB single-line response. Generated in-test so no fixture is committed.
describe("large payload streaming (VERIFY-01 / T-02-01)", () => {
  it("parses a single ~2 MB JSONL response in <500 ms without throwing", { timeout: 1500 }, () => {
    const big = "X".repeat(2_000_000);
    const line = `${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { data: big } })}\n`;
    const expectedByteLength = Buffer.byteLength(line, "utf8") - 1; // exclude the trailing \n

    const splitter = new LineSplitter();
    const t0 = performance.now();
    const lines = [...splitter.push(line), ...splitter.flush()];
    expect(lines).toHaveLength(1);
    const text = lines[0];
    if (!text) throw new Error("expected one split line");
    const parsed = parseLine(text, 0, Buffer.byteLength(text, "utf8"));
    expect(parsed.error).toBeUndefined();
    const meta: NormalizeMeta = {
      seq: 0,
      dir: "s2c",
      ts: 0,
      tsRaw: "",
      byteOffset: 0,
      byteLength: expectedByteLength,
    };
    const ev = normalize(parsed.raw, meta);
    const dt = performance.now() - t0;

    expect(ev.kind).toBe("response");
    expect(ev.byteLength).toBe(expectedByteLength);
    expect(dt).toBeLessThan(500);
  });
});
