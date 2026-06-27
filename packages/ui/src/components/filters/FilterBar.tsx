import { formatSessionShort, type Status } from "@ahp-inspector/core";
import type { EventKind } from "@ahp-inspector/shared";
import type { JSX, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFacetCounts, useFilteredRows, useVisibleSearchMatches } from "../../state/selectors.js";
import { useAppStore } from "../../state/store.js";
import { Z } from "../../styles/zLayers.js";
import { FacetChip } from "./FacetChip.js";
import { FacetPopover } from "./FacetPopover.js";
import { GroupToggleChip } from "./GroupToggleChip.js";
import { ResultCounter } from "./ResultCounter.js";
import { RowFilterInput } from "./RowFilterInput.js";
import { SearchPopover } from "./SearchPopover.js";
import { SearchTrigger } from "./SearchTrigger.js";
import { TimeRangePopover } from "./TimeRangePopover.js";

type OpenPopover =
  | "direction"
  | "kind"
  | "method"
  | "action"
  | "session"
  | "turn"
  | "status"
  | "time"
  | "group"
  | null;

function mapToOptions(
  m: Map<string, number>,
  labelFor: (value: string) => string = (value) => value,
): { value: string; label: string; count: number }[] {
  return Array.from(m.entries())
    .map(([value, count]) => ({
      value,
      label: labelFor(value),
      count,
    }))
    .sort((a, b) => {
      const byLabel = a.label.toLocaleLowerCase().localeCompare(b.label.toLocaleLowerCase());
      return byLabel || a.value.localeCompare(b.value);
    });
}

function visibleSelectionFromHidden(
  options: { value: string; label: string; count: number }[],
  hiddenValues: string[],
): string[] {
  return options.map((option) => option.value).filter((value) => !hiddenValues.includes(value));
}

function hiddenValuesFromSelection(
  options: { value: string; label: string; count: number }[],
  selectedValues: string[],
  previousHiddenValues: string[],
): string[] {
  const nextHiddenValues = options
    .map((option) => option.value)
    .filter((value) => !selectedValues.includes(value));
  const availableValues = new Set(options.map((option) => option.value));
  const nextHiddenSet = new Set(nextHiddenValues);
  const carriedHiddenValues = previousHiddenValues.filter(
    (value) => !availableValues.has(value) || nextHiddenSet.has(value),
  );
  return [
    ...carriedHiddenValues,
    ...nextHiddenValues.filter((value) => !carriedHiddenValues.includes(value)),
  ];
}

export function FilterBar({
  searchInputRef,
}: {
  searchInputRef?: RefObject<HTMLInputElement | null>;
}): JSX.Element {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const searchTotal = useAppStore((s) => s.searchTotal);
  const searchStatus = useAppStore((s) => s.searchStatus);
  const searchTruncated = useAppStore((s) => s.searchTruncated);
  const searchError = useAppStore((s) => s.searchError);
  const searchMatches = useAppStore((s) => s.searchMatches);
  const selectedIdx = useAppStore((s) => s.selectedIdx);
  const filters = useAppStore((s) => s.filters);
  const patchFilter = useAppStore((s) => s.patchFilter);
  const grouping = useAppStore((s) => s.grouping);
  const setGrouping = useAppStore((s) => s.setGrouping);
  const facetCounts = useFacetCounts();
  const filteredRows = useFilteredRows();
  const visibleSearchMatches = useVisibleSearchMatches();
  const totalRows = useAppStore((s) => s.rows.length);

  const directionOptions = mapToOptions(facetCounts.direction);
  const kindOptions = mapToOptions(facetCounts.kind);
  const methodOptions = mapToOptions(facetCounts.method);
  const actionOptions = mapToOptions(facetCounts.actionType);
  const channelOptions = mapToOptions(facetCounts.session, formatSessionShort);
  const turnOptions = mapToOptions(facetCounts.turn);
  const statusOptions = mapToOptions(facetCounts.status);

  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);
  const isSearchPopoverOpen = useAppStore((s) => s.searchPopoverOpen);
  const setSearchPopoverOpen = useAppStore((s) => s.setSearchPopoverOpen);
  const searchPopoverInputRef = useRef<HTMLInputElement | null>(null);

  // Open the search popover and focus its input once it mounts (next render).
  const openSearch = useCallback(() => {
    setSearchPopoverOpen(true);
    setTimeout(() => {
      searchPopoverInputRef.current?.focus();
    }, 0);
  }, [setSearchPopoverOpen]);

  // Handle "/" and cmd+f / ctrl+f keyboard shortcuts to open the search popover.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isFindShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f";
      if (isSearchPopoverOpen) {
        if (isFindShortcut) {
          // Keep suppressing native find; refocus the input and select its
          // current query so the next keystroke replaces it (D-12).
          e.preventDefault();
          const input = searchPopoverInputRef.current;
          input?.focus();
          input?.select();
        }
        // "/" while find is already open does nothing special.
        return;
      }
      if (e.key === "/" || isFindShortcut) {
        // Suppress the browser's native find dialog and drive in-app search instead.
        e.preventDefault();
        openSearch();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSearchPopoverOpen, openSearch]);

  function togglePopover(name: OpenPopover) {
    setOpenPopover((prev) => (prev === name ? null : name));
  }

  function close() {
    setOpenPopover(null);
  }

  function facetAnchorStyle(name: Exclude<OpenPopover, null>) {
    return {
      position: "relative" as const,
      flexShrink: 0,
      ...(openPopover === name ? { anchorName: "--filter-popover-anchor" } : {}),
    };
  }

  function navigateSearch(direction: "previous" | "next"): void {
    window.dispatchEvent(new CustomEvent("ahp-search-nav", { detail: direction }));
  }

  const hasSearch = searchQuery.trim() !== "";
  const hasSearchMatches = hasSearch && searchTotal > 0;
  const searchMatchCount =
    visibleSearchMatches.length > 0
      ? visibleSearchMatches.length
      : (searchMatches?.size ?? searchTotal);
  const focusedSearchIndex =
    selectedIdx === null
      ? null
      : visibleSearchMatches.indexOf(selectedIdx) >= 0
        ? visibleSearchMatches.indexOf(selectedIdx)
        : searchMatches?.has(selectedIdx)
          ? Array.from(searchMatches).indexOf(selectedIdx)
          : null;

  return (
    <div
      data-testid="filter-bar"
      className="filter-bar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        minHeight: "var(--filter-bar-height)",
        paddingLeft: "var(--space-3)",
        paddingRight: "var(--space-3)",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        position: "relative",
        zIndex: Z.controls,
      }}
    >
      {/* Row filter input — primary visible input */}
      <RowFilterInput
        value={filters.rowText}
        onChange={(value) => patchFilter("rowText", value)}
        onClear={() => patchFilter("rowText", "")}
      />

      {/* Search trigger button */}
      <SearchTrigger
        isActive={hasSearch}
        onClick={() => {
          if (isSearchPopoverOpen) {
            setSearchPopoverOpen(false);
          } else {
            openSearch();
          }
        }}
      />

      {/* Direction facet */}
      <div style={facetAnchorStyle("direction")}>
        <FacetChip
          label="Dir"
          activeCount={filters.direction.length}
          isOpen={openPopover === "direction"}
          isDisabled={false}
          onClick={() => togglePopover("direction")}
        />
        {openPopover === "direction" && (
          <FacetPopover
            options={directionOptions}
            selected={visibleSelectionFromHidden(directionOptions, filters.direction)}
            onChange={(values) =>
              patchFilter(
                "direction",
                hiddenValuesFromSelection(directionOptions, values, filters.direction) as (
                  | "c2s"
                  | "s2c"
                )[],
              )
            }
            onClose={close}
          />
        )}
      </div>

      {/* Kind facet */}
      <div style={facetAnchorStyle("kind")}>
        <FacetChip
          label="Kind"
          activeCount={filters.kind.length}
          isOpen={openPopover === "kind"}
          isDisabled={false}
          onClick={() => togglePopover("kind")}
        />
        {openPopover === "kind" && (
          <FacetPopover
            options={kindOptions}
            selected={visibleSelectionFromHidden(kindOptions, filters.kind)}
            onChange={(values) =>
              patchFilter(
                "kind",
                hiddenValuesFromSelection(kindOptions, values, filters.kind) as EventKind[],
              )
            }
            onClose={close}
          />
        )}
      </div>

      {/* Method facet */}
      <div style={facetAnchorStyle("method")}>
        <FacetChip
          label="Method"
          activeCount={filters.method.length}
          isOpen={openPopover === "method"}
          isDisabled={false}
          onClick={() => togglePopover("method")}
        />
        {openPopover === "method" && (
          <FacetPopover
            options={methodOptions}
            selected={visibleSelectionFromHidden(methodOptions, filters.method)}
            onChange={(values) =>
              patchFilter(
                "method",
                hiddenValuesFromSelection(methodOptions, values, filters.method),
              )
            }
            onClose={close}
            searchable
            align="end"
          />
        )}
      </div>

      {/* Action facet */}
      <div style={facetAnchorStyle("action")}>
        <FacetChip
          label="Action"
          activeCount={filters.actionType.length}
          isOpen={openPopover === "action"}
          isDisabled={false}
          onClick={() => togglePopover("action")}
        />
        {openPopover === "action" && (
          <FacetPopover
            options={actionOptions}
            selected={visibleSelectionFromHidden(actionOptions, filters.actionType)}
            onChange={(values) =>
              patchFilter(
                "actionType",
                hiddenValuesFromSelection(actionOptions, values, filters.actionType),
              )
            }
            onClose={close}
            align="end"
          />
        )}
      </div>

      {/* Channel facet */}
      <div style={facetAnchorStyle("session")}>
        <FacetChip
          label="Channel"
          activeCount={filters.session.length}
          isOpen={openPopover === "session"}
          isDisabled={false}
          onClick={() => togglePopover("session")}
        />
        {openPopover === "session" && (
          <FacetPopover
            options={channelOptions}
            selected={visibleSelectionFromHidden(channelOptions, filters.session)}
            onChange={(values) =>
              patchFilter(
                "session",
                hiddenValuesFromSelection(channelOptions, values, filters.session),
              )
            }
            onClose={close}
            searchable
            align="end"
          />
        )}
      </div>

      {/* Turn facet */}
      <div style={facetAnchorStyle("turn")}>
        <FacetChip
          label="Turn"
          activeCount={filters.turn.length}
          isOpen={openPopover === "turn"}
          isDisabled={false}
          onClick={() => togglePopover("turn")}
        />
        {openPopover === "turn" && (
          <FacetPopover
            options={turnOptions}
            selected={visibleSelectionFromHidden(turnOptions, filters.turn)}
            onChange={(values) =>
              patchFilter("turn", hiddenValuesFromSelection(turnOptions, values, filters.turn))
            }
            onClose={close}
            searchable
            align="end"
          />
        )}
      </div>

      {/* Status facet */}
      <div style={facetAnchorStyle("status")}>
        <FacetChip
          label="Status"
          activeCount={filters.status.length}
          isOpen={openPopover === "status"}
          isDisabled={false}
          onClick={() => togglePopover("status")}
        />
        {openPopover === "status" && (
          <FacetPopover
            options={statusOptions}
            selected={visibleSelectionFromHidden(statusOptions, filters.status)}
            onChange={(values) =>
              patchFilter(
                "status",
                hiddenValuesFromSelection(statusOptions, values, filters.status) as Status[],
              )
            }
            onClose={close}
            align="end"
          />
        )}
      </div>

      {/* Time facet */}
      <div style={facetAnchorStyle("time")}>
        <FacetChip
          label="Time"
          activeCount={(filters.timeFrom !== null ? 1 : 0) + (filters.timeTo !== null ? 1 : 0)}
          isOpen={openPopover === "time"}
          isDisabled={false}
          onClick={() => togglePopover("time")}
        />
        {openPopover === "time" && (
          <TimeRangePopover
            from={filters.timeFrom}
            to={filters.timeTo}
            onApply={(from, to) => {
              patchFilter("timeFrom", from);
              patchFilter("timeTo", to);
            }}
            onClose={close}
          />
        )}
      </div>

      {/* Group toggle — right-aligned */}
      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
        <GroupToggleChip
          value={grouping}
          isOpen={openPopover === "group"}
          onChange={setGrouping}
          onOpenChange={(isOpen) => setOpenPopover(isOpen ? "group" : null)}
        />
      </div>

      {/* Result counter */}
      <ResultCounter visible={filteredRows.length} total={totalRows} />

      {/* Search popover — positioned absolutely above toolbar when open */}
      {isSearchPopoverOpen && (
        <SearchPopover
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery("")}
          onClose={() => setSearchPopoverOpen(false)}
          searchTotal={searchTotal}
          searchStatus={searchStatus}
          searchError={searchError}
          searchTruncated={searchTruncated}
          searchMatchCount={searchMatchCount}
          focusedSearchIndex={focusedSearchIndex}
          onNavigate={navigateSearch}
          inputRef={searchPopoverInputRef}
        />
      )}
    </div>
  );
}
