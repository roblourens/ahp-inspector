import type { EventRow } from "@ahp-viewer/core";
import { useDeferredValue, useMemo } from "react";
import { applyFacets, isFiltersEmpty } from "./filters.js";
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
    }
  | { kind: "gap-banner"; prev: number; curr: number; virtualIdx: number };

// ── filteredRows ──────────────────────────────────────────────────────────────
export function useFilteredRows(): number[] {
  const rows = useAppStore((s) => s.rows);
  const filters = useAppStore((s) => s.filters);
  const searchMatches = useAppStore((s) => s.searchMatches);
  const deferredFilters = useDeferredValue(filters);
  const deferredMatches = useDeferredValue(searchMatches);
  return useMemo(() => {
    const noFacets = isFiltersEmpty(deferredFilters);
    const noSearch = deferredMatches === null;
    if (noFacets && noSearch) return rows.map((_, i) => i);
    const result: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      if (!noFacets && !applyFacets(row, deferredFilters)) continue;
      if (!noSearch && !deferredMatches?.has(i)) continue;
      result.push(i);
    }
    return result;
  }, [rows, deferredFilters, deferredMatches]);
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
export function useGroupedItems(filteredRowIdxs: number[]): VirtualItem[] {
  const rows = useAppStore((s) => s.rows);
  const grouping = useAppStore((s) => s.grouping);
  return useMemo(
    () => buildGroupedItems(rows, filteredRowIdxs, grouping),
    [rows, filteredRowIdxs, grouping],
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
      if (row.gapBefore) {
        const prevSeq = row.serverSeq !== null ? row.serverSeq - 1 : 0;
        items.push({
          kind: "gap-banner",
          prev: prevSeq,
          curr: row.serverSeq ?? 0,
          virtualIdx: items.length,
        });
      }
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
    if (row.gapBefore) {
      const prevSeq = row.serverSeq !== null ? row.serverSeq - 1 : 0;
      items.push({
        kind: "gap-banner",
        prev: prevSeq,
        curr: row.serverSeq ?? 0,
        virtualIdx: items.length,
      });
    }
    items.push({ kind: "row", rowIdx });
  }
  return items;
}
