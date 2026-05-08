// Per-log UI preferences persisted to localStorage. Phase 4 D-18 / RESEARCH §6.3-6.4.
// Local-first only — never persists log content, paths, or absolute identifiers.
// Single storage key holds an LRU map keyed by opaque logKey (D-16).

import type { FilterState } from "./filters.js";
import type { GroupingMode } from "./store.js";

const STORAGE_KEY = "ahp-log-prefs-v1";
const MAX_ENTRIES = 50;
const MAX_GROUP_COLLAPSED = 1000;

export interface PerLogPrefs {
  v: 1;
  searchQuery: string;
  filters: FilterState;
  grouping: GroupingMode;
  /** Set serialized as array, capped at MAX_GROUP_COLLAPSED entries. */
  groupCollapsed: string[];
  selectedIdx: number | null;
  detailWidth: number;
  livePaused: boolean;
}

interface StoredEntry extends PerLogPrefs {
  _writtenAt: number;
}
type Storage = Record<string, StoredEntry>;

function readAll(): Storage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Storage;
    }
  } catch {
    /* malformed → reset */
  }
  return {};
}

function writeAll(s: Storage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota or unavailable — silent */
  }
}

function isValid(e: unknown): e is StoredEntry {
  if (!e || typeof e !== "object") return false;
  const r = e as Record<string, unknown>;
  return (
    r.v === 1 &&
    typeof r.searchQuery === "string" &&
    !!r.filters &&
    typeof r.filters === "object" &&
    (r.grouping === "none" || r.grouping === "session" || r.grouping === "session+turn") &&
    Array.isArray(r.groupCollapsed) &&
    (r.selectedIdx === null || typeof r.selectedIdx === "number") &&
    typeof r.detailWidth === "number" &&
    typeof r.livePaused === "boolean"
  );
}

export function loadPerLogPrefs(logKey: string): PerLogPrefs | null {
  const all = readAll();
  const e = all[logKey];
  if (!e || !isValid(e)) return null;
  // Strip `_writtenAt` before returning the public shape.
  const { _writtenAt: _w, ...prefs } = e;
  return prefs;
}

export function persistPerLogPrefs(logKey: string, prefs: PerLogPrefs): void {
  const all = readAll();
  const trimmed: PerLogPrefs = {
    ...prefs,
    groupCollapsed: prefs.groupCollapsed.slice(0, MAX_GROUP_COLLAPSED),
  };
  all[logKey] = { ...trimmed, _writtenAt: Date.now() };
  // LRU evict to MAX_ENTRIES.
  const keys = Object.keys(all);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys
      .map((k) => [k, all[k]?._writtenAt ?? 0] as [string, number])
      .sort((a, b) => a[1] - b[1]);
    const overflow = sorted.length - MAX_ENTRIES;
    for (let i = 0; i < overflow; i++) {
      const k = sorted[i]?.[0];
      if (k) delete all[k];
    }
  }
  writeAll(all);
}

export function clearPerLogPrefs(logKey: string): void {
  const all = readAll();
  if (all[logKey]) {
    delete all[logKey];
    writeAll(all);
  }
}
