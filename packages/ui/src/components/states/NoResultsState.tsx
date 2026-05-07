import type { JSX } from "react";

type NoResultsKind = "filters" | "search" | "combined" | "search-error";

interface NoResultsStateProps {
  kind: NoResultsKind;
  onClear(): void;
  onRetry?(): void;
  errorMessage?: string;
}

const COPY: Record<NoResultsKind, { heading: string; body: string; action: string }> = {
  filters: {
    heading: "No events match your filters",
    body: "Try removing a filter or expanding the time range.",
    action: "Clear all filters",
  },
  search: {
    heading: "No events match your search",
    body: "Try a shorter or different query. Search is case-insensitive substring across method, ids, session, turn, error text, and payload.",
    action: "Clear search",
  },
  combined: {
    heading: "No events match your search and filters",
    body: "Try removing a filter or shortening your query.",
    action: "Clear all",
  },
  "search-error": {
    heading: "Search failed",
    body: "",
    action: "Retry search",
  },
};

export function NoResultsState({
  kind,
  onClear,
  onRetry,
  errorMessage,
}: NoResultsStateProps): JSX.Element {
  const copy = COPY[kind];
  const body = kind === "search-error" ? (errorMessage ?? "") : copy.body;
  const handleAction = kind === "search-error" && onRetry ? onRetry : onClear;

  return (
    <div
      data-testid="no-results-state"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-8)",
        gap: "var(--space-3)",
        flex: 1,
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-heading-size)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--color-text)",
          margin: 0,
        }}
      >
        {copy.heading}
      </h2>
      {body && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-size)",
            color: "var(--color-text-muted)",
            margin: 0,
            textAlign: "center",
            maxWidth: 420,
          }}
        >
          {body}
        </p>
      )}
      <button
        type="button"
        onClick={handleAction}
        style={{
          background: "none",
          border: "none",
          color: "var(--color-accent)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-body-size)",
          padding: "var(--space-1) var(--space-2)",
          borderRadius: 4,
          outline: "none",
          textDecoration: "underline",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.outline = "2px solid var(--color-accent)";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.outline = "none";
        }}
      >
        {copy.action}
      </button>
    </div>
  );
}
