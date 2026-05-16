// usePersistEffect — Phase 4 Plan 06 Task 3.
// Hydrates per-log prefs on explicit baseline completion; persists relevant store changes
// (debounced 250ms) keyed by store.logKey. Quota errors disable persistence
// for the rest of the session (D-17/D-18).
//
// Naming: this module re-exports the underlying persistence module's
// `loadPerLogPrefs` / `persistPerLogPrefs` under the plan-mandated aliases
// `loadForLogKey` / `saveForLogKey` so call sites match UI-SPEC vocabulary.

import { useEffect, useRef } from "react";
import { EMPTY_FILTERS } from "../state/filters.js";
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
  }>({
    hydratedFor: null,
    disabled: false,
    debounceTimer: null,
    pendingSaveLogKey: null,
    lastLogKey: null,
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
      ref.hydratedFor = logKey;
      const stored = loadForLogKey(logKey);
      if (stored) {
        const s = useAppStore.getState();
        s.setFilters(stored.filters);
        s.setGrouping(stored.grouping);
        s.setSearchQuery(stored.searchQuery);
        s.clearSearchResults();
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
    }

    // Initialize tracking from current state and hydrate if baseline completion
    // was already observed before this effect mounted.
    {
      const init = useAppStore.getState();
      ref.lastLogKey = init.logKey;
      if (
        init.logKey &&
        init.loadProgress.phase === "complete" &&
        ref.hydratedFor !== init.logKey
      ) {
        hydrate(init.logKey, init.rows.length);
      }
    }

    const unsub = useAppStore.subscribe((curr, prev) => {
      const prevKey = ref.lastLogKey;
      const currKey = curr.logKey;

      // logKey switch — flush previous log's pending save synchronously
      // before tracking the new one, then reset per-log view state so the
      // new file starts fresh (the new file's stored prefs, if any, are
      // applied later by hydrate() on snapshot-end).
      if (prevKey && prevKey !== currKey) {
        if (ref.debounceTimer && ref.pendingSaveLogKey === prevKey) {
          flushSave(prevKey);
        }
        ref.hydratedFor = null;
        // Update lastLogKey BEFORE the reset writes so re-entrant subscribe
        // callbacks see prevKey === currKey and skip this branch.
        ref.lastLogKey = currKey;
        const s = useAppStore.getState();
        s.setFilters(EMPTY_FILTERS);
        s.setSearchQuery("");
        s.clearSearchResults();
        s.setGrouping("none");
        useAppStore.setState({ groupCollapsed: new Set<string>() });
      }
      ref.lastLogKey = currKey;

      // Progressive rows can arrive before the baseline is complete. Hydrate
      // only after the explicit lifecycle reaches complete for this logKey.
      if (currKey && curr.loadProgress.phase === "complete" && ref.hydratedFor !== currKey) {
        hydrate(currKey, curr.rows.length);
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
      if (ref.pendingSaveLogKey) flushSave(ref.pendingSaveLogKey);
      else if (ref.debounceTimer) clearTimeout(ref.debounceTimer);
      unsub();
    };
  }, []);
}
