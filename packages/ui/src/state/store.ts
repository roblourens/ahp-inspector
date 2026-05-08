import type { EventRow, LatencyBand, Status } from "@ahp-viewer/core";
import { create } from "zustand";
import { EMPTY_FILTERS, type FilterState } from "./filters.js";

export type { FilterState } from "./filters.js";

export type GroupingMode = "none" | "session" | "session+turn";

export interface DetailData {
  idx: number;
  loading: boolean;
  error: string | null;
  event: unknown | null;
  pairEvent: unknown | null;
  latencyMs: number | null;
  status: Status | null;
  pairIdx: number | null;
}

export type Connection = "connecting" | "connected" | "disconnected" | "no-server" | "no-log";

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
  // Phase 3: search
  searchQuery: string;
  searchMatches: Set<number> | null;
  setSearchQuery(q: string): void;
  setSearchMatches(matches: number[] | null): void;
  // Phase 3: filters
  filters: FilterState;
  setFilters(f: FilterState): void;
  patchFilter<K extends keyof FilterState>(key: K, value: FilterState[K]): void;
  clearFilters(): void;
  // Phase 3: grouping
  grouping: GroupingMode;
  groupCollapsed: Set<string>;
  setGrouping(mode: GroupingMode): void;
  toggleGroupCollapsed(key: string): void;
  // Phase 3: detail panel
  selectedDetail: DetailData | null;
  detailWidth: number;
  setSelectedDetail(d: DetailData | null): void;
  setDetailWidth(px: number): void;
  // Phase 4: live tail
  livePaused: boolean;
  pendingBuffer: EventRow[];
  pendingNewCount: number;
  followLatest: boolean;
  lastWatchError: { code: "read-error" | "watch-fatal"; message: string } | null;
  logKey: string | null;
  rotationNotice: boolean;
  lastOpenRef: { kind: "candidate"; id: string } | { kind: "path"; path: string } | null;
  setLivePaused(p: boolean): void;
  clearPendingNewCount(): void;
  flushPendingBuffer(): void;
  setLastWatchError(e: { code: "read-error" | "watch-fatal"; message: string } | null): void;
  setLogKey(k: string | null): void;
  setRotationNotice(v: boolean): void;
  setLastOpenRef(
    ref: { kind: "candidate"; id: string } | { kind: "path"; path: string } | null,
  ): void;
  resetForRotation(): void;
  resetForLogSwitch(): void;
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
      // Phase 4 D-13: while live-paused, incoming rows accumulate in a hidden
      // buffer + counter instead of mutating visible rows. NewEventsPill flushes
      // them when the user clicks "Resume Following".
      if (s.livePaused) {
        return {
          pendingBuffer: s.pendingBuffer.concat(newRows),
          pendingNewCount: s.pendingNewCount + newRows.length,
        };
      }
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
  // Phase 3 initial state
  searchQuery: "",
  searchMatches: null,
  filters: EMPTY_FILTERS,
  grouping: "none",
  groupCollapsed: new Set<string>(),
  selectedDetail: null,
  detailWidth: 420,
  // Phase 3 actions
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchMatches: (matches) => set({ searchMatches: matches !== null ? new Set(matches) : null }),
  setFilters: (f) => set({ filters: f }),
  patchFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  clearFilters: () => set({ filters: EMPTY_FILTERS, searchQuery: "", searchMatches: null }),
  setGrouping: (mode) => set({ grouping: mode }),
  toggleGroupCollapsed: (key) =>
    set((s) => {
      const next = new Set(s.groupCollapsed);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { groupCollapsed: next };
    }),
  setSelectedDetail: (d) => set({ selectedDetail: d }),
  setDetailWidth: (px) => set({ detailWidth: Math.max(360, Math.min(720, px)) }),
  // Phase 4 initial state
  livePaused: false,
  pendingBuffer: [],
  pendingNewCount: 0,
  followLatest: true,
  lastWatchError: null,
  logKey: null,
  rotationNotice: false,
  lastOpenRef: null,
  // Phase 4 actions
  setLivePaused: (p) => set({ livePaused: p }),
  clearPendingNewCount: () => set({ pendingNewCount: 0 }),
  flushPendingBuffer: () =>
    set((s) => {
      if (s.pendingBuffer.length === 0) {
        return { pendingNewCount: 0 };
      }
      const next = s.rows.concat(s.pendingBuffer);
      return {
        rows: next,
        pendingBuffer: [],
        pendingNewCount: 0,
        meta: s.meta
          ? { ...s.meta, eventCount: next.length, sessionCount: deriveSessionCount(next) }
          : s.meta,
      };
    }),
  setLastWatchError: (e) => set({ lastWatchError: e }),
  setLogKey: (k) => set({ logKey: k }),
  setRotationNotice: (v) => set({ rotationNotice: v }),
  setLastOpenRef: (ref) => set({ lastOpenRef: ref }),
  resetForRotation: () =>
    set({
      rows: [],
      selectedIdx: null,
      selectedDetail: null,
      searchMatches: null,
      pendingBuffer: [],
      pendingNewCount: 0,
    }),
  resetForLogSwitch: () =>
    set({
      rows: [],
      selectedIdx: null,
      selectedDetail: null,
      searchMatches: null,
      pendingBuffer: [],
      pendingNewCount: 0,
      meta: null,
      logKey: null,
      lastWatchError: null,
      rotationNotice: false,
    }),
}));
