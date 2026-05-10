// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid rows/cells use divs per ARIA grid pattern and absolute positioning.
// biome-ignore-all lint/a11y/useFocusableInteractive: grid keyboard focus is managed at the row level; individual cells are not tab stops.

import type { EventRow as EventRowData } from "@ahp-inspector/core";
import { ShieldAlert } from "lucide-react";
import type { CSSProperties, JSX } from "react";
import { memo } from "react";
import { DirectionGlyph } from "./cells/DirectionGlyph.js";
import { KindTag } from "./cells/KindTag.js";
import { LatencyCell } from "./cells/LatencyCell.js";
import { SummaryCell } from "./cells/SummaryCell.js";

export interface EventRowProps {
  row: EventRowData;
  isSelected: boolean;
  onClick: () => void;
  style?: CSSProperties;
  searchQuery?: string;
  isSearchMatch?: boolean;
  pairHighlight?: "request" | "response" | null;
  pairHidden?: "request" | "response" | null;
}

export const TIMELINE_GRID_COLUMNS =
  "4px 96px 96px 16px 44px 220px 132px 72px 72px minmax(240px, 1fr)";

const cellStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function railColor(row: EventRowData, isSelected: boolean): string {
  if (isSelected) return "var(--color-accent)";
  if (row.status === "error" || row.isAuthFailure) return "var(--color-destructive)";
  if (row.status === "orphan" || row.status === "unmatched") return "var(--color-warning)";
  return "transparent";
}

function primaryLabel(row: EventRowData): string | null {
  if (row.kind === "action" || row.kind === "protocol-notification") {
    return row.actionType ?? row.method;
  }
  return row.method ?? row.actionType;
}

function primaryLabelTitle(row: EventRowData): string {
  const label = primaryLabel(row);
  if (
    (row.kind === "action" || row.kind === "protocol-notification") &&
    row.method &&
    row.actionType
  ) {
    return `${row.actionType} (${row.method})`;
  }
  return label ?? "";
}

function statusBadge(
  row: EventRowData,
): { text: string; title: string; tone: "error" | "warning" } | null {
  if (row.isAuthFailure) {
    return { text: "AUTH", title: "Authentication failure", tone: "error" };
  }
  if (row.status === "error") {
    return { text: "ERR", title: "Error response", tone: "error" };
  }
  if (row.status === "unmatched") {
    return {
      text: "TIMEOUT",
      title: "Request timed out before a response was observed",
      tone: "warning",
    };
  }
  if (row.status === "orphan") {
    return {
      text: "ORPHAN",
      title: "Response could not be paired with a visible request",
      tone: "warning",
    };
  }
  return null;
}

/**
 * Highlight occurrences of `query` (case-insensitive) within `text`.
 * Returns a JSX element with <mark> wrapping each match.
 * Only applies when query is ≥ 2 characters (T-03-05-03: uses React elements — auto-escaped, no XSS).
 */
function highlightMatches(text: string, query: string): JSX.Element {
  if (query.length < 2) return <>{text}</>;
  const lower = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  const parts: JSX.Element[] = [];
  let last = 0;
  let idx = lower.indexOf(lowerQ, last);
  while (idx !== -1) {
    if (idx > last) {
      parts.push(<span key={`t-${last}`}>{text.slice(last, idx)}</span>);
    }
    parts.push(
      <mark
        key={`m-${idx}`}
        style={{
          background: "var(--color-search-match-bg)",
          color: "var(--color-search-match-fg)",
        }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>,
    );
    last = idx + query.length;
    idx = lower.indexOf(lowerQ, last);
  }
  if (last < text.length) {
    parts.push(<span key={`t-${last}`}>{text.slice(last)}</span>);
  }
  return <>{parts}</>;
}

export const EventRow = memo(function EventRow({
  row,
  isSelected,
  onClick,
  style,
  searchQuery = "",
  isSearchMatch = false,
  pairHighlight = null,
  pairHidden = null,
}: EventRowProps): JSX.Element {
  const label = primaryLabel(row);
  const labelTitle = primaryLabelTitle(row);
  const badge = statusBadge(row);
  const hiddenPairCopy =
    pairHidden === "response"
      ? "Correlated response is hidden by current filters"
      : pairHidden === "request"
        ? "Correlated request is hidden by current filters"
        : null;

  return (
    <div
      role="row"
      aria-rowindex={row.idx + 1}
      aria-selected={isSelected}
      aria-label={`${row.keyId ?? "no id"} ${row.tsFmt} ${row.dir} ${row.kindTag} ${label ?? "no event"}${
        badge ? ` ${badge.text}` : ""
      }${hiddenPairCopy ? ` ${hiddenPairCopy}` : ""}`}
      title={hiddenPairCopy ?? undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      tabIndex={isSelected ? 0 : -1}
      data-testid={`row-${row.idx}`}
      data-selected={isSelected ? "true" : undefined}
      data-search-match={isSearchMatch ? "true" : undefined}
      data-pair-highlight={pairHighlight ?? undefined}
      data-pair-hidden={pairHidden ?? undefined}
      style={{
        display: "grid",
        gridTemplateColumns: TIMELINE_GRID_COLUMNS,
        alignItems: "center",
        height: "var(--row-height)",
        boxSizing: "border-box",
        padding: "4px 8px",
        cursor: "pointer",
        minWidth: "max-content",
        background: isSelected
          ? "var(--row-selected-bg)"
          : pairHighlight
            ? "color-mix(in srgb, var(--color-info) 14%, transparent)"
            : isSearchMatch
              ? "color-mix(in srgb, var(--color-search-match-bg) 28%, transparent)"
              : "transparent",
        ...style,
      }}
    >
      <div
        role="gridcell"
        data-testid="row-rail"
        style={{
          ...cellStyle,
          width: 4,
          height: "100%",
          background:
            isSearchMatch && !isSelected
              ? "var(--color-search-match-bg)"
              : railColor(row, isSelected),
        }}
      />
      <div role="gridcell" className="id" style={cellStyle}>
        {row.keyId ?? "—"}
      </div>
      <div role="gridcell" className="ts" style={cellStyle}>
        {row.tsFmt}
      </div>
      <div role="gridcell" style={cellStyle}>
        {row.isAuthFailure ? (
          <ShieldAlert
            size={14}
            data-testid="auth-fail-glyph"
            aria-label="Authentication failure"
            style={{ color: "var(--color-auth-fail-rail)", display: "block" }}
          />
        ) : (
          <DirectionGlyph direction={row.dir} />
        )}
      </div>
      <div role="gridcell" style={cellStyle}>
        <KindTag kind={row.kindTag} />
      </div>
      <div
        role="gridcell"
        className="method"
        title={labelTitle}
        style={{
          ...cellStyle,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1)",
        }}
      >
        {badge ? (
          <span
            data-testid="row-status-badge"
            title={badge.title}
            style={{
              color: badge.tone === "error" ? "var(--color-destructive)" : "var(--color-warning)",
              fontSize: "var(--text-ui-muted-size)",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {badge.text}
          </span>
        ) : null}
        <span
          style={{
            fontWeight: label ? 600 : 400,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {label ? highlightMatches(label, searchQuery) : "—"}
        </span>
      </div>
      <div role="gridcell" className="id" title={row.sessionId ?? ""} style={cellStyle}>
        {row.sessionShort ?? "—"}
      </div>
      <div role="gridcell" className="id" title={row.turnId ?? ""} style={cellStyle}>
        {row.turnShort ?? "—"}
      </div>
      <div role="gridcell" style={cellStyle}>
        <LatencyCell ms={row.latencyMs} band={row.latencyBand} />
      </div>
      <div role="gridcell" style={cellStyle}>
        <SummaryCell text={row.summary ?? row.payloadPreview} />
      </div>
    </div>
  );
});
