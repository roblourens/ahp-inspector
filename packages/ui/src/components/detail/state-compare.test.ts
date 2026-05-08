import { describe, expect, it } from "vitest";
import { comparePinnedStatePoints, MAX_CHANGED_TOP_LEVEL_PATHS } from "./state-compare.js";
import type { PinnedStatePoint } from "./state-pins.js";

describe("comparePinnedStatePoints", () => {
  it("reports changed top-level object keys", () => {
    const result = comparePinnedStatePoints(
      createPin({ summary: "before", unchanged: true }),
      createPin({ summary: "after", unchanged: true }),
    );

    expect(result.changedPaths).toEqual(["summary"]);
    expect(result.overflowCount).toBe(0);
    expect(result.same).toBe(false);
    expect(result.confidence).toBe("complete");
  });

  it("reports array length changes and equal-length top-level index changes", () => {
    expect(comparePinnedStatePoints(createPin(["a"]), createPin(["a", "b"]))).toMatchObject({
      changedPaths: ["length"],
      same: false,
    });

    expect(comparePinnedStatePoints(createPin(["a", "b"]), createPin(["a", "c"]))).toMatchObject({
      changedPaths: ["[1]"],
      same: false,
    });
  });

  it("reports primitive and null root changes", () => {
    expect(comparePinnedStatePoints(createPin("ready"), createPin("done"))).toMatchObject({
      changedPaths: ["(root)"],
      same: false,
    });

    expect(comparePinnedStatePoints(createPin(null), createPin({ ready: true }))).toMatchObject({
      changedPaths: ["(root)"],
      same: false,
    });
  });

  it("marks unchanged states as same", () => {
    const result = comparePinnedStatePoints(
      createPin({ summary: "same", nested: { count: 1 } }),
      createPin({ summary: "same", nested: { count: 1 } }),
    );

    expect(result.changedPaths).toEqual([]);
    expect(result.overflowCount).toBe(0);
    expect(result.same).toBe(true);
  });

  it("caps changed paths and reports overflow count", () => {
    const before = Object.fromEntries(
      Array.from({ length: MAX_CHANGED_TOP_LEVEL_PATHS + 3 }, (_, index) => [
        `key-${index}`,
        "before",
      ]),
    );
    const after = Object.fromEntries(
      Array.from({ length: MAX_CHANGED_TOP_LEVEL_PATHS + 3 }, (_, index) => [
        `key-${index}`,
        "after",
      ]),
    );

    const result = comparePinnedStatePoints(createPin(before), createPin(after));

    expect(result.changedPaths).toHaveLength(MAX_CHANGED_TOP_LEVEL_PATHS);
    expect(result.changedPaths[0]).toBe("key-0");
    expect(result.overflowCount).toBe(3);
  });

  it("combines partial and unknown confidence conservatively", () => {
    expect(
      comparePinnedStatePoints(createPin({ ok: true }, "partial"), createPin({ ok: false })),
    ).toMatchObject({ confidence: "partial" });

    expect(
      comparePinnedStatePoints(createPin({ ok: true }, "unknown"), createPin({ ok: false })),
    ).toMatchObject({ confidence: "unknown" });
  });
});

function createPin(
  state: unknown,
  confidence: PinnedStatePoint["confidence"] = "complete",
): PinnedStatePoint {
  return {
    id: `log-A:1:session:copilot:/session/${confidence}`,
    logKey: "log-A",
    targetIndex: 1,
    eventLabel: "event-1",
    eventTimestamp: 1000,
    resourceKind: "session",
    resourceUri: "copilot:/session/1",
    confidence,
    diagnosticCount: 0,
    baselineEventIdx: 0,
    lastAppliedEventIdx: 1,
    baselineFromSeq: 0,
    lastServerSeq: 1,
    state,
  };
}
