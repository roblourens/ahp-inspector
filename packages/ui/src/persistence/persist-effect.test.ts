// @vitest-environment jsdom
// usePersistEffect tests — Plan 04-06 Task 3 (TDD).

import type { EventRow } from "@ahp-viewer/core";
import { renderHook } from "@testing-library/react";
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
    filters: EMPTY_FILTERS,
    grouping: "none",
    groupCollapsed: new Set<string>(),
    detailWidth: 420,
    livePaused: false,
    pendingBuffer: [],
    pendingNewCount: 0,
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  resetStore();
});

describe("usePersistEffect — Plan 04-06 Task 3", () => {
  it("snapshot-end with no stored prefs leaves store untouched", () => {
    renderHook(() => usePersistEffect());
    // Trigger snapshot-end: logKey set, rows populated.
    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0), makeRow(1)] });
    const s = useAppStore.getState();
    expect(s.searchQuery).toBe("");
    expect(s.grouping).toBe("none");
    expect(s.selectedIdx).toBeNull();
  });

  it("snapshot-end with stored prefs applies filters/grouping/selectedIdx (in range)", () => {
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

    renderHook(() => usePersistEffect());
    useAppStore.setState({
      logKey: "lk-A",
      rows: Array.from({ length: 10 }, (_, i) => makeRow(i)),
    });

    const s = useAppStore.getState();
    expect(s.searchQuery).toBe("hello");
    expect(s.grouping).toBe("session");
    expect(s.detailWidth).toBe(500);
    expect(s.selectedIdx).toBe(5);
    expect(Array.from(s.groupCollapsed).sort()).toEqual(["g1", "g2"]);
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

    expect(useAppStore.getState().selectedIdx).toBeNull();
  });

  it("after hydration, mutating filters triggers debounced save 250ms later", () => {
    const spy = vi.spyOn(persistenceModule, "persistPerLogPrefs");
    renderHook(() => usePersistEffect());

    // Establish snapshot for lk-A.
    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0)] });
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

  it("switching logKey flushes prior log's prefs synchronously before subscribing for new log", () => {
    const spy = vi.spyOn(persistenceModule, "persistPerLogPrefs");
    renderHook(() => usePersistEffect());

    // Snapshot for A, mutate, but don't yet flush debounce.
    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0)] });
    spy.mockClear();
    useAppStore.getState().setSearchQuery("a-query");
    expect(spy).not.toHaveBeenCalled();

    // Now switch to logKey B (resetForLogSwitch-style).
    useAppStore.setState({ logKey: "lk-B", rows: [] });

    // Old logKey A's pending save must have flushed synchronously.
    expect(spy).toHaveBeenCalled();
    const flushed = spy.mock.calls.find((c) => c[0] === "lk-A");
    expect(flushed).toBeTruthy();
    expect(flushed?.[1].searchQuery).toBe("a-query");
  });

  it("saveForLogKey throws QuotaExceededError → subsequent mutations no-op (disabled)", () => {
    const spy = vi
      .spyOn(persistenceModule, "persistPerLogPrefs")
      .mockImplementation(() => {
        const e = new Error("quota");
        e.name = "QuotaExceededError";
        throw e;
      });

    renderHook(() => usePersistEffect());
    useAppStore.setState({ logKey: "lk-A", rows: [makeRow(0)] });

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
    spy.mockClear();

    const big = new Set<string>();
    for (let i = 0; i < 1500; i++) big.add(`k${i}`);
    useAppStore.setState({ groupCollapsed: big });

    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[1].groupCollapsed).toHaveLength(1000);
  });
});
