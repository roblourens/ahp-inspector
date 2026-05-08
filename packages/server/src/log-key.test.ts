import { describe, expect, it } from "vitest";
import { computeLogKey } from "./log-key.js";

describe("computeLogKey", () => {
  it("returns 32 lowercase hex chars", () => {
    const k = computeLogKey("/var/log/a.jsonl", 1700000000000);
    expect(k).toMatch(/^[0-9a-f]{32}$/);
  });
  it("is deterministic for identical inputs", () => {
    expect(computeLogKey("/a", 1)).toBe(computeLogKey("/a", 1));
  });
  it("differs when path differs", () => {
    expect(computeLogKey("/a", 1)).not.toBe(computeLogKey("/b", 1));
  });
  it("differs when mtime differs", () => {
    expect(computeLogKey("/a", 1)).not.toBe(computeLogKey("/a", 2));
  });
  it("ignores sub-millisecond fractional drift (Math.floor)", () => {
    expect(computeLogKey("/a", 1700000000000.7)).toBe(computeLogKey("/a", 1700000000000));
  });
});
