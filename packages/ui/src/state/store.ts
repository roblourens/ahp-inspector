import type { EventRow, LatencyBand, Status } from "@ahp-viewer/core";
import { create } from "zustand";

export type Connection = "connecting" | "connected" | "disconnected" | "no-server";

export interface MetaSummary {
  filename: string;
  eventCount: number;
  sessionCount: number;
}

export interface PatchUpdate {
  idx: number;
  status: Status;
  latencyMs: number | null;
  latencyBand: LatencyBand | null;
}

export interface AppStoreState {
  rows: EventRow[];
  connection: Connection;
  selectedIdx: number | null;
  meta: MetaSummary | null;
  setRows(rows: EventRow[]): void;
  appendRows(rows: EventRow[], from: number): void;
  applyPatch(updates: PatchUpdate[]): void;
  setConnection(c: Connection): void;
  setMeta(m: MetaSummary | null): void;
  selectIdx(idx: number | null): void;
  clearSelection(): void;
}

function deriveSessionCount(rows: EventRow[]): number {
  const s = new Set<string>();
  for (const r of rows) if (r.sessionId) s.add(r.sessionId);
  return s.size;
}

export const useAppStore = create<AppStoreState>((set) => ({
  rows: [],
  connection: "connecting",
  selectedIdx: null,
  meta: null,
  setRows: (rows) =>
    set((s) => ({
      rows,
      meta: s.meta
        ? { ...s.meta, eventCount: rows.length, sessionCount: deriveSessionCount(rows) }
        : s.meta,
    })),
  appendRows: (newRows, from) =>
    set((s) => {
      const next = s.rows.slice();
      for (let i = 0; i < newRows.length; i++) {
        const row = newRows[i];
        if (row !== undefined) next[from + i] = row;
      }
      return {
        rows: next,
        meta: s.meta
          ? { ...s.meta, eventCount: next.length, sessionCount: deriveSessionCount(next) }
          : s.meta,
      };
    }),
  applyPatch: (updates) =>
    set((s) => {
      const next = s.rows.slice();
      for (const u of updates) {
        const prev = next[u.idx];
        if (prev) {
          next[u.idx] = {
            ...prev,
            status: u.status,
            latencyMs: u.latencyMs,
            latencyBand: u.latencyBand,
          };
        }
      }
      return { rows: next };
    }),
  setConnection: (connection) => set({ connection }),
  setMeta: (meta) => set({ meta }),
  selectIdx: (selectedIdx) => set({ selectedIdx }),
  clearSelection: () => set({ selectedIdx: null }),
}));
