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

function mapToOptions(m: Map<string, number>): { value: string; label: string; count: number }[] {
  return Array.from(m.entries()).map(([value, count]) => ({ value, label: value, count }));
}

export function FilterBar({
  searchInputRef,
}: {
  searchInputRef?: RefObject<HTMLInputElement | null>;
}): JSX.Element {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const filters = useAppStore((s) => s.filters);
  const patchFilter = useAppStore((s) => s.patchFilter);
  const grouping = useAppStore((s) => s.grouping);
  const setGrouping = useAppStore((s) => s.setGrouping);
  const facetCounts = useFacetCounts();
  const filteredRows = useFilteredRows();
  const totalRows = useAppStore((s) => s.rows.length);

  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);

  function togglePopover(name: OpenPopover) {
    setOpenPopover((prev) => (prev === name ? null : name));
  }

  function close() {
    setOpenPopover(null);
  }

  return (
    <div
      data-testid="filter-bar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        height: "var(--filter-bar-height)",
        paddingLeft: "var(--space-3)",
        paddingRight: "var(--space-3)",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        flexWrap: "nowrap",
        overflow: "hidden",
      }}
    >
      {/* Search input */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={() => setSearchQuery("")}
        {...(searchInputRef !== undefined ? { ref: searchInputRef } : {})}
      />

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
              patchFilter("kind", vals as import("@ahp-viewer/shared").EventKind[])
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
            options={mapToOptions(facetCounts.method)}
            selected={filters.method}
            onChange={(vals) => patchFilter("method", vals)}
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
            options={mapToOptions(facetCounts.session)}
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
            onChange={(vals) => patchFilter("status", vals as import("@ahp-viewer/core").Status[])}
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
