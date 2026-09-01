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

export type PersistenceWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "storage-unavailable" };

interface CommonFields {
  readonly searchQuery: string;
  readonly grouping: GroupingMode;
  readonly groupCollapsed: string[];
  readonly selectedIdx: number | null;
  readonly detailWidth: number;
  readonly livePaused: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAll(): Storage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) return parsed;
  } catch {
    /* malformed → reset */
  }
  return {};
}

function writeAll(s: Storage): PersistenceWriteResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return { ok: true };
  } catch {
    return { ok: false, reason: "storage-unavailable" };
  }
}

function hasCommonFields(r: Record<string, unknown>): r is Record<string, unknown> & CommonFields {
  return (
    typeof r.searchQuery === "string" &&
    (r.grouping === "none" || r.grouping === "session" || r.grouping === "session+turn") &&
    decodeStringArray(r.groupCollapsed) !== null &&
    (r.selectedIdx === null || typeof r.selectedIdx === "number") &&
    typeof r.detailWidth === "number" &&
    typeof r.livePaused === "boolean"
  );
}

function decodeV2Filters(value: unknown): FilterState | null {
  if (!isRecord(value)) return null;
  const filters = value;
  const direction = decodeStringArray(filters.direction);
  const kind = decodeStringArray(filters.kind);
  const method = decodeStringArray(filters.method);
  const actionType = decodeStringArray(filters.actionType);
  const session = decodeStringArray(filters.session);
  const turn = decodeStringArray(filters.turn);
  const status = decodeStringArray(filters.status);
  if (!direction || !kind || !method || !actionType || !session || !turn || !status) return null;
  if (!direction.every(isDirection)) return null;
  if (!kind.every(isEventKind)) return null;
  if (!status.every(isStatus)) return null;
  if (typeof filters.rowText !== "string") return null;
  if (filters.timeFrom !== null && typeof filters.timeFrom !== "number") return null;
  if (filters.timeTo !== null && typeof filters.timeTo !== "number") return null;
  return {
    direction,
    kind,
    method,
    actionType,
    session,
    turn,
    status,
    rowText: filters.rowText,
    timeFrom: filters.timeFrom,
    timeTo: filters.timeTo,
  };
}

function decodeStringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function isDirection(value: string): value is FilterState["direction"][number] {
  return value === "c2s" || value === "s2c";
}

function isEventKind(value: string): value is FilterState["kind"][number] {
  return [
    "request",
    "response",
    "client-notification",
    "server-notification",
    "action",
    "protocol-notification",
    "log",
    "parse-error",
  ].includes(value);
}

function isStatus(value: string): value is FilterState["status"][number] {
  return ["ok", "error", "pending", "unmatched", "orphan", "n/a"].includes(value);
}

function migrateV1Filters(value: unknown): FilterState {
  if (!isRecord(value)) return APP_DEFAULT_FILTERS;
  const filters = value;

  const extractFilterArray = <T extends string>(
    field: unknown,
    defaultValue: readonly T[],
    isValue: (value: string) => value is T,
  ): T[] => {
    const values = decodeStringArray(field);
    return values ? values.filter(isValue) : [...defaultValue];
  };
  const isString = (item: string): item is string => true;

  return {
    direction: extractFilterArray(filters.direction, APP_DEFAULT_FILTERS.direction, isDirection),
    kind: extractFilterArray(filters.kind, APP_DEFAULT_FILTERS.kind, isEventKind),
    method: extractFilterArray(filters.method, APP_DEFAULT_FILTERS.method, isString),
    actionType: extractFilterArray(filters.actionType, APP_DEFAULT_FILTERS.actionType, isString),
    session: extractFilterArray(filters.session, APP_DEFAULT_FILTERS.session, isString),
    turn: extractFilterArray(filters.turn, APP_DEFAULT_FILTERS.turn, isString),
    status: extractFilterArray(filters.status, APP_DEFAULT_FILTERS.status, isStatus),
    rowText: typeof filters.rowText === "string" ? filters.rowText : APP_DEFAULT_FILTERS.rowText,
    timeFrom:
      filters.timeFrom === null || typeof filters.timeFrom === "number" ? filters.timeFrom : null,
    timeTo: filters.timeTo === null || typeof filters.timeTo === "number" ? filters.timeTo : null,
  };
}

function decodePrefs(e: unknown): PerLogPrefs | null {
  if (!isRecord(e) || !hasCommonFields(e)) return null;
  const r = e;
  const filters =
    r.v === 2 ? decodeV2Filters(r.filters) : r.v === 1 ? migrateV1Filters(r.filters) : null;
  if (!filters) return null;
  return {
    v: 2,
    searchQuery: r.searchQuery,
    filters,
    grouping: r.grouping,
    groupCollapsed: r.groupCollapsed,
    selectedIdx: r.selectedIdx,
    detailWidth: r.detailWidth,
    livePaused: r.livePaused,
  };
}

export function loadPerLogPrefs(logKey: string): PerLogPrefs | null {
  const all = readAll();
  return decodePrefs(all[logKey]);
}

export function persistPerLogPrefs(logKey: string, prefs: PerLogPrefs): PersistenceWriteResult {
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
          isRecord(entry) && typeof entry._writtenAt === "number" ? entry._writtenAt : 0;
        return [k, writtenAt] as [string, number];
      })
      .sort((a, b) => a[1] - b[1]);
    const overflow = sorted.length - MAX_ENTRIES;
    for (let i = 0; i < overflow; i++) {
      const k = sorted[i]?.[0];
      if (k) delete all[k];
    }
  }
  return writeAll(all);
}

export function clearPerLogPrefs(logKey: string): PersistenceWriteResult {
  const all = readAll();
  if (all[logKey]) {
    delete all[logKey];
    return writeAll(all);
  }
  return { ok: true };
}
