import type { JSX, RefObject } from "react";
import { useEffect, useRef } from "react";
import { isFiltersEmpty } from "../../state/filters.js";
import { useFilteredRows, useGroupedItems } from "../../state/selectors.js";
import { useAppStore } from "../../state/store.js";
import { connectLogStream } from "../../transport/sse-client.js";
import { DisconnectedBanner } from "../states/DisconnectedBanner.js";
import { EmptyState } from "../states/EmptyState.js";
import { LoadingState } from "../states/LoadingState.js";
import { NoResultsBanner } from "../states/NoResultsBanner.js";
import { TimelineList } from "./TimelineList.js";

export interface TimelineRegionProps {
  onReconnect?: () => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onTopGroupChange?: (group: { level: "session" | "turn"; label: string } | null) => void;
}

function defaultReconnect(): void {
  // Tear down any prior handle, then open a fresh one.
  if (typeof window !== "undefined" && window.__ahpStream) {
    try {
      window.__ahpStream.close();
    } catch {
      /* ignore */
    }
  }
  const handle = connectLogStream();
  if (typeof window !== "undefined") window.__ahpStream = handle;
}

// Chord state for "g s" grouping shortcut
interface ChordState {
  key: string;
  at: number;
}

export function TimelineRegion({
  onReconnect,
  searchInputRef,
  onTopGroupChange,
}: TimelineRegionProps = {}): JSX.Element {
  const rows = useAppStore((s) => s.rows);
  const connection = useAppStore((s) => s.connection);
  const meta = useAppStore((s) => s.meta);
  const selectedIdx = useAppStore((s) => s.selectedIdx);
  const select = useAppStore((s) => s.selectIdx);
  const clear = useAppStore((s) => s.clearSelection);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setSearchMatches = useAppStore((s) => s.setSearchMatches);
  const filters = useAppStore((s) => s.filters);
  const clearFilters = useAppStore((s) => s.clearFilters);
  const grouping = useAppStore((s) => s.grouping);
  const setGrouping = useAppStore((s) => s.setGrouping);
  const groupCollapsed = useAppStore((s) => s.groupCollapsed);
  const toggleGroupCollapsed = useAppStore((s) => s.toggleGroupCollapsed);

  // Selectors — compute filtered/grouped items.
  const filteredRowIdxs = useFilteredRows();
  const groupedItems = useGroupedItems(filteredRowIdxs);

  const chordRef = useRef<ChordState | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      // "/" — focus search input
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        searchInputRef?.current?.focus();
        return;
      }

      // "g s" chord — cycle grouping
      const now = Date.now();
      const prev = chordRef.current;
      if (e.key === "g") {
        chordRef.current = { key: "g", at: now };
        return;
      }
      if (e.key === "s" && prev?.key === "g" && now - prev.at < 500) {
        chordRef.current = null;
        const next =
          grouping === "none" ? "session" : grouping === "session" ? "session+turn" : "none";
        setGrouping(next);
        return;
      }
      chordRef.current = null;

      // Esc priority: search → (popovers handled in FilterBar) → filters → selection
      if (e.key === "Escape") {
        if (searchQuery) {
          setSearchQuery("");
          setSearchMatches(null);
        } else if (!isFiltersEmpty(filters)) {
          clearFilters();
        } else {
          clear();
        }
        return;
      }

      // Navigation over filteredRowIdxs
      if (filteredRowIdxs.length === 0) return;
      const curPos = selectedIdx !== null ? filteredRowIdxs.indexOf(selectedIdx) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = filteredRowIdxs[Math.min(filteredRowIdxs.length - 1, curPos + 1)];
        if (next !== undefined) select(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = filteredRowIdxs[Math.max(0, curPos - 1)];
        if (next !== undefined) select(next);
      } else if (e.key === "PageDown") {
        e.preventDefault();
        const next = filteredRowIdxs[Math.min(filteredRowIdxs.length - 1, curPos + 20)];
        if (next !== undefined) select(next);
      } else if (e.key === "PageUp") {
        e.preventDefault();
        const next = filteredRowIdxs[Math.max(0, curPos - 20)];
        if (next !== undefined) select(next);
      } else if (e.key === "Home") {
        e.preventDefault();
        const next = filteredRowIdxs[0];
        if (next !== undefined) select(next);
      } else if (e.key === "End") {
        e.preventDefault();
        const next = filteredRowIdxs[filteredRowIdxs.length - 1];
        if (next !== undefined) select(next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    filteredRowIdxs,
    selectedIdx,
    select,
    clear,
    searchQuery,
    setSearchQuery,
    setSearchMatches,
    filters,
    clearFilters,
    grouping,
    setGrouping,
    searchInputRef,
  ]);

  if (connection === "connecting" && rows.length === 0) {
    return <LoadingState filename={meta?.filename ?? ""} />;
  }
  if (connection === "connected" && rows.length === 0) {
    return <EmptyState />;
  }

  const allParseErrors = rows.length > 0 && rows.every((r) => r.kind === "parse-error");
  return (
    <div
      data-testid="timeline-region"
      style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      {allParseErrors && (
        <NoResultsBanner
          heading="No valid events"
          body={`All ${rows.length} lines in this file failed to parse. Showing parse errors below.`}
        />
      )}
      {connection === "disconnected" && (
        <DisconnectedBanner onReconnect={onReconnect ?? defaultReconnect} />
      )}
      <TimelineList
        items={groupedItems}
        rows={rows}
        selectedIdx={selectedIdx}
        onSelect={(idx) => select(idx)}
        groupCollapsed={groupCollapsed}
        onToggleGroup={toggleGroupCollapsed}
        {...(onTopGroupChange !== undefined ? { onTopGroupChange } : {})}
      />
    </div>
  );
}
