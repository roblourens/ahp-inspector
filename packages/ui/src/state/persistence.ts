// Per-log UI preferences persisted to localStorage. Phase 4 D-18 / RESEARCH §6.3-6.4.
// Local-first only — never persists log content, paths, or absolute identifiers.
// Single storage key holds an LRU map keyed by opaque logKey (D-16).

import { APP_DEFAULT_FILTERS, type FilterState } from "./filters.js";
import type { GroupingMode } from "./store.js";

const STORAGE_KEY = "ahp-log-prefs-v1";
const MAX_ENTRIES = 50;
const MAX_GROUP_COLLAPSED = 1000;

export interface PerLogPrefs {
  v: 2;
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
type Storage = Record<string, unknown>;

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

function hasCommonFields(r: Record<string, unknown>): boolean {
  return (
    typeof r.searchQuery === "string" &&
    (r.grouping === "none" || r.grouping === "session" || r.grouping === "session+turn") &&
    Array.isArray(r.groupCollapsed) &&
    r.groupCollapsed.every((value) => typeof value === "string") &&
    (r.selectedIdx === null || typeof r.selectedIdx === "number") &&
    typeof r.detailWidth === "number" &&
    typeof r.livePaused === "boolean"
  );
}

function decodeV2Filters(value: unknown): FilterState | null {
  if (!value || typeof value !== "object") return null;
  const filters = value as Record<string, unknown>;
  const arrays = [
    filters.direction,
    filters.kind,
    filters.method,
    filters.actionType,
    filters.session,
    filters.turn,
    filters.status,
  ];
  if (!arrays.every((entry) => Array.isArray(entry))) return null;
  if (!arrays.every((entry) => entry.every((item) => typeof item === "string"))) return null;
  if (typeof filters.rowText !== "string") return null;
  if (filters.timeFrom !== null && typeof filters.timeFrom !== "number") return null;
  if (filters.timeTo !== null && typeof filters.timeTo !== "number") return null;
  return filters as unknown as FilterState;
}

function migrateV1Filters(value: unknown): FilterState {
  if (!value || typeof value !== "object") return APP_DEFAULT_FILTERS;
  const filters = value as Record<string, unknown>;

  // Helper: extract and validate legacy array field, or return default
  const extractFilterArray = <T extends string>(field: unknown, defaultValue: readonly T[]): T[] => {
    if (Array.isArray(field) && field.every((item) => typeof item === "string")) {
      return field as T[];
    }
    return [...defaultValue];
  };

  return {
    direction: extractFilterArray(filters.direction, APP_DEFAULT_FILTERS.direction),
    kind: extractFilterArray(filters.kind, APP_DEFAULT_FILTERS.kind),
    method: extractFilterArray(filters.method, APP_DEFAULT_FILTERS.method),
    actionType: extractFilterArray(filters.actionType, APP_DEFAULT_FILTERS.actionType),
    session: extractFilterArray(filters.session, APP_DEFAULT_FILTERS.session),
    turn: extractFilterArray(filters.turn, APP_DEFAULT_FILTERS.turn),
    status: extractFilterArray(filters.status, APP_DEFAULT_FILTERS.status),
    rowText: typeof filters.rowText === "string" ? filters.rowText : APP_DEFAULT_FILTERS.rowText,
    timeFrom: filters.timeFrom === null || typeof filters.timeFrom === "number" ? filters.timeFrom : null,
    timeTo: filters.timeTo === null || typeof filters.timeTo === "number" ? filters.timeTo : null,
  };
}

function decodePrefs(e: unknown): PerLogPrefs | null {
  if (!e || typeof e !== "object") return null;
  const r = e as Record<string, unknown>;
  if (!hasCommonFields(r)) return null;
  const filters = r.v === 2 ? decodeV2Filters(r.filters) : r.v === 1 ? migrateV1Filters(r.filters) : null;
  if (!filters) return null;
  return {
    v: 2,
    searchQuery: r.searchQuery as string,
    filters,
    grouping: r.grouping as GroupingMode,
    groupCollapsed: r.groupCollapsed as string[],
    selectedIdx: r.selectedIdx as number | null,
    detailWidth: r.detailWidth as number,
    livePaused: r.livePaused as boolean,
  };
}

export function loadPerLogPrefs(logKey: string): PerLogPrefs | null {
  const all = readAll();
  return decodePrefs(all[logKey]);
}

export function persistPerLogPrefs(logKey: string, prefs: PerLogPrefs): void {
  const all = readAll();
  const trimmed: PerLogPrefs = {
    ...prefs,
    groupCollapsed: prefs.groupCollapsed.slice(0, MAX_GROUP_COLLAPSED),
  };
  all[logKey] = { ...trimmed, _writtenAt: Date.now() } satisfies StoredEntry;
  // LRU evict to MAX_ENTRIES.
  const keys = Object.keys(all);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys
      .map((k) => {
        const entry = all[k];
        const writtenAt =
          entry && typeof entry === "object" && typeof (entry as Record<string, unknown>)._writtenAt === "number"
            ? ((entry as Record<string, unknown>)._writtenAt as number)
            : 0;
        return [k, writtenAt] as [string, number];
      })
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
