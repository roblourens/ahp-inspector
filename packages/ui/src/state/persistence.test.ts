// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "./filters.js";
import {
  clearPerLogPrefs,
  loadPerLogPrefs,
  persistPerLogPrefs,
  type PerLogPrefs,
} from "./persistence.js";

const sample: PerLogPrefs = {
  v: 1,
  searchQuery: "foo",
  filters: EMPTY_FILTERS,
  grouping: "session",
  groupCollapsed: ["a", "b"],
  selectedIdx: 12,
  detailWidth: 480,
  livePaused: false,
};

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("persistPerLogPrefs / loadPerLogPrefs", () => {
  it("returns null when no entry exists", () => {
    expect(loadPerLogPrefs("missing")).toBeNull();
  });
  it("round-trips a saved entry", () => {
    persistPerLogPrefs("k1", sample);
    expect(loadPerLogPrefs("k1")).toEqual(sample);
  });
  it("clearPerLogPrefs removes only the targeted key", () => {
    persistPerLogPrefs("k1", sample);
    persistPerLogPrefs("k2", sample);
    clearPerLogPrefs("k1");
    expect(loadPerLogPrefs("k1")).toBeNull();
    expect(loadPerLogPrefs("k2")).not.toBeNull();
  });
  it("returns null when stored entry has wrong schema version", () => {
    localStorage.setItem(
      "ahp-log-prefs-v1",
      JSON.stringify({ k1: { v: 99, _writtenAt: 1 } }),
    );
    expect(loadPerLogPrefs("k1")).toBeNull();
  });
  it("LRU-caps at 50 entries (oldest evicted)", () => {
    let now = 1;
    vi.spyOn(Date, "now").mockImplementation(() => now++);
    for (let i = 0; i < 51; i++) persistPerLogPrefs(`k${i}`, sample);
    expect(loadPerLogPrefs("k0")).toBeNull();
    expect(loadPerLogPrefs("k50")).not.toBeNull();
    vi.restoreAllMocks();
  });
  it("truncates groupCollapsed at 1000 entries on persist", () => {
    const big = {
      ...sample,
      groupCollapsed: new Array(1500).fill(0).map((_, i) => `g${i}`),
    };
    persistPerLogPrefs("k1", big);
    const loaded = loadPerLogPrefs("k1");
    expect(loaded?.groupCollapsed.length).toBe(1000);
  });
  it("silently no-ops if localStorage.setItem throws (quota)", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceeded");
    };
    expect(() => persistPerLogPrefs("k1", sample)).not.toThrow();
    Storage.prototype.setItem = orig;
  });
});
