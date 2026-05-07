// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid rows/cells use divs per ARIA grid pattern and absolute positioning.
// biome-ignore-all lint/a11y/useFocusableInteractive: grid keyboard focus is managed at the row level; individual cells are not tab stops.

import type { EventRow as EventRowData } from "@ahp-viewer/core";
import { ShieldAlert } from "lucide-react";
import type { CSSProperties, JSX } from "react";
import { memo } from "react";
import { ActionDot } from "./cells/ActionDot.js";
import { DirectionGlyph } from "./cells/DirectionGlyph.js";
import { KindTag } from "./cells/KindTag.js";
import { LatencyCell } from "./cells/LatencyCell.js";
import { PayloadPreview } from "./cells/PayloadPreview.js";
import { StatusCell } from "./cells/StatusCell.js";

export interface EventRowProps {
  row: EventRowData;
  isSelected: boolean;
  onClick: () => void;
  style?: CSSProperties;
  searchQuery?: string;
}

export const TIMELINE_GRID_COLUMNS = "2px 96px 16px 44px 240px 132px 72px 64px 72px 96px 1fr";

const cellStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function railColor(row: EventRowData, isSelected: boolean): string {
  if (isSelected) return "var(--color-accent)";
  if (row.status === "orphan" || row.status === "unmatched") return "var(--color-warning)";
  if (row.status === "error") return "var(--color-destructive)";
  return "transparent";
}

function primaryLabel(row: EventRowData): string | null {
  if (row.kind === "action") return row.actionType ?? row.method;
  return row.method ?? row.actionType;
}

function primaryLabelTitle(row: EventRowData): string {
  const label = primaryLabel(row);
  if (row.kind === "action" && row.method && row.actionType) {
    return `${row.actionType} (${row.method})`;
  }
  return label ?? "";
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
}: EventRowProps): JSX.Element {
  const label = primaryLabel(row);
  const labelTitle = primaryLabelTitle(row);

  return (
    <div
      role="row"
      aria-rowindex={row.idx + 1}
      aria-selected={isSelected}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      tabIndex={isSelected ? 0 : -1}
      data-testid={`row-${row.idx}`}
      style={{
        display: "grid",
        gridTemplateColumns: TIMELINE_GRID_COLUMNS,
        alignItems: "center",
        height: "var(--row-height)",
        padding: "4px 8px",
        cursor: "pointer",
        background: isSelected ? "var(--color-surface-raised)" : "transparent",
        ...style,
      }}
    >
      <div
        role="gridcell"
        data-testid="row-rail"
        style={{ ...cellStyle, width: 2, height: "100%", background: railColor(row, isSelected) }}
      />
      <div role="gridcell" className="ts" style={cellStyle}>
        {row.tsFmt}
      </div>
      <div role="gridcell" style={cellStyle}>
        {row.isAuthFailure ? (
          <ShieldAlert
            size={14}
            data-testid="auth-fail-glyph"
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
        }}
      >
        <ActionDot family={row.actionFamily} />
        <span
          style={{
            marginLeft: row.actionFamily ? 4 : 0,
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
        <StatusCell status={row.status} />
      </div>
      <div role="gridcell" style={cellStyle}>
        <LatencyCell ms={row.latencyMs} band={row.latencyBand} />
      </div>
      <div role="gridcell" className="id" style={cellStyle}>
        {row.keyId ?? "—"}
      </div>
      <div role="gridcell" style={cellStyle}>
        <PayloadPreview text={row.payloadPreview} />
      </div>
    </div>
  );
});
