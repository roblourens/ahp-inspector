// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid rows/cells use divs per ARIA grid pattern and absolute positioning.
// biome-ignore-all lint/a11y/useFocusableInteractive: grid keyboard focus is managed at the row level; individual cells are not tab stops.

import type { EventRow as EventRowData } from "@ahp-inspector/core";
import { ShieldAlert } from "lucide-react";
import type { CSSProperties, JSX } from "react";
import { memo, useCallback } from "react";
import { DirectionGlyph } from "./cells/DirectionGlyph.js";
import { EventNameLabel } from "./cells/EventNameLabel.js";
import { KindTag } from "./cells/KindTag.js";
import { LatencyCell } from "./cells/LatencyCell.js";
import { SummaryCell } from "./cells/SummaryCell.js";

export interface EventRowProps {
  row: EventRowData;
  isSelected: boolean;
  /** Stable selection callback; receives this row's index. Kept stable so the
   * surrounding `memo` short-circuits on unrelated re-renders. */
  onSelect: (idx: number) => void;
  /**
   * Absolute vertical offset (px) within the virtualized list. Passed as a
   * primitive (rather than a fresh `style` object) so `memo` can compare it.
   * When omitted the row renders in normal flow (e.g. in unit tests).
   */
  top?: number;
  searchQuery?: string;
  isSearchMatch?: boolean;
  pairHighlight?: "request" | "response" | null;
  pairHidden?: "request" | "response" | null;
  /** Grid template for this row; must match the header and all sibling rows. */
  gridColumns?: string;
  isAlternate?: boolean;
}

/** Default ID column width (px) used before any data-driven sizing applies. */
export const ID_COLUMN_DEFAULT_WIDTH = 96;

/**
 * Builds the timeline grid template. The ID column is sized to fit the widest
 * ID present in the data (computed by the caller) so short or absent IDs don't
 * leave a large gap before the Time column.
 */
export function buildTimelineGridColumns(idColumnWidth: number = ID_COLUMN_DEFAULT_WIDTH): string {
  return `4px ${idColumnWidth}px 96px 16px 36px 220px 132px 72px 72px minmax(240px, 1fr)`;
}

export const TIMELINE_GRID_COLUMNS = buildTimelineGridColumns();

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

export const EventRow = memo(function EventRow({
  row,
  isSelected,
  onSelect,
  top,
  searchQuery = "",
  isSearchMatch = false,
  pairHighlight = null,
  pairHidden = null,
  gridColumns = TIMELINE_GRID_COLUMNS,
  isAlternate = false,
}: EventRowProps): JSX.Element {
  const label = primaryLabel(row);
  const labelTitle = primaryLabelTitle(row);
  const badge = statusBadge(row);
  const handleClick = useCallback(() => onSelect(row.idx), [onSelect, row.idx]);
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
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
      tabIndex={isSelected ? 0 : -1}
      data-testid={`row-${row.idx}`}
      data-selected={isSelected ? "true" : undefined}
      data-search-match={isSearchMatch ? "true" : undefined}
      data-pair-highlight={pairHighlight ?? undefined}
      data-pair-hidden={pairHidden ?? undefined}
      data-alternate={isAlternate ? "true" : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: gridColumns,
        alignItems: "center",
        height: "var(--row-height)",
        boxSizing: "border-box",
        padding: "2px 8px",
        cursor: "pointer",
        minWidth: "max-content",
        fontSize: "var(--text-ui-muted-size)",
        lineHeight: "16px",
        background: isSelected
          ? "var(--row-selected-bg)"
          : pairHighlight
            ? "color-mix(in srgb, var(--color-info) 14%, transparent)"
            : isSearchMatch
              ? "color-mix(in srgb, var(--color-search-match-bg) 28%, transparent)"
              : isAlternate
                ? "color-mix(in srgb, var(--color-surface-raised) 18%, transparent)"
                : "transparent",
        ...(top !== undefined
          ? {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${top}px)`,
            }
          : {}),
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
          {label ? <EventNameLabel label={label} searchQuery={searchQuery} /> : "—"}
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
