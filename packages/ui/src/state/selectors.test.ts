// @vitest-environment jsdom
/**
 * Unit tests for selectors: applyFacets, useFilteredRows, useFacetCounts, useGroupedItems.
 * Environment: jsdom (packages/ui/vitest.config.ts)
 */
import type { EventRow } from "@ahp-inspector/core";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyFacets, APP_DEFAULT_FILTERS, EMPTY_FILTERS } from "./filters.js";
import {
  useFacetCounts,
  useFilteredRows,
  useGroupedItems,
  useVisibleSearchMatches,
} from "./selectors.js";
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
    previousServerSeq: null,
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
    searchTotal: 0,
    searchTruncated: false,
    searchStatus: "idle",
    searchError: null,
    searchQuery: "",
    grouping: "none",
    groupCollapsed: new Set(),
    selectedDetail: null,
    detailWidth: 420,
  });
}

describe("applyFacets", () => {
  it("returns true for a s2c row when hidden directions are ['c2s']", () => {
    const row = makeRow({ dir: "s2c", dirGlyph: "←" });
    expect(applyFacets(row, { ...EMPTY_FILTERS, direction: ["c2s"] })).toBe(true);
  });

  it("returns true for any row when EMPTY_FILTERS", () => {
    const row = makeRow({ dir: "s2c", dirGlyph: "←" });
    expect(applyFacets(row, EMPTY_FILTERS)).toBe(true);
  });

  it("returns false for a c2s row when hidden directions are ['c2s']", () => {
    const row = makeRow({ dir: "c2s" });
    expect(applyFacets(row, { ...EMPTY_FILTERS, direction: ["c2s"] })).toBe(false);
  });

  it("hides included kind values while leaving other kinds visible", () => {
    const req = makeRow({ kind: "request", kindTag: "REQ" });
    const resp = makeRow({ kind: "response", kindTag: "RES" });
    const f = { ...EMPTY_FILTERS, kind: ["request" as const] };
    expect(applyFacets(req, f)).toBe(false);
    expect(applyFacets(resp, f)).toBe(true);
  });

  it("filters by method exclusions while allowing null method rows", () => {
    const row = makeRow({ method: null });
    const hidden = makeRow({ method: "tools/call" });
    const visible = makeRow({ method: "initialize" });
    const filters = { ...EMPTY_FILTERS, method: ["tools/call"] };
    expect(applyFacets(row, filters)).toBe(true);
    expect(applyFacets(hidden, filters)).toBe(false);
    expect(applyFacets(visible, filters)).toBe(true);
  });

  it("filters by timeFrom / timeTo", () => {
    const row = makeRow({ ts: 1000 });
    expect(applyFacets(row, { ...EMPTY_FILTERS, timeFrom: 500, timeTo: null })).toBe(true);
    expect(applyFacets(row, { ...EMPTY_FILTERS, timeFrom: 1500, timeTo: null })).toBe(false);
    expect(applyFacets(row, { ...EMPTY_FILTERS, timeFrom: null, timeTo: 500 })).toBe(false);
  });

  it("matches row text case-insensitively against published projection fields", () => {
    const row = makeRow({
      method: "tools/call",
      summary: "Opened ReadFile",
      sessionShort: "agent-main",
      payloadPreview: '{"path":"README.md"}',
    });
    expect(applyFacets(row, { ...EMPTY_FILTERS, rowText: "readfile" })).toBe(true);
    expect(applyFacets(row, { ...EMPTY_FILTERS, rowText: "AGENT-MAIN" })).toBe(true);
    expect(applyFacets(row, { ...EMPTY_FILTERS, rowText: "missing" })).toBe(false);
  });

  it("limits row text matching to the first 256 query characters", () => {
    const prefix = "a".repeat(256);
    const row = makeRow({ summary: prefix });
    const query = `${prefix}not-present`;
    expect(applyFacets(row, { ...EMPTY_FILTERS, rowText: query })).toBe(true);
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

  it("with searchMatches = Set([0,2]) and 3 rows still returns all row indices", () => {
    const rows = [makeRow({ idx: 0 }), makeRow({ idx: 1 }), makeRow({ idx: 2 })];
    resetStore(rows);
    useAppStore.setState({ searchMatches: new Set([0, 2]) });
    const { result } = renderHook(() => useFilteredRows());
    expect(result.current).toEqual([0, 1, 2]);
  });

  it("with hidden direction ['s2c'] and searchMatches = Set([0,1]) returns visible direction rows", () => {
    const rows = [
      makeRow({ idx: 0, dir: "c2s" }),
      makeRow({ idx: 1, dir: "s2c", dirGlyph: "←" }),
      makeRow({ idx: 2, dir: "c2s" }),
    ];
    resetStore(rows);
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, direction: ["s2c"] },
      searchMatches: new Set([0, 1]),
    });
    const { result } = renderHook(() => useFilteredRows());
    expect(result.current).toEqual([0, 2]);
  });

  it("with app default filters hides ping requests and paired responses", () => {
    const rows = [
      makeRow({ idx: 0, method: "initialize", pairIdx: null }),
      makeRow({ idx: 1, method: "ping", pairIdx: 2 }),
      makeRow({ idx: 2, method: null }),
      makeRow({ idx: 3, method: null, pairIdx: 1 }),
    ];
    resetStore(rows);
    useAppStore.setState({ filters: APP_DEFAULT_FILTERS });
    const { result } = renderHook(() => useFilteredRows());
    expect(result.current).toEqual([0, 2]);
  });

  it("with method exclusions hides additional unchecked methods and paired responses", () => {
    const rows = [
      makeRow({ idx: 0, method: "initialize", pairIdx: null }),
      makeRow({ idx: 1, method: "tools/call", pairIdx: 2 }),
      makeRow({ idx: 2, method: null, pairIdx: 1 }),
      makeRow({ idx: 3, method: "ping", pairIdx: 4 }),
      makeRow({ idx: 4, method: null, pairIdx: 3 }),
      makeRow({ idx: 5, method: null, pairIdx: null }),
    ];
    resetStore(rows);
    useAppStore.setState({ filters: { ...APP_DEFAULT_FILTERS, method: ["ping", "tools/call"] } });
    const { result } = renderHook(() => useFilteredRows());
    expect(result.current).toEqual([0, 5]);
  });
});

describe("useVisibleSearchMatches", () => {
  beforeEach(() => resetStore());

  afterEach(() => resetStore());

  it("returns visible search matches after applying hidden facets", () => {
    const rows = [
      makeRow({ idx: 0, dir: "c2s" }),
      makeRow({ idx: 1, dir: "s2c", dirGlyph: "←" }),
      makeRow({ idx: 2, dir: "c2s" }),
    ];
    resetStore(rows);
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, direction: ["s2c"] },
      searchMatches: new Set([0, 1, 99]),
    });
    const { result } = renderHook(() => useVisibleSearchMatches());
    expect(result.current).toEqual([0]);
  });

  it("excludes search matches for responses paired with hidden methods", () => {
    const rows = [
      makeRow({ idx: 0, method: "initialize", pairIdx: null }),
      makeRow({ idx: 1, method: "ping", pairIdx: 2 }),
      makeRow({ idx: 2, method: null, pairIdx: 1 }),
      makeRow({ idx: 3, method: null, pairIdx: null }),
    ];
    resetStore(rows);
    useAppStore.setState({
      filters: APP_DEFAULT_FILTERS,
      searchMatches: new Set([0, 1, 2, 3]),
    });
    const { result } = renderHook(() => useVisibleSearchMatches());
    expect(result.current).toEqual([0, 3]);
  });

  it("uses row text for visibility while Search navigation returns only surviving matches", () => {
    const rows = [
      makeRow({ idx: 0, summary: "keep alpha" }),
      makeRow({ idx: 1, summary: "drop beta" }),
      makeRow({ idx: 2, summary: "keep gamma" }),
    ];
    resetStore(rows);
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, rowText: "keep" },
      searchMatches: new Set([1, 2]),
    });
    const visibleRows = renderHook(() => useFilteredRows());
    const visibleMatches = renderHook(() => useVisibleSearchMatches());
    expect(visibleRows.result.current).toEqual([0, 2]);
    expect(visibleMatches.result.current).toEqual([2]);
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

  it("does not insert a gap-banner when a row has gapBefore:true (cross-subscription jumps are expected)", () => {
    const rows = [
      makeRow({ idx: 0, gapBefore: false, serverSeq: 10 }),
      makeRow({ idx: 1, gapBefore: true, previousServerSeq: 10, serverSeq: 15 }),
    ];
    resetStore(rows);
    useAppStore.setState({ grouping: "none" });
    const { result } = renderHook(() => useGroupedItems([0, 1]));
    expect(result.current).toEqual([
      { kind: "row", rowIdx: 0 },
      { kind: "row", rowIdx: 1 },
    ]);
  });

  it("does not insert a gap-banner when previous serverSeq is unavailable", () => {
    const rows = [makeRow({ idx: 0, gapBefore: true, previousServerSeq: null, serverSeq: 15 })];
    resetStore(rows);
    useAppStore.setState({ grouping: "none" });
    const { result } = renderHook(() => useGroupedItems([0]));
    expect(result.current).toEqual([{ kind: "row", rowIdx: 0 }]);
  });
});
