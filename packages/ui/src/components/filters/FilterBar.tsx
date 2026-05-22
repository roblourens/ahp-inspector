import { formatSessionShort } from "@ahp-inspector/core";
import type { JSX, RefObject } from "react";
import { useState } from "react";
import { useFacetCounts, useFilteredRows } from "../../state/selectors.js";
import { useAppStore } from "../../state/store.js";
import { FacetChip } from "./FacetChip.js";
import { FacetPopover } from "./FacetPopover.js";
import { GroupToggleChip } from "./GroupToggleChip.js";
import { ResultCounter } from "./ResultCounter.js";
import { SearchInput } from "./SearchInput.js";
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
  | null;

function mapToOptions(
  m: Map<string, number>,
  labelFor: (value: string) => string = (value) => value,
): { value: string; label: string; count: number }[] {
  return Array.from(m.entries()).map(([value, count]) => ({
    value,
    label: labelFor(value),
    count,
  }));
}

function methodSelectionFromHidden(
  options: { value: string; label: string; count: number }[],
  hiddenMethods: string[],
): string[] {
  return options.map((option) => option.value).filter((value) => !hiddenMethods.includes(value));
}

function hiddenMethodsFromSelection(
  options: { value: string; label: string; count: number }[],
  selectedMethods: string[],
  previousHiddenMethods: string[],
): string[] {
  const nextHiddenMethods = options
    .map((option) => option.value)
    .filter((value) => !selectedMethods.includes(value));
  const availableValues = new Set(options.map((option) => option.value));
  const nextHiddenSet = new Set(nextHiddenMethods);
  const carriedHiddenMethods = previousHiddenMethods.filter(
    (value) => !availableValues.has(value) || nextHiddenSet.has(value),
  );
  return [
    ...carriedHiddenMethods,
    ...nextHiddenMethods.filter((value) => !carriedHiddenMethods.includes(value)),
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
  const filters = useAppStore((s) => s.filters);
  const patchFilter = useAppStore((s) => s.patchFilter);
  const grouping = useAppStore((s) => s.grouping);
  const setGrouping = useAppStore((s) => s.setGrouping);
  const facetCounts = useFacetCounts();
  const filteredRows = useFilteredRows();
  const totalRows = useAppStore((s) => s.rows.length);

  const methodOptions = mapToOptions(facetCounts.method);
  const visibleMethods = methodSelectionFromHidden(methodOptions, filters.method);

  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);

  function togglePopover(name: OpenPopover) {
    setOpenPopover((prev) => (prev === name ? null : name));
  }

  function close() {
    setOpenPopover(null);
  }

  function navigateSearch(direction: "previous" | "next"): void {
    window.dispatchEvent(new CustomEvent("ahp-search-nav", { detail: direction }));
  }

  const hasSearch = searchQuery.trim() !== "";
  const hasSearchMatches = hasSearch && searchTotal > 0;
  const searchStatusText = !hasSearch
    ? null
    : searchStatus === "searching"
      ? "Searching..."
      : searchStatus === "error"
        ? `Search failed${searchError ? `: ${searchError}` : ""}`
        : `${searchTotal.toLocaleString()} ${searchTotal === 1 ? "match" : "matches"}${searchTruncated ? "+" : ""}`;

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
        zIndex: 1000,
      }}
    >
      {/* Search input */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={() => setSearchQuery("")}
        {...(searchInputRef !== undefined ? { ref: searchInputRef } : {})}
      />
      {searchStatusText !== null && (
        <div
          data-testid="search-status"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            color: searchStatus === "error" ? "var(--color-danger)" : "var(--color-text-muted)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <span>{searchStatusText}</span>
          <button
            type="button"
            aria-label="Previous search match"
            disabled={!hasSearchMatches}
            onClick={() => navigateSearch("previous")}
          >
            Prev
          </button>
          <button
            type="button"
            aria-label="Next search match"
            disabled={!hasSearchMatches}
            onClick={() => navigateSearch("next")}
          >
            Next
          </button>
        </div>
      )}

      {/* Direction facet */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <FacetChip
          label="Dir"
          activeCount={filters.direction.length}
          isOpen={openPopover === "direction"}
          isDisabled={false}
          onClick={() => togglePopover("direction")}
        />
        {openPopover === "direction" && (
          <FacetPopover
            options={mapToOptions(facetCounts.direction)}
            selected={filters.direction}
            onChange={(vals) => patchFilter("direction", vals as ("c2s" | "s2c")[])}
            onClose={close}
          />
        )}
      </div>

      {/* Kind facet */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <FacetChip
          label="Kind"
          activeCount={filters.kind.length}
          isOpen={openPopover === "kind"}
          isDisabled={false}
          onClick={() => togglePopover("kind")}
        />
        {openPopover === "kind" && (
          <FacetPopover
            options={mapToOptions(facetCounts.kind)}
            selected={filters.kind}
            onChange={(vals) =>
              patchFilter("kind", vals as import("@ahp-inspector/shared").EventKind[])
            }
            onClose={close}
          />
        )}
      </div>

      {/* Method facet */}
      <div style={{ position: "relative", flexShrink: 0 }}>
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
            selected={visibleMethods}
            onChange={(vals) =>
              patchFilter("method", hiddenMethodsFromSelection(methodOptions, vals, filters.method))
            }
            onClose={close}
            searchable
          />
        )}
      </div>

      {/* Action facet */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <FacetChip
          label="Action"
          activeCount={filters.actionType.length}
          isOpen={openPopover === "action"}
          isDisabled={false}
          onClick={() => togglePopover("action")}
        />
        {openPopover === "action" && (
          <FacetPopover
            options={mapToOptions(facetCounts.actionType)}
            selected={filters.actionType}
            onChange={(vals) => patchFilter("actionType", vals)}
            onClose={close}
          />
        )}
      </div>

      {/* Session facet */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <FacetChip
          label="Session"
          activeCount={filters.session.length}
          isOpen={openPopover === "session"}
          isDisabled={false}
          onClick={() => togglePopover("session")}
        />
        {openPopover === "session" && (
          <FacetPopover
            options={mapToOptions(facetCounts.session, formatSessionShort)}
            selected={filters.session}
            onChange={(vals) => patchFilter("session", vals)}
            onClose={close}
            searchable
          />
        )}
      </div>

      {/* Turn facet */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <FacetChip
          label="Turn"
          activeCount={filters.turn.length}
          isOpen={openPopover === "turn"}
          isDisabled={filters.session.length === 0}
          onClick={() => filters.session.length > 0 && togglePopover("turn")}
        />
        {openPopover === "turn" && (
          <FacetPopover
            options={mapToOptions(facetCounts.turn)}
            selected={filters.turn}
            onChange={(vals) => patchFilter("turn", vals)}
            onClose={close}
            searchable
          />
        )}
      </div>

      {/* Status facet */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <FacetChip
          label="Status"
          activeCount={filters.status.length}
          isOpen={openPopover === "status"}
          isDisabled={false}
          onClick={() => togglePopover("status")}
        />
        {openPopover === "status" && (
          <FacetPopover
            options={mapToOptions(facetCounts.status)}
            selected={filters.status}
            onChange={(vals) =>
              patchFilter("status", vals as import("@ahp-inspector/core").Status[])
            }
            onClose={close}
          />
        )}
      </div>

      {/* Time facet */}
      <div style={{ position: "relative", flexShrink: 0 }}>
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
        <GroupToggleChip value={grouping} onChange={setGrouping} />
      </div>

      {/* Result counter */}
      <ResultCounter visible={filteredRows.length} total={totalRows} />
    </div>
  );
}
