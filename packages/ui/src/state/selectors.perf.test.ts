import type { EventRow } from "@ahp-viewer/core";
import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "./filters.js";
import { applyFacets } from "./filters.js";

function makeRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    idx: 0,
    seq: 0,
    ts: Date.now(),
    tsFmt: "00:00:00.000",
    dir: "c2s",
    dirGlyph: "→",
    kind: "request",
    kindTag: "REQ",
    method: "initialize",
    actionType: null,
    actionFamily: null,
    sessionId: "session-a",
    sessionShort: "ssion-a",
    turnId: null,
    turnShort: null,
    keyId: "1",
    status: "ok",
    latencyMs: 10,
    latencyBand: "fast",
    payloadPreview: "{}",
    parseErrorReason: null,
    lineIndex: null,
    errorCode: null,
    serverSeq: null,
    gapBefore: false,
    isAuthFailure: false,
    ...overrides,
  };
}

describe("filter performance (50k rows)", () => {
  it("facet filter pass over 50k rows completes in < 15 ms", () => {
    const rows: EventRow[] = Array.from({ length: 50_000 }, (_, i) =>
      makeRow({ idx: i, dir: i % 2 === 0 ? "c2s" : "s2c", method: `method-${i % 100}` }),
    );
    const filter = { ...EMPTY_FILTERS, direction: ["c2s" as const] };
    const start = performance.now();
    const result = rows.filter((r) => applyFacets(r, filter));
    const elapsed = performance.now() - start;
    expect(result.length).toBe(25_000);
    expect(elapsed).toBeLessThan(15);
  });
});
