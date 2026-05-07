import type { JSX } from "react";
import { useRef, useState } from "react";
import { isFiltersEmpty } from "../../state/filters.js";
import { useFilteredRows, useGroupedItems } from "../../state/selectors.js";
import { useAppStore } from "../../state/store.js";
import { __APP_VERSION__ } from "../../version.js";
import { DetailPanel } from "../detail/index.js";
import { ActiveFilterChips, FilterBar } from "../filters/index.js";
import { useSearch } from "../filters/useSearch.js";
import { StickyGroupBar } from "../timeline/StickyGroupBar.js";
import { TimelineRegion } from "../timeline/TimelineRegion.js";
import { HeaderBar } from "./HeaderBar.js";
import { SourceStrip } from "./SourceStrip.js";
import { StatusBar } from "./StatusBar.js";

export function AppShell(): JSX.Element {
  const meta = useAppStore((s) => s.meta);
  const connection = useAppStore((s) => s.connection);
  const rows = useAppStore((s) => s.rows);
  const filters = useAppStore((s) => s.filters);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const grouping = useAppStore((s) => s.grouping);
  const detailWidth = useAppStore((s) => s.detailWidth);
  const selectedIdx = useAppStore((s) => s.selectedIdx);

  // Register debounced search effect
  useSearch();

  // Compute filtered/grouped items for StatusBar and StickyGroupBar
  const filteredRowIdxs = useFilteredRows();
  const groupedItems = useGroupedItems(filteredRowIdxs);

  // Active filters check
  const hasActiveFilters = !isFiltersEmpty(filters) || searchQuery !== "";

  // StickyGroupBar state — updated via onTopGroupChange callback from TimelineList
  const [stickyGroup, setStickyGroup] = useState<{
    level: "session" | "turn";
    label: string;
  } | null>(null);

  // Ref to SearchInput's <input> element for "/" keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Count group headers in groupedItems for StatusBar
  const groupCount = groupedItems.filter((i) => i.kind === "header").length;

  return (
    <div
      data-testid="app-shell"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <HeaderBar version={__APP_VERSION__} />
      <SourceStrip
        filename={meta?.filename ?? null}
        eventCount={meta?.eventCount ?? 0}
        sessionCount={meta?.sessionCount ?? 0}
      />
      <FilterBar searchInputRef={searchInputRef} />
      {hasActiveFilters && <ActiveFilterChips />}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {grouping !== "none" && stickyGroup && <StickyGroupBar topGroup={stickyGroup} />}
          <TimelineRegion searchInputRef={searchInputRef} onTopGroupChange={setStickyGroup} />
        </div>
        <div
          data-testid="detail-panel-wrapper"
          style={{
            flex: `0 0 ${detailWidth}px`,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <DetailPanel />
        </div>
      </div>
      <StatusBar
        connection={connection}
        eventCount={meta?.eventCount ?? 0}
        selectedRowIndex={selectedIdx}
        visibleCount={filteredRowIdxs.length}
        totalCount={rows.length}
        groupCount={grouping !== "none" ? groupCount : 0}
      />
    </div>
  );
}
