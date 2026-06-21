import type { EventRow } from "@ahp-inspector/core";
import { useDeferredValue, useMemo } from "react";
import { applyFacets, type FilterState, isFiltersEmpty } from "./filters.js";
import { type GroupingMode, useAppStore } from "./store.js";

export type VirtualItem =
  | { kind: "row"; rowIdx: number }
  | {
      kind: "header";
      level: "session" | "turn";
      groupKey: string;
      sessionId: string;
      turnId?: string;
      count: number;
      durationMs: number;
    };

/**
 * Single-entry referential memo (reselect-style). Returns the previous result
 * when every dependency is identical (===) to the previous call. Sharing one
 * instance across components dedupes derivation: the timeline, status bar and
 * filter bar all read the same rows/filters in one render pass, so the heavy
 * loop runs once and the rest hit the cache — and every caller receives the
 * same array reference, which keeps downstream memos stable.
 */
function singleEntryMemo<R>(): (deps: readonly unknown[], compute: () => R) => R {
  let prevDeps: readonly unknown[] | null = null;
  let prevResult: R;
  return (deps, compute) => {
    if (
      prevDeps !== null &&
      prevDeps.length === deps.length &&
      prevDeps.every((d, i) => d === deps[i])
    ) {
      return prevResult;
    }
    prevResult = compute();
    prevDeps = deps;
    return prevResult;
  };
}

/**
 * True when `filters` is exactly the app default (only `ping` hidden). This is
 * the state the app starts in and stays in until the user filters something,
 * so it gets a dedicated cheap predicate instead of the full facet machinery.
 */
function isDefaultPingFilter(f: FilterState): boolean {
  return (
    f.method.length === 1 &&
    f.method[0] === "ping" &&
    f.direction.length === 0 &&
    f.kind.length === 0 &&
    f.actionType.length === 0 &&
    f.session.length === 0 &&
    f.turn.length === 0 &&
    f.status.length === 0 &&
    f.rowText.trim() === "" &&
    f.timeFrom === null &&
    f.timeTo === null
  );
}

/** Cheap default-state predicate: hide `ping` requests and their responses. */
function passesDefaultPing(rows: EventRow[], row: EventRow): boolean {
  if (row.method === "ping") return false;
  if (row.method === null && typeof row.pairIdx === "number") {
    return rows[row.pairIdx]?.method !== "ping";
  }
  return true;
}

function computeFilteredRows(rows: EventRow[], filters: FilterState): number[] {
  if (isFiltersEmpty(filters)) return rows.map((_, i) => i);
  const defaultPing = isDefaultPingFilter(filters);
  const result: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const visible = defaultPing
      ? passesDefaultPing(rows, row)
      : applyFacetsForRows(rows, row, filters);
    if (visible) result.push(i);
  }
  return result;
}

// ── filteredRows ──────────────────────────────────────────────────────────────
const filteredRowsMemo = singleEntryMemo<number[]>();

export function useFilteredRows(): number[] {
  const rows = useAppStore((s) => s.rows);
  const filters = useAppStore((s) => s.filters);
  const deferredFilters = useDeferredValue(filters);
  return filteredRowsMemo([rows, deferredFilters], () =>
    computeFilteredRows(rows, deferredFilters),
  );
}

const visibleSearchMatchesMemo = singleEntryMemo<number[]>();

export function useVisibleSearchMatches(): number[] {
  const rows = useAppStore((s) => s.rows);
  const filters = useAppStore((s) => s.filters);
  const searchMatches = useAppStore((s) => s.searchMatches);
  const deferredFilters = useDeferredValue(filters);
  const deferredMatches = useDeferredValue(searchMatches);
  return visibleSearchMatchesMemo([rows, deferredFilters, deferredMatches], () => {
    if (deferredMatches === null) return [];
    const noFacets = isFiltersEmpty(deferredFilters);
    const defaultPing = !noFacets && isDefaultPingFilter(deferredFilters);
    const result: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !deferredMatches.has(i)) continue;
      const visible = noFacets
        ? true
        : defaultPing
          ? passesDefaultPing(rows, row)
          : applyFacetsForRows(rows, row, deferredFilters);
      if (visible) result.push(i);
    }
    return result;
  });
}

function applyFacetsForRows(rows: EventRow[], row: EventRow, filters: FilterState): boolean {
  if (!applyFacets(row, filters)) return false;
  if (row.method !== null || filters.method.length === 0) return true;
  const pairedMethod = typeof row.pairIdx === "number" ? (rows[row.pairIdx]?.method ?? null) : null;
  return pairedMethod === null || !filters.method.includes(pairedMethod);
}

// ── facetCounts ───────────────────────────────────────────────────────────────
export interface FacetCounts {
  direction: Map<string, number>;
  kind: Map<string, number>;
  method: Map<string, number>;
  actionType: Map<string, number>;
  session: Map<string, number>;
  turn: Map<string, number>;
  status: Map<string, number>;
}

export function useFacetCounts(): FacetCounts {
  const rows = useAppStore((s) => s.rows);
  return useMemo(() => {
    const r: FacetCounts = {
      direction: new Map(),
      kind: new Map(),
      method: new Map(),
      actionType: new Map(),
      session: new Map(),
      turn: new Map(),
      status: new Map(),
    };
    for (const row of rows) {
      if (!row) continue;
      inc(r.direction, row.dir);
      inc(r.kind, row.kind);
      if (row.method) inc(r.method, row.method);
      if (row.actionType) inc(r.actionType, row.actionType);
      if (row.sessionId) inc(r.session, row.sessionId);
      if (row.turnId) inc(r.turn, row.turnId);
      inc(r.status, row.status);
    }
    return r;
  }, [rows]);
}

function inc(m: Map<string, number>, k: string): void {
  m.set(k, (m.get(k) ?? 0) + 1);
}

// ── groupedItems ──────────────────────────────────────────────────────────────
const groupedItemsMemo = singleEntryMemo<VirtualItem[]>();

export function useGroupedItems(filteredRowIdxs: number[]): VirtualItem[] {
  const rows = useAppStore((s) => s.rows);
  const grouping = useAppStore((s) => s.grouping);
  return groupedItemsMemo([rows, filteredRowIdxs, grouping], () =>
    buildGroupedItems(rows, filteredRowIdxs, grouping),
  );
}

function buildGroupedItems(
  rows: EventRow[],
  idxs: number[],
  grouping: GroupingMode,
): VirtualItem[] {
  if (grouping === "none") {
    const items: VirtualItem[] = [];
    for (const rowIdx of idxs) {
      const row = rows[rowIdx];
      if (!row) continue;
      items.push({ kind: "row", rowIdx });
    }
    return items;
  }

  const items: VirtualItem[] = [];
  let lastSession: string | null = null;
  let lastTurn: string | null = null;
  const groupStartTs = new Map<string, number>();
  const groupEndTs = new Map<string, number>();
  const groupCount = new Map<string, number>();

  // Pre-pass to compute group stats.
  for (const rowIdx of idxs) {
    const row = rows[rowIdx];
    if (!row) continue;
    const sKey = row.sessionId ?? "__none__";
    const tKey = grouping === "session+turn" ? `${sKey}::${row.turnId ?? "__none__"}` : sKey;
    const key = grouping === "session" ? sKey : tKey;
    if (!groupStartTs.has(key)) groupStartTs.set(key, row.ts);
    groupEndTs.set(key, row.ts);
    groupCount.set(key, (groupCount.get(key) ?? 0) + 1);
  }

  for (const rowIdx of idxs) {
    const row = rows[rowIdx];
    if (!row) continue;
    const sessionId = row.sessionId ?? "__none__";
    const turnId = row.turnId ?? "__none__";

    if (sessionId !== lastSession) {
      lastSession = sessionId;
      lastTurn = null;
      const key = sessionId;
      const start = groupStartTs.get(key) ?? row.ts;
      const end = groupEndTs.get(key) ?? row.ts;
      items.push({
        kind: "header",
        level: "session",
        groupKey: key,
        sessionId: row.sessionId ?? "",
        count: groupCount.get(key) ?? 1,
        durationMs: end - start,
      });
    }
    if (grouping === "session+turn" && turnId !== lastTurn) {
      lastTurn = turnId;
      const key = `${sessionId}::${turnId}`;
      const start = groupStartTs.get(key) ?? row.ts;
      const end = groupEndTs.get(key) ?? row.ts;
      items.push({
        kind: "header",
        level: "turn",
        groupKey: key,
        sessionId: row.sessionId ?? "",
        ...(row.turnId !== null ? { turnId: row.turnId } : {}),
        count: groupCount.get(key) ?? 1,
        durationMs: end - start,
      });
    }
    items.push({ kind: "row", rowIdx });
  }
  return items;
}
