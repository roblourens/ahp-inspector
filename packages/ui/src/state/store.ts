import type { EventRow, LatencyBand, Status } from "@ahp-inspector/core";
import { create } from "zustand";
import {
  DETAIL_DEFAULT_WIDTH,
  DETAIL_MAX_WIDTH,
  DETAIL_MIN_WIDTH,
} from "../components/detail/detail-layout.js";
import { APP_DEFAULT_FILTERS, type FilterState } from "./filters.js";

export type { FilterState } from "./filters.js";

export type GroupingMode = "none" | "session" | "session+turn";
export type SearchStatus = "idle" | "searching" | "ready" | "error";

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
  summary?: string;
  pairIdx?: number | null;
}

export interface LoadProgress {
  phase: "idle" | "loading" | "complete";
  loadedRows: number;
  loadedBytes: number;
  totalBytes?: number;
  percent?: number;
}

export interface StreamBacklog {
  queuedFrames: number;
  queuedRows: number;
}

const IDLE_LOAD_PROGRESS: LoadProgress = {
  phase: "idle",
  loadedRows: 0,
  loadedBytes: 0,
};

const EMPTY_STREAM_BACKLOG: StreamBacklog = {
  queuedFrames: 0,
  queuedRows: 0,
};

export interface AppStoreState {
  rows: EventRow[];
  connection: Connection;
  selectedIdx: number | null;
  meta: MetaSummary | null;
  loadProgress: LoadProgress;
  streamBacklog: StreamBacklog;
  setRows(rows: EventRow[]): void;
  appendSnapshotRows(rows: EventRow[], from: number): void;
  appendRows(rows: EventRow[], from: number): void;
  applyPatch(updates: PatchUpdate[]): void;
  setLoadProgress(progress: LoadProgress): void;
  setStreamBacklog(backlog: StreamBacklog): void;
  setConnection(c: Connection): void;
  setMeta(m: MetaSummary | null): void;
  selectIdx(idx: number | null): void;
  clearSelection(): void;
  // Phase 3: search
  searchQuery: string;
  searchMatches: Set<number> | null;
  searchTotal: number;
  searchTruncated: boolean;
  searchStatus: SearchStatus;
  searchError: string | null;
  searchPopoverOpen: boolean;
  setSearchQuery(q: string): void;
  setSearchMatches(matches: number[] | null): void;
  setSearchPending(): void;
  setSearchResult(matches: number[], total: number, truncated: boolean): void;
  setSearchError(message: string): void;
  clearSearchResults(): void;
  setSearchPopoverOpen(open: boolean): void;
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
  lastWatchError: {
    code: "read-error" | "watch-fatal" | "oversized-line";
    message: string;
  } | null;
  logKey: string | null;
  rotationNotice: boolean;
  lastOpenRef: { kind: "candidate"; id: string } | { kind: "path"; path: string } | null;
  setLivePaused(p: boolean): void;
  clearPendingNewCount(): void;
  flushPendingBuffer(): void;
  setLastWatchError(
    e: {
      code: "read-error" | "watch-fatal" | "oversized-line";
      message: string;
    } | null,
  ): void;
  setLogKey(k: string | null): void;
  setRotationNotice(v: boolean): void;
  setLastOpenRef(
    ref: { kind: "candidate"; id: string } | { kind: "path"; path: string } | null,
  ): void;
  resetForRotation(): void;
  resetForLogSwitch(): void;
}

function patchRow(row: EventRow, update: PatchUpdate): EventRow {
  return {
    ...row,
    status: update.status,
    latencyMs: update.latencyMs,
    latencyBand: update.latencyBand,
    ...(update.summary !== undefined ? { summary: update.summary } : {}),
    ...(update.pairIdx !== undefined ? { pairIdx: update.pairIdx } : {}),
  };
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
  loadProgress: IDLE_LOAD_PROGRESS,
  streamBacklog: EMPTY_STREAM_BACKLOG,
  setRows: (rows) =>
    set((s) => ({
      rows,
      meta: s.meta
        ? { ...s.meta, eventCount: rows.length, sessionCount: deriveSessionCount(rows) }
        : s.meta,
    })),
  appendSnapshotRows: (newRows, from) =>
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
      const pendingNext = s.pendingBuffer.slice();
      for (const u of updates) {
        const prev = next[u.idx];
        if (prev) {
          next[u.idx] = patchRow(prev, u);
        }
        const pendingIndex = pendingNext.findIndex((row) => row.idx === u.idx);
        if (pendingIndex !== -1) {
          const pendingPrev = pendingNext[pendingIndex];
          if (pendingPrev) pendingNext[pendingIndex] = patchRow(pendingPrev, u);
        }
      }
      return { rows: next, pendingBuffer: pendingNext };
    }),
  setLoadProgress: (loadProgress) => set({ loadProgress }),
  setStreamBacklog: (streamBacklog) => set({ streamBacklog }),
  setConnection: (connection) => set({ connection }),
  setMeta: (meta) => set({ meta }),
  selectIdx: (selectedIdx) => set({ selectedIdx }),
  clearSelection: () => set({ selectedIdx: null }),
  // Phase 3 initial state
  searchQuery: "",
  searchMatches: null,
  searchTotal: 0,
  searchTruncated: false,
  searchStatus: "idle",
  searchError: null,
  searchPopoverOpen: false,
  filters: APP_DEFAULT_FILTERS,
  grouping: "none",
  groupCollapsed: new Set<string>(),
  selectedDetail: null,
  detailWidth: DETAIL_DEFAULT_WIDTH,
  // Phase 3 actions
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchMatches: (matches) => set({ searchMatches: matches !== null ? new Set(matches) : null }),
  setSearchPending: () => set({ searchStatus: "searching", searchError: null }),
  setSearchResult: (matches, total, truncated) =>
    set({
      searchMatches: new Set(matches),
      searchTotal: total,
      searchTruncated: truncated,
      searchStatus: "ready",
      searchError: null,
    }),
  setSearchError: (message) =>
    set({
      searchMatches: null,
      searchTotal: 0,
      searchTruncated: false,
      searchStatus: "error",
      searchError: message,
    }),
  clearSearchResults: () =>
    set({
      searchMatches: null,
      searchTotal: 0,
      searchTruncated: false,
      searchStatus: "idle",
      searchError: null,
    }),
  setSearchPopoverOpen: (open) => set({ searchPopoverOpen: open }),
  setFilters: (f) => set({ filters: f }),
  patchFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  clearFilters: () => set({ filters: APP_DEFAULT_FILTERS }),
  setGrouping: (mode) => set({ grouping: mode }),
  toggleGroupCollapsed: (key) =>
    set((s) => {
      const next = new Set(s.groupCollapsed);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { groupCollapsed: next };
    }),
  setSelectedDetail: (d) => set({ selectedDetail: d }),
  setDetailWidth: (px) =>
    set({ detailWidth: Math.max(DETAIL_MIN_WIDTH, Math.min(DETAIL_MAX_WIDTH, px)) }),
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
      searchTotal: 0,
      searchTruncated: false,
      searchStatus: "idle",
      searchError: null,
      pendingBuffer: [],
      pendingNewCount: 0,
      loadProgress: IDLE_LOAD_PROGRESS,
      streamBacklog: EMPTY_STREAM_BACKLOG,
    }),
  resetForLogSwitch: () =>
    set({
      rows: [],
      selectedIdx: null,
      selectedDetail: null,
      searchMatches: null,
      searchTotal: 0,
      searchTruncated: false,
      searchStatus: "idle",
      searchError: null,
      pendingBuffer: [],
      pendingNewCount: 0,
      loadProgress: IDLE_LOAD_PROGRESS,
      streamBacklog: EMPTY_STREAM_BACKLOG,
      meta: null,
      logKey: null,
      lastWatchError: null,
      rotationNotice: false,
    }),
}));
