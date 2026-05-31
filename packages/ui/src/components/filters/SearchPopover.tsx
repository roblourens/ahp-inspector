import { ChevronDown, ChevronUp } from "lucide-react";
import type { JSX, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { SearchInputCore } from "./SearchInputCore.js";

interface SearchPopoverProps {
  value: string;
  onChange(q: string): void;
  onClear(): void;
  onClose(): void;
  searchTotal: number;
  searchStatus: "idle" | "searching" | "error";
  searchError?: string;
  searchTruncated: boolean;
  searchMatchCount: number;
  focusedSearchIndex: number | null;
  onNavigate(direction: "previous" | "next"): void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function SearchPopover({
  value,
  onChange,
  onClear,
  onClose,
  searchTotal,
  searchStatus,
  searchError,
  searchTruncated,
  searchMatchCount,
  focusedSearchIndex,
  onNavigate,
  inputRef,
}: SearchPopoverProps): JSX.Element {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const hasSearch = value.trim() !== "";
  const hasSearchMatches = hasSearch && searchTotal > 0;
  const searchStatusText = !hasSearch
    ? null
    : searchStatus === "searching"
      ? "Searching..."
      : searchStatus === "error"
        ? `Search failed${searchError ? `: ${searchError}` : ""}`
        : focusedSearchIndex !== null && focusedSearchIndex >= 0
          ? `${(focusedSearchIndex + 1).toLocaleString()} of ${searchMatchCount.toLocaleString()} ${searchMatchCount === 1 ? "match" : "matches"}${searchTruncated ? "+" : ""}`
          : `${searchMatchCount.toLocaleString()} ${searchMatchCount === 1 ? "match" : "matches"}${searchTruncated ? "+" : ""}`;

  return (
    <div
      ref={popoverRef}
      role="region"
      aria-label="Search popover"
      data-testid="search-popover"
      style={{
        position: "absolute",
        top: "100%",
        right: 12,
        marginTop: "4px",
        width: 344,
        maxWidth: "calc(100% - 24px)",
        zIndex: 1100,
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
      <SearchInputCore
        value={value}
        onChange={onChange}
        onClear={onClear}
        ref={inputRef}
      />

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
              searchStatus === "error" ? "var(--color-danger)" : "var(--color-text-muted)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
            whiteSpace: "nowrap",
          }}
        >
          <span>{searchStatusText}</span>
          <div style={{ display: "flex", gap: "var(--space-1)" }}>
            <button
              type="button"
              aria-label="Previous search match"
              disabled={!hasSearchMatches}
              onClick={() => onNavigate("previous")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: !hasSearchMatches ? "not-allowed" : "pointer",
                color: !hasSearchMatches
                  ? "var(--color-text-disabled)"
                  : "var(--color-text-muted)",
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
              aria-label="Next search match"
              disabled={!hasSearchMatches}
              onClick={() => onNavigate("next")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: !hasSearchMatches ? "not-allowed" : "pointer",
                color: !hasSearchMatches
                  ? "var(--color-text-disabled)"
                  : "var(--color-text-muted)",
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
