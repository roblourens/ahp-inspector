// @vitest-environment jsdom
/**
 * Unit tests for selectors: applyFacets, useFilteredRows, useFacetCounts, useGroupedItems.
 * Environment: jsdom (packages/ui/vitest.config.ts)
 */
import type { EventRow } from "@ahp-viewer/core";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyFacets, EMPTY_FILTERS } from "./filters.js";
import { useFacetCounts, useFilteredRows, useGroupedItems } from "./selectors.js";
import { useAppStore } from "./store.js";

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

function resetStore(rows: EventRow[] = []) {
  useAppStore.setState({
    rows,
    filters: EMPTY_FILTERS,
    searchMatches: null,
    searchQuery: "",
    grouping: "none",
    groupCollapsed: new Set(),
    selectedDetail: null,
    detailWidth: 420,
  });
}

describe("applyFacets", () => {
  it("returns false for a s2c row when direction filter is ['c2s']", () => {
    const row = makeRow({ dir: "s2c", dirGlyph: "←" });
    expect(applyFacets(row, { ...EMPTY_FILTERS, direction: ["c2s"] })).toBe(false);
  });

  it("returns true for any row when EMPTY_FILTERS", () => {
    const row = makeRow({ dir: "s2c", dirGlyph: "←" });
    expect(applyFacets(row, EMPTY_FILTERS)).toBe(true);
  });

  it("returns true for c2s row when direction filter is ['c2s']", () => {
    const row = makeRow({ dir: "c2s" });
    expect(applyFacets(row, { ...EMPTY_FILTERS, direction: ["c2s"] })).toBe(true);
  });

  it("filters by kind", () => {
    const req = makeRow({ kind: "request", kindTag: "REQ" });
    const resp = makeRow({ kind: "response", kindTag: "RES" });
    const f = { ...EMPTY_FILTERS, kind: ["request" as const] };
    expect(applyFacets(req, f)).toBe(true);
    expect(applyFacets(resp, f)).toBe(false);
  });

  it("filters by method — null method row is excluded when method filter is active", () => {
    const row = makeRow({ method: null });
    expect(applyFacets(row, { ...EMPTY_FILTERS, method: ["tools/call"] })).toBe(false);
  });

  it("filters by timeFrom / timeTo", () => {
    const row = makeRow({ ts: 1000 });
    expect(applyFacets(row, { ...EMPTY_FILTERS, timeFrom: 500, timeTo: null })).toBe(true);
    expect(applyFacets(row, { ...EMPTY_FILTERS, timeFrom: 1500, timeTo: null })).toBe(false);
    expect(applyFacets(row, { ...EMPTY_FILTERS, timeFrom: null, timeTo: 500 })).toBe(false);
  });
});

describe("useFilteredRows", () => {
  beforeEach(() => resetStore());

  afterEach(() => resetStore());

  it("with no filters and no searchMatches returns all row indices", () => {
    const rows = [makeRow({ idx: 0 }), makeRow({ idx: 1 }), makeRow({ idx: 2 })];
    resetStore(rows);
    const { result } = renderHook(() => useFilteredRows());
    expect(result.current).toEqual([0, 1, 2]);
  });

  it("with searchMatches = Set([0,2]) and 3 rows returns [0, 2]", () => {
    const rows = [makeRow({ idx: 0 }), makeRow({ idx: 1 }), makeRow({ idx: 2 })];
    resetStore(rows);
    useAppStore.setState({ searchMatches: new Set([0, 2]) });
    const { result } = renderHook(() => useFilteredRows());
    expect(result.current).toEqual([0, 2]);
  });

  it("with direction filter ['c2s'] AND searchMatches = Set([0,1]) returns intersection of matching direction rows", () => {
    const rows = [
      makeRow({ idx: 0, dir: "c2s" }),
      makeRow({ idx: 1, dir: "s2c", dirGlyph: "←" }),
      makeRow({ idx: 2, dir: "c2s" }),
    ];
    resetStore(rows);
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, direction: ["c2s"] },
      searchMatches: new Set([0, 1]),
    });
    const { result } = renderHook(() => useFilteredRows());
    // idx 0 passes both; idx 1 is s2c (fails direction); idx 2 passes direction but not search
    expect(result.current).toEqual([0]);
  });
});

describe("useFacetCounts", () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it("direction.get('c2s') equals the number of c2s rows", () => {
    const rows = [
      makeRow({ idx: 0, dir: "c2s" }),
      makeRow({ idx: 1, dir: "s2c", dirGlyph: "←" }),
      makeRow({ idx: 2, dir: "c2s" }),
    ];
    resetStore(rows);
    const { result } = renderHook(() => useFacetCounts());
    expect(result.current.direction.get("c2s")).toBe(2);
    expect(result.current.direction.get("s2c")).toBe(1);
  });

  it("counts methods correctly, ignoring null method rows", () => {
    const rows = [
      makeRow({ idx: 0, method: "initialize" }),
      makeRow({ idx: 1, method: "initialize" }),
      makeRow({ idx: 2, method: null }),
    ];
    resetStore(rows);
    const { result } = renderHook(() => useFacetCounts());
    expect(result.current.method.get("initialize")).toBe(2);
    expect(result.current.method.size).toBe(1);
  });
});

describe("useGroupedItems", () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it("grouping='none' returns [{ kind:'row', rowIdx:0 }, ...] for each index", () => {
    const rows = [makeRow({ idx: 0 }), makeRow({ idx: 1 }), makeRow({ idx: 2 })];
    resetStore(rows);
    useAppStore.setState({ grouping: "none" });
    const { result } = renderHook(() => useGroupedItems([0, 1, 2]));
    expect(result.current).toEqual([
      { kind: "row", rowIdx: 0 },
      { kind: "row", rowIdx: 1 },
      { kind: "row", rowIdx: 2 },
    ]);
  });

  it("grouping='session' groups by sessionId — rows with same session are preceded by a header", () => {
    const rows = [
      makeRow({ idx: 0, sessionId: "sess-a", sessionShort: "sess-a", ts: 1000 }),
      makeRow({ idx: 1, sessionId: "sess-a", sessionShort: "sess-a", ts: 2000 }),
      makeRow({ idx: 2, sessionId: "sess-b", sessionShort: "sess-b", ts: 3000 }),
    ];
    resetStore(rows);
    useAppStore.setState({ grouping: "session" });
    const { result } = renderHook(() => useGroupedItems([0, 1, 2]));
    // Should have: header(sess-a), row(0), row(1), header(sess-b), row(2)
    expect(result.current[0]).toMatchObject({
      kind: "header",
      level: "session",
      sessionId: "sess-a",
    });
    expect(result.current[1]).toEqual({ kind: "row", rowIdx: 0 });
    expect(result.current[2]).toEqual({ kind: "row", rowIdx: 1 });
    expect(result.current[3]).toMatchObject({
      kind: "header",
      level: "session",
      sessionId: "sess-b",
    });
    expect(result.current[4]).toEqual({ kind: "row", rowIdx: 2 });
  });

  it("a row with gapBefore:true causes a gap-banner item to be inserted before it", () => {
    const rows = [
      makeRow({ idx: 0, gapBefore: false, serverSeq: 10 }),
      makeRow({ idx: 1, gapBefore: true, serverSeq: 15 }),
    ];
    resetStore(rows);
    useAppStore.setState({ grouping: "none" });
    const { result } = renderHook(() => useGroupedItems([0, 1]));
    // Should have: row(0), gap-banner, row(1)
    expect(result.current[0]).toEqual({ kind: "row", rowIdx: 0 });
    expect(result.current[1]).toMatchObject({ kind: "gap-banner", curr: 15 });
    expect(result.current[2]).toEqual({ kind: "row", rowIdx: 1 });
  });
});
