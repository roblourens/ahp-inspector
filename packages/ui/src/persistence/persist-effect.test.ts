// @vitest-environment jsdom
// usePersistEffect tests — Plan 04-06 Task 3 (TDD).

import type { EventRow } from "@ahp-inspector/core";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_FILTERS } from "../state/filters.js";
import * as persistenceModule from "../state/persistence.js";
import { useAppStore } from "../state/store.js";
import { usePersistEffect } from "./persist-effect.js";

function makeRow(idx: number): EventRow {
  return {
    kind: "event",
    idx,
    ts: idx,
    direction: "request",
    eventKind: "chat",
    sessionId: "s1",
    turnId: "t1",
    eventId: `e${idx}`,
    status: null,
    latencyMs: null,
    latencyBand: null,
    eventName: "x",
    payloadPreview: "",
  } as unknown as EventRow;
}

function resetStore(): void {
  useAppStore.setState({
    rows: [],
    selectedIdx: null,
    selectedDetail: null,
    meta: null,
    searchQuery: "",
    searchMatches: null,
    searchTotal: 0,
    searchTruncated: false,
    searchStatus: "idle",
    searchError: null,
    filters: EMPTY_FILTERS,
    grouping: "none",
    groupCollapsed: new Set<string>(),
    detailWidth: 420,
    livePaused: false,
    pendingBuffer: [],
    pendingNewCount: 0,
    loadProgress: { phase: "idle", loadedRows: 0, loadedBytes: 0 },
    streamBacklog: { queuedFrames: 0, queuedRows: 0 },
    logKey: null,
    rotationNotice: false,
    lastWatchError: null,
    lastOpenRef: null,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetStore();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  resetStore();
});

describe("usePersistEffect — Plan 04-06 Task 3", () => {
  it("baseline complete with no stored prefs leaves store untouched", () => {
    renderHook(() => usePersistEffect());
    // Trigger snapshot-end: logKey set, rows populated.
    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0), makeRow(1)] });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 2,
        loadedBytes: 20,
        totalBytes: 20,
        percent: 100,
      },
    });
    const s = useAppStore.getState();
    expect(s.searchQuery).toBe("");
    expect(s.grouping).toBe("none");
    expect(s.selectedIdx).toBeNull();
  });

  it("baseline complete with stored prefs applies filters/grouping/selectedIdx in range", () => {
    persistenceModule.persistPerLogPrefs("lk-A", {
      v: 1,
      searchQuery: "hello",
      filters: EMPTY_FILTERS,
      grouping: "session",
      groupCollapsed: ["g1", "g2"],
      selectedIdx: 5,
      detailWidth: 500,
      livePaused: false,
    });

    useAppStore.setState({
      searchMatches: new Set([0, 1]),
      searchTotal: 2,
      searchTruncated: true,
      searchStatus: "ready",
      searchError: "stale",
    });
    renderHook(() => usePersistEffect());
    useAppStore.setState({
      logKey: "lk-A",
      rows: Array.from({ length: 10 }, (_, i) => makeRow(i)),
    });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 10,
        loadedBytes: 100,
        totalBytes: 100,
        percent: 100,
      },
    });

    const s = useAppStore.getState();
    expect(s.searchQuery).toBe("hello");
    expect(s.searchMatches).toBeNull();
    expect(s.searchTotal).toBe(0);
    expect(s.searchTruncated).toBe(false);
    expect(s.searchStatus).toBe("idle");
    expect(s.searchError).toBeNull();
    expect(s.grouping).toBe("session");
    expect(s.detailWidth).toBe(500);
    expect(s.selectedIdx).toBe(5);
    expect(Array.from(s.groupCollapsed).sort()).toEqual(["g1", "g2"]);
  });

  it("does not hydrate stored prefs for a partial progressive row before baseline completion", () => {
    persistenceModule.persistPerLogPrefs("lk-partial", {
      v: 1,
      searchQuery: "wait-for-complete",
      filters: EMPTY_FILTERS,
      grouping: "session",
      groupCollapsed: [],
      selectedIdx: null,
      detailWidth: 420,
      livePaused: false,
    });
    renderHook(() => usePersistEffect());

    useAppStore.setState({
      logKey: "lk-partial",
      rows: [makeRow(0)],
      loadProgress: {
        phase: "loading",
        loadedRows: 1,
        loadedBytes: 10,
        totalBytes: 100,
        percent: 10,
      },
    });
    expect(useAppStore.getState().searchQuery).toBe("");

    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 1,
        loadedBytes: 100,
        totalBytes: 100,
        percent: 100,
      },
    });
    expect(useAppStore.getState().searchQuery).toBe("wait-for-complete");
  });

  it("stored selectedIdx out of range is dropped", () => {
    persistenceModule.persistPerLogPrefs("lk-A", {
      v: 1,
      searchQuery: "",
      filters: EMPTY_FILTERS,
      grouping: "none",
      groupCollapsed: [],
      selectedIdx: 999,
      detailWidth: 420,
      livePaused: false,
    });

    renderHook(() => usePersistEffect());
    useAppStore.setState({
      logKey: "lk-A",
      rows: Array.from({ length: 10 }, (_, i) => makeRow(i)),
    });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 10,
        loadedBytes: 100,
        totalBytes: 100,
        percent: 100,
      },
    });

    expect(useAppStore.getState().selectedIdx).toBeNull();
  });

  it("after hydration, mutating filters triggers debounced save 250ms later", () => {
    const spy = vi.spyOn(persistenceModule, "persistPerLogPrefs");
    renderHook(() => usePersistEffect());

    // Establish snapshot for lk-A.
    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0)] });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 1,
        loadedBytes: 10,
        totalBytes: 10,
        percent: 100,
      },
    });
    spy.mockClear();

    // Mutate something persistable.
    useAppStore.getState().setSearchQuery("query-1");

    // Within 250ms — no save yet.
    vi.advanceTimersByTime(200);
    expect(spy).not.toHaveBeenCalled();

    // After 250ms — single save.
    vi.advanceTimersByTime(60);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe("lk-A");
    expect(spy.mock.calls[0]?.[1].searchQuery).toBe("query-1");
  });

  it("flushes an accepted pending debounced save when the persistence effect unmounts", () => {
    const spy = vi.spyOn(persistenceModule, "persistPerLogPrefs");
    const hook = renderHook(() => usePersistEffect());

    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0)] });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 1,
        loadedBytes: 10,
        totalBytes: 10,
        percent: 100,
      },
    });
    spy.mockClear();
    useAppStore.getState().setSearchQuery("flush-on-unmount");

    hook.unmount();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe("lk-A");
    expect(spy.mock.calls[0]?.[1].searchQuery).toBe("flush-on-unmount");
  });

  it("switching logKey flushes prior log's prefs synchronously before subscribing for new log", () => {
    const spy = vi.spyOn(persistenceModule, "persistPerLogPrefs");
    renderHook(() => usePersistEffect());

    // Snapshot for A, mutate, but don't yet flush debounce.
    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0)] });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 1,
        loadedBytes: 10,
        totalBytes: 10,
        percent: 100,
      },
    });
    spy.mockClear();
    useAppStore.getState().setSearchQuery("a-query");
    expect(spy).not.toHaveBeenCalled();

    // Now switch to logKey B (resetForLogSwitch-style).
    useAppStore.setState({
      logKey: "lk-B",
      rows: [],
      loadProgress: { phase: "idle", loadedRows: 0, loadedBytes: 0 },
    });

    // Old logKey A's pending save must have flushed synchronously.
    expect(spy).toHaveBeenCalled();
    const flushed = spy.mock.calls.find((c) => c[0] === "lk-A");
    expect(flushed).toBeTruthy();
    expect(flushed?.[1].searchQuery).toBe("a-query");
  });

  it("switching to a logKey with no stored prefs resets filters/search/grouping", () => {
    renderHook(() => usePersistEffect());

    // Hydrate lk-A with active filters/search/grouping.
    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0)] });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 1,
        loadedBytes: 10,
        totalBytes: 10,
        percent: 100,
      },
    });
    useAppStore.getState().setFilters({ ...EMPTY_FILTERS, direction: ["c2s"] });
    useAppStore.getState().setSearchQuery("alpha");
    useAppStore.getState().setGrouping("session");
    useAppStore.setState({ groupCollapsed: new Set(["g1"]) });

    // Switch to lk-B which has no stored prefs.
    useAppStore.setState({
      logKey: "lk-B",
      rows: [],
      loadProgress: { phase: "idle", loadedRows: 0, loadedBytes: 0 },
    });

    const s = useAppStore.getState();
    expect(s.filters).toEqual(EMPTY_FILTERS);
    expect(s.searchQuery).toBe("");
    expect(s.searchMatches).toBeNull();
    expect(s.grouping).toBe("none");
    expect(Array.from(s.groupCollapsed)).toEqual([]);
  });

  it("switching to a logKey with stored prefs restores them after reset", () => {
    persistenceModule.persistPerLogPrefs("lk-B", {
      v: 1,
      searchQuery: "from-B",
      filters: { ...EMPTY_FILTERS, kind: ["request"] as never },
      grouping: "session+turn",
      groupCollapsed: ["bg1"],
      selectedIdx: null,
      detailWidth: 420,
      livePaused: false,
    });

    renderHook(() => usePersistEffect());

    // Active state on lk-A.
    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0)] });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 1,
        loadedBytes: 10,
        totalBytes: 10,
        percent: 100,
      },
    });
    useAppStore.getState().setSearchQuery("from-A");
    useAppStore.getState().setGrouping("session");

    // Switch to lk-B (filters first reset, then hydrate on snapshot-end).
    useAppStore.setState({
      logKey: "lk-B",
      rows: [],
      loadProgress: { phase: "idle", loadedRows: 0, loadedBytes: 0 },
    });
    expect(useAppStore.getState().searchQuery).toBe("");

    // Baseline complete on lk-B: stored prefs hydrate.
    useAppStore.setState({ rows: Array.from({ length: 3 }, (_, i) => makeRow(i)) });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 3,
        loadedBytes: 30,
        totalBytes: 30,
        percent: 100,
      },
    });
    const s = useAppStore.getState();
    expect(s.searchQuery).toBe("from-B");
    expect(s.grouping).toBe("session+turn");
    expect(Array.from(s.groupCollapsed)).toEqual(["bg1"]);
  });

  it("saveForLogKey throws QuotaExceededError → subsequent mutations no-op (disabled)", () => {
    const spy = vi.spyOn(persistenceModule, "persistPerLogPrefs").mockImplementation(() => {
      const e = new Error("quota");
      e.name = "QuotaExceededError";
      throw e;
    });

    renderHook(() => usePersistEffect());
    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0)] });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 1,
        loadedBytes: 10,
        totalBytes: 10,
        percent: 100,
      },
    });

    useAppStore.getState().setSearchQuery("first");
    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenCalledTimes(1);

    // Subsequent mutation should not trigger another save (disabled).
    useAppStore.getState().setSearchQuery("second");
    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("groupCollapsed with 1500 entries is trimmed to 1000 in saved payload", () => {
    const spy = vi.spyOn(persistenceModule, "persistPerLogPrefs");
    renderHook(() => usePersistEffect());

    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0)] });
    useAppStore.setState({
      loadProgress: {
        phase: "complete",
        loadedRows: 1,
        loadedBytes: 10,
        totalBytes: 10,
        percent: 100,
      },
    });
    spy.mockClear();

    const big = new Set<string>();
    for (let i = 0; i < 1500; i++) big.add(`k${i}`);
    useAppStore.setState({ groupCollapsed: big });

    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[1].groupCollapsed).toHaveLength(1000);
  });
});
