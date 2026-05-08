// usePersistEffect — Phase 4 Plan 06 Task 3.
// Hydrates per-log prefs on snapshot-end; persists relevant store changes
// (debounced 250ms) keyed by store.logKey. Quota errors disable persistence
// for the rest of the session (D-17/D-18).
//
// Naming: this module re-exports the underlying persistence module's
// `loadPerLogPrefs` / `persistPerLogPrefs` under the plan-mandated aliases
// `loadForLogKey` / `saveForLogKey` so call sites match UI-SPEC vocabulary.

import { useEffect, useRef } from "react";
import {
  loadPerLogPrefs as loadForLogKey,
  type PerLogPrefs,
  persistPerLogPrefs as saveForLogKey,
} from "../state/persistence.js";
import { useAppStore } from "../state/store.js";

const DEBOUNCE_MS = 250;
const MAX_GROUP_COLLAPSED = 1000;

function buildPrefs(): PerLogPrefs {
  const s = useAppStore.getState();
  // FIFO trim: keep the most recent 1000 entries (insertion order in Set).
  const groupArr = Array.from(s.groupCollapsed);
  const trimmed =
    groupArr.length > MAX_GROUP_COLLAPSED
      ? groupArr.slice(groupArr.length - MAX_GROUP_COLLAPSED)
      : groupArr;
  return {
    v: 1,
    searchQuery: s.searchQuery,
    filters: s.filters,
    grouping: s.grouping,
    groupCollapsed: trimmed,
    selectedIdx: s.selectedIdx,
    detailWidth: s.detailWidth,
    livePaused: s.livePaused,
  };
}

export function usePersistEffect(): void {
  // All mutable state lives in refs so React doesn't unmount/remount the
  // effect when the underlying store changes.
  const stateRef = useRef<{
    hydratedFor: string | null;
    disabled: boolean;
    debounceTimer: ReturnType<typeof setTimeout> | null;
    pendingSaveLogKey: string | null;
    lastLogKey: string | null;
    lastRowsLen: number;
  }>({
    hydratedFor: null,
    disabled: false,
    debounceTimer: null,
    pendingSaveLogKey: null,
    lastLogKey: null,
    lastRowsLen: 0,
  });

  useEffect(() => {
    const ref = stateRef.current;

    function flushSave(logKey: string): void {
      if (ref.disabled) return;
      try {
        saveForLogKey(logKey, buildPrefs());
      } catch {
        ref.disabled = true;
      } finally {
        if (ref.debounceTimer) {
          clearTimeout(ref.debounceTimer);
          ref.debounceTimer = null;
        }
        ref.pendingSaveLogKey = null;
      }
    }

    function scheduleSave(logKey: string): void {
      if (ref.disabled) return;
      if (ref.debounceTimer) clearTimeout(ref.debounceTimer);
      ref.pendingSaveLogKey = logKey;
      ref.debounceTimer = setTimeout(() => {
        ref.debounceTimer = null;
        flushSave(logKey);
      }, DEBOUNCE_MS);
    }

    function hydrate(logKey: string, rowsLen: number): void {
      const stored = loadForLogKey(logKey);
      if (stored) {
        const s = useAppStore.getState();
        s.setFilters(stored.filters);
        s.setGrouping(stored.grouping);
        s.setSearchQuery(stored.searchQuery);
        s.setDetailWidth(stored.detailWidth);
        s.setLivePaused(stored.livePaused);
        useAppStore.setState({ groupCollapsed: new Set(stored.groupCollapsed) });
        if (
          stored.selectedIdx !== null &&
          stored.selectedIdx >= 0 &&
          stored.selectedIdx < rowsLen
        ) {
          s.selectIdx(stored.selectedIdx);
        }
      }
      ref.hydratedFor = logKey;
    }

    // Initialize tracking from current state and hydrate if a snapshot is
    // already present at mount time.
    {
      const init = useAppStore.getState();
      ref.lastLogKey = init.logKey;
      ref.lastRowsLen = init.rows.length;
      if (init.logKey && init.rows.length > 0 && ref.hydratedFor !== init.logKey) {
        hydrate(init.logKey, init.rows.length);
      }
    }

    const unsub = useAppStore.subscribe((curr, prev) => {
      const prevKey = ref.lastLogKey;
      const currKey = curr.logKey;

      // logKey switch — flush previous log's pending save synchronously
      // before tracking the new one. Covers null→A→B and A→B transitions.
      if (prevKey && prevKey !== currKey) {
        if (ref.debounceTimer && ref.pendingSaveLogKey === prevKey) {
          flushSave(prevKey);
        }
        ref.hydratedFor = null;
      }
      ref.lastLogKey = currKey;

      const rowsLen = curr.rows.length;
      const prevLen = ref.lastRowsLen;
      ref.lastRowsLen = rowsLen;

      // Snapshot-end: rows transitioned 0 → N for the current logKey, not
      // yet hydrated for this logKey.
      if (currKey && rowsLen > 0 && prevLen === 0 && ref.hydratedFor !== currKey) {
        hydrate(currKey, rowsLen);
        return;
      }

      // After hydration, schedule a debounced save when persistable state changed.
      if (currKey && ref.hydratedFor === currKey) {
        const relevantChanged =
          prev.filters !== curr.filters ||
          prev.grouping !== curr.grouping ||
          prev.searchQuery !== curr.searchQuery ||
          prev.detailWidth !== curr.detailWidth ||
          prev.livePaused !== curr.livePaused ||
          prev.selectedIdx !== curr.selectedIdx ||
          prev.groupCollapsed !== curr.groupCollapsed;
        if (relevantChanged) scheduleSave(currKey);
      }
    });

    return () => {
      if (ref.debounceTimer) clearTimeout(ref.debounceTimer);
      unsub();
    };
  }, []);
}
