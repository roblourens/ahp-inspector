import type { EventRow, Status } from "@ahp-inspector/core";
import type { EventKind } from "@ahp-inspector/shared";

export interface FilterState {
  direction: ("c2s" | "s2c")[];
  kind: EventKind[];
  method: string[];
  actionType: string[];
  session: string[];
  turn: string[];
  status: Status[];
  rowText: string;
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
  rowText: "",
  timeFrom: null,
  timeTo: null,
};

export const APP_DEFAULT_FILTERS: FilterState = {
  ...EMPTY_FILTERS,
  method: ["ping"],
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
    f.rowText.trim() === "" &&
    f.timeFrom === null &&
    f.timeTo === null
  );
}

/**
 * Returns true when the row passes ALL active filter dimensions.
 * Categorical arrays contain hidden values; an empty array leaves that dimension visible.
 */
export function applyFacets(row: EventRow, f: FilterState): boolean {
  if (f.direction.length !== 0 && f.direction.includes(row.dir as "c2s" | "s2c")) return false;
  if (f.kind.length !== 0 && f.kind.includes(row.kind)) return false;
  if (row.method !== null && f.method.length !== 0 && f.method.includes(row.method)) return false;
  if (
    row.actionType !== null &&
    f.actionType.length !== 0 &&
    f.actionType.includes(row.actionType)
  ) {
    return false;
  }
  if (row.sessionId !== null && f.session.length !== 0 && f.session.includes(row.sessionId)) {
    return false;
  }
  if (row.turnId !== null && f.turn.length !== 0 && f.turn.includes(row.turnId)) return false;
  if (f.status.length !== 0 && f.status.includes(row.status)) return false;
  if (f.rowText !== "") {
    const rowText = f.rowText.trim().slice(0, 256).toLowerCase();
    if (rowText !== "") {
      const projectedText = [
        row.keyId,
        row.tsFmt,
        row.dir,
        row.kind,
        row.method,
        row.actionType,
        row.sessionId,
        row.sessionShort,
        row.turnId,
        row.turnShort,
        row.status,
        row.payloadPreview,
        row.summary,
        row.parseErrorReason,
      ]
        .filter((value): value is string => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();
      if (!projectedText.includes(rowText)) return false;
    }
  }
  if (f.timeFrom !== null && row.ts < f.timeFrom) return false;
  if (f.timeTo !== null && row.ts > f.timeTo) return false;
  return true;
}
