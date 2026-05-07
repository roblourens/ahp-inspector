import { Search } from "lucide-react";
import type { JSX } from "react";
import { isFiltersEmpty } from "../../state/filters.js";
import { useAppStore } from "../../state/store.js";
import { ActiveChip } from "./ActiveChip.js";

export function ActiveFilterChips(): JSX.Element | null {
  const filters = useAppStore((s) => s.filters);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const patchFilter = useAppStore((s) => s.patchFilter);
  const clearFilters = useAppStore((s) => s.clearFilters);

  const hasFilters = !isFiltersEmpty(filters);
  const hasSearch = searchQuery !== "";

  if (!hasFilters && !hasSearch) return null;

  const chips: JSX.Element[] = [];

  // Search chip first
  if (hasSearch) {
    const label = searchQuery.length > 40 ? `${searchQuery.slice(0, 40)}…` : searchQuery;
    chips.push(
      <span
        key="search"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-1)",
          height: 22,
          paddingLeft: "var(--space-2)",
          paddingRight: "var(--space-2)",
          background: "var(--color-chip-bg-active)",
          border: "1px solid var(--color-chip-border)",
          borderRadius: 4,
          color: "var(--color-chip-fg)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-ui-muted-size)",
        }}
      >
        <Search size={12} style={{ color: "var(--color-text-muted)" }} />
        <span>{label}</span>
      </span>,
    );
  }

  // Facet chips
  const arrayFacets: Array<{
    key: keyof typeof filters;
    prefix: string;
  }> = [
    { key: "direction", prefix: "Dir" },
    { key: "kind", prefix: "Kind" },
    { key: "method", prefix: "Method" },
    { key: "actionType", prefix: "Action" },
    { key: "session", prefix: "Session" },
    { key: "turn", prefix: "Turn" },
    { key: "status", prefix: "Status" },
  ];

  for (const { key, prefix } of arrayFacets) {
    const vals = filters[key] as string[];
    if (!vals || vals.length === 0) continue;
    for (const val of vals) {
      chips.push(
        <ActiveChip
          key={`${key}-${val}`}
          label={`${prefix}: ${val}`}
          ariaLabel={`Remove filter ${prefix}: ${val}`}
          onDismiss={() => {
            patchFilter(
              key as Parameters<typeof patchFilter>[0],
              vals.filter((v) => v !== val) as never,
            );
          }}
        />,
      );
    }
  }

  // Time chips
  if (filters.timeFrom !== null) {
    chips.push(
      <ActiveChip
        key="timeFrom"
        label={`Time: from ${new Date(filters.timeFrom).toLocaleString()}`}
        ariaLabel="Remove time from filter"
        onDismiss={() => patchFilter("timeFrom", null)}
      />,
    );
  }
  if (filters.timeTo !== null) {
    chips.push(
      <ActiveChip
        key="timeTo"
        label={`Time: to ${new Date(filters.timeTo).toLocaleString()}`}
        ariaLabel="Remove time to filter"
        onDismiss={() => patchFilter("timeTo", null)}
      />,
    );
  }

  return (
    <div
      data-testid="active-filter-chips"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        height: "var(--filter-chips-height)",
        paddingLeft: "var(--space-3)",
        paddingRight: "var(--space-3)",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        flexWrap: "nowrap",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          flex: 1,
          overflow: "hidden",
          alignItems: "center",
        }}
      >
        {chips}
      </div>
      <button
        type="button"
        aria-label="Clear all filters and search"
        onClick={clearFilters}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          color: "var(--color-text-muted)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-ui-muted-size)",
          flexShrink: 0,
          outline: "none",
          borderRadius: 3,
          padding: "1px var(--space-1)",
          textDecoration: "underline",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.outline = "2px solid var(--color-accent)";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.outline = "none";
        }}
      >
        Clear all
      </button>
    </div>
  );
}
