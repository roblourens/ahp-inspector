import type { EventRow, Status } from "@ahp-viewer/core";
import type { EventKind } from "@ahp-viewer/shared";

export interface FilterState {
  direction: ("c2s" | "s2c")[];
  kind: EventKind[];
  method: string[];
  actionType: string[];
  session: string[];
  turn: string[];
  status: Status[];
  timeFrom: number | null;
  timeTo: number | null;
}

export const EMPTY_FILTERS: FilterState = {
  direction: [],
  kind: [],
  method: [],
  actionType: [],
  session: [],
  turn: [],
  status: [],
  timeFrom: null,
  timeTo: null,
};

export function isFiltersEmpty(f: FilterState): boolean {
  return (
    f.direction.length === 0 &&
    f.kind.length === 0 &&
    f.method.length === 0 &&
    f.actionType.length === 0 &&
    f.session.length === 0 &&
    f.turn.length === 0 &&
    f.status.length === 0 &&
    f.timeFrom === null &&
    f.timeTo === null
  );
}

/**
 * Returns true when the row passes ALL active filter dimensions.
 * An empty array for a dimension means "no filter on this dimension" (match-all).
 */
export function applyFacets(row: EventRow, f: FilterState): boolean {
  if (f.direction.length > 0 && !f.direction.includes(row.dir as "c2s" | "s2c")) return false;
  if (f.kind.length > 0 && !f.kind.includes(row.kind)) return false;
  if (f.method.length > 0 && (row.method === null || !f.method.includes(row.method))) return false;
  if (
    f.actionType.length > 0 &&
    (row.actionType === null || !f.actionType.includes(row.actionType))
  )
    return false;
  if (f.session.length > 0 && (row.sessionId === null || !f.session.includes(row.sessionId)))
    return false;
  if (f.turn.length > 0 && (row.turnId === null || !f.turn.includes(row.turnId))) return false;
  if (f.status.length > 0 && !f.status.includes(row.status)) return false;
  if (f.timeFrom !== null && row.ts < f.timeFrom) return false;
  if (f.timeTo !== null && row.ts > f.timeTo) return false;
  return true;
}
