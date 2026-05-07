// @vitest-environment jsdom
/**
 * Tests for searchEvents fetch function and useSearch hook (Plan 03-05).
 * Environment: jsdom (packages/ui/vitest.config.ts)
 */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearch } from "../components/filters/useSearch.js";
import { useAppStore } from "../state/store.js";
import { searchEvents } from "./search-client.js";

// ── searchEvents ──────────────────────────────────────────────────────────────

describe("searchEvents", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("fetches the correct endpoint with q and limit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [1, 2, 3], total: 3, truncated: false }),
    });

    const result = await searchEvents("initialize");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/log/search?q=initialize&limit=5000",
      expect.anything(),
    );
    expect(result).toEqual({ matches: [1, 2, 3], total: 3, truncated: false });
  });

  it("returns SearchResult shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [0, 5, 10], total: 3, truncated: false }),
    });
    const r = await searchEvents("foo");
    expect(Array.isArray(r.matches)).toBe(true);
    expect(typeof r.total).toBe("number");
    expect(typeof r.truncated).toBe("boolean");
  });

  it("throws when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(searchEvents("bad")).rejects.toThrow("Search failed: 500");
  });

  it("passes AbortSignal to fetch when provided", async () => {
    const ctrl = new AbortController();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [], total: 0, truncated: false }),
    });
    await searchEvents("test", ctrl.signal);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(ctrl.signal);
  });

  it("does not pass signal property when signal is undefined", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ matches: [], total: 0, truncated: false }),
    });
    await searchEvents("test");
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    // signal should not be set when not provided
    expect(Object.hasOwn(init, "signal")).toBe(false);
  });

  it("propagates AbortError when signal is aborted", async () => {
    const ctrl = new AbortController();
    const abortError = new DOMException("aborted", "AbortError");
    mockFetch.mockRejectedValueOnce(abortError);
    ctrl.abort();
    await expect(searchEvents("foo", ctrl.signal)).rejects.toThrow("aborted");
  });
});

// ── useSearch ─────────────────────────────────────────────────────────────────

describe("useSearch", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    useAppStore.setState({ searchQuery: "", searchMatches: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    cleanup();
  });

  it("dispatches setSearchMatches(null) immediately when query is empty", () => {
    useAppStore.setState({ searchQuery: "", searchMatches: new Set([1, 2]) });
    renderHook(() => useSearch());
    expect(useAppStore.getState().searchMatches).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("debounces 150ms before fetching", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [0], total: 1, truncated: false }),
    });

    renderHook(() => useSearch());

    // Set query
    useAppStore.setState({ searchQuery: "init" });

    // Before debounce fires, no fetch
    vi.advanceTimersByTime(100);
    expect(mockFetch).not.toHaveBeenCalled();

    // After debounce fires
    await vi.advanceTimersByTimeAsync(150);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[0]).toMatch("/api/log/search?q=init&limit=5000");
  });

  it("rapid keystrokes produce only one network request", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [], total: 0, truncated: false }),
    });

    renderHook(() => useSearch());

    useAppStore.setState({ searchQuery: "i" });
    vi.advanceTimersByTime(50);
    useAppStore.setState({ searchQuery: "in" });
    vi.advanceTimersByTime(50);
    useAppStore.setState({ searchQuery: "ini" });

    // Only one final request after debounce
    await vi.advanceTimersByTimeAsync(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[0]).toMatch("q=ini");
  });

  it("dispatches setSearchMatches with returned matches", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [2, 5, 8], total: 3, truncated: false }),
    });

    renderHook(() => useSearch());
    useAppStore.setState({ searchQuery: "test" });
    await vi.advanceTimersByTimeAsync(200);

    const s = useAppStore.getState();
    expect(s.searchMatches).toEqual(new Set([2, 5, 8]));
  });

  it("dispatches setSearchMatches(null) when query becomes empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [1], total: 1, truncated: false }),
    });

    renderHook(() => useSearch());
    useAppStore.setState({ searchQuery: "foo" });
    await vi.advanceTimersByTimeAsync(200);

    // Now clear — wait for React to flush effects
    useAppStore.setState({ searchQuery: "" });
    await vi.advanceTimersByTimeAsync(0);
    expect(useAppStore.getState().searchMatches).toBeNull();
  });

  it("WR-02: in-flight request is aborted when query changes before it resolves", async () => {
    // Capture the AbortSignal passed to the first fetch.
    let capturedSignal: AbortSignal | undefined;
    mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      // Never resolves — simulates in-flight
      return new Promise(() => {});
    });

    renderHook(() => useSearch());

    // Start first query and advance past debounce so fetch fires
    useAppStore.setState({ searchQuery: "slow" });
    await vi.advanceTimersByTimeAsync(200);

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    // Change query — WR-02 fix: cleanup must abort the in-flight request signal
    useAppStore.setState({ searchQuery: "fast" });
    await vi.advanceTimersByTimeAsync(0); // flush React effects / cleanup

    expect(capturedSignal?.aborted).toBe(true);
  });
});
