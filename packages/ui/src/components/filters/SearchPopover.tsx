import { ChevronDown, ChevronUp } from "lucide-react";
import type { JSX, RefObject } from "react";
import { useRef } from "react";
import type { SearchStatus } from "../../state/store.js";
import { Z } from "../../styles/zLayers.js";
import { SearchInputCore } from "./SearchInputCore.js";

interface SearchPopoverProps {
  value: string;
  onChange(q: string): void;
  onClear(): void;
  onClose(): void;
  searchTotal: number;
  searchStatus: SearchStatus;
  searchError?: string | null;
  searchTruncated: boolean;
  searchMatchCount: number;
  focusedSearchIndex: number | null;
  onNavigate(direction: "previous" | "next"): void;
  inputRef?: RefObject<HTMLInputElement | null> | undefined;
}

export function SearchPopover({
  value,
  onChange,
  onClear,
  searchTotal,
  searchStatus,
  searchError,
  searchTruncated,
  searchMatchCount,
  focusedSearchIndex,
  onNavigate,
  inputRef,
}: SearchPopoverProps): JSX.Element {
  // `onClose` stays in the props API for the trigger/X close path. Closing via
  // the keyboard (and the subsequent row focus) is owned by TimelineRegion
  // (Plan 02, D-13) — this component registers no document key listener.
  const popoverRef = useRef<HTMLDivElement>(null);

  const hasSearch = value.trim() !== "";
  const hasSearchMatches = hasSearch && searchTotal > 0;
  const searchStatusText = !hasSearch
    ? null
    : searchStatus === "searching"
      ? "Searching…"
      : searchStatus === "error"
        ? searchError
          ? `Search failed: ${searchError}`
          : "Search failed — check the server connection and try again"
        : searchMatchCount === 0
          ? "No matching events"
          : focusedSearchIndex !== null && focusedSearchIndex >= 0
            ? `${(focusedSearchIndex + 1).toLocaleString()} of ${searchMatchCount.toLocaleString()} ${searchMatchCount === 1 ? "result" : "results"}${searchTruncated ? "+" : ""}`
            : `${searchMatchCount.toLocaleString()} ${searchMatchCount === 1 ? "result" : "results"}${searchTruncated ? "+" : ""}`;

  return (
    <div
      ref={popoverRef}
      role="region"
      aria-label="Find"
      data-testid="search-popover"
      style={{
        position: "absolute",
        top: "100%",
        right: 12,
        marginTop: "4px",
        width: 344,
        maxWidth: "calc(100% - 24px)",
        zIndex: Z.popover,
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 6,
        boxShadow: "var(--shadow-menu)",
        padding: "var(--space-2)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      {/* Search input core — no flex wrapper */}
      <SearchInputCore value={value} onChange={onChange} onClear={onClear} ref={inputRef} />

      {/* Status and navigation */}
      {searchStatusText !== null && (
        <div
          data-testid="search-status"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-1)",
            color:
              searchStatus === "error" ? "var(--color-destructive)" : "var(--color-text-muted)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
            whiteSpace: "nowrap",
          }}
        >
          <span role="status" aria-atomic="true">
            {searchStatusText}
          </span>
          <div style={{ display: "flex", gap: "var(--space-1)" }}>
            <button
              type="button"
              aria-label="Previous result"
              disabled={!hasSearchMatches}
              onClick={(e) => {
                onNavigate("previous");
                // Keep focus on the clicked button so a selection re-render
                // cannot bounce focus back to the input (D-11).
                (e.currentTarget as HTMLButtonElement).focus();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: !hasSearchMatches ? "not-allowed" : "pointer",
                color: !hasSearchMatches ? "var(--color-text-disabled)" : "var(--color-text-muted)",
                padding: 0,
                borderRadius: 3,
              }}
              onFocus={(e) => {
                if (!hasSearchMatches) return;
                (e.currentTarget as HTMLButtonElement).style.outline =
                  "2px solid var(--color-accent)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLButtonElement).style.outline = "none";
              }}
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              aria-label="Next result"
              disabled={!hasSearchMatches}
              onClick={(e) => {
                onNavigate("next");
                // Keep focus on the clicked button so a selection re-render
                // cannot bounce focus back to the input (D-11).
                (e.currentTarget as HTMLButtonElement).focus();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: !hasSearchMatches ? "not-allowed" : "pointer",
                color: !hasSearchMatches ? "var(--color-text-disabled)" : "var(--color-text-muted)",
                padding: 0,
                borderRadius: 3,
              }}
              onFocus={(e) => {
                if (!hasSearchMatches) return;
                (e.currentTarget as HTMLButtonElement).style.outline =
                  "2px solid var(--color-accent)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLButtonElement).style.outline = "none";
              }}
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
