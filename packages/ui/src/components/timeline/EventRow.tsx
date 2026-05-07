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

function railColor(row: EventRowData, isSelected: boolean): string {
  if (isSelected) return "var(--color-accent)";
  if (row.status === "orphan" || row.status === "unmatched") return "var(--color-warning)";
  if (row.status === "error") return "var(--color-destructive)";
  return "transparent";
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
        gridTemplateColumns: "2px 96px 16px 44px 220px 64px 48px 64px 72px 96px 1fr",
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
        style={{ width: 2, height: "100%", background: railColor(row, isSelected) }}
      />
      <div role="gridcell" className="ts">
        {row.tsFmt}
      </div>
      <div role="gridcell">
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
      <div role="gridcell">
        <KindTag kind={row.kindTag} />
      </div>
      <div role="gridcell" className="method" title={row.method ?? row.actionType ?? ""}>
        <ActionDot family={row.actionFamily} />
        <span
          style={{
            marginLeft: row.actionFamily ? 4 : 0,
            fontWeight: row.method ? 600 : 400,
          }}
        >
          {row.method
            ? highlightMatches(row.method, searchQuery)
            : row.actionType
              ? highlightMatches(row.actionType, searchQuery)
              : "—"}
        </span>
      </div>
      <div role="gridcell" className="id" title={row.sessionId ?? ""}>
        {row.sessionShort ?? "—"}
      </div>
      <div role="gridcell" className="id" title={row.turnId ?? ""}>
        {row.turnShort ?? "—"}
      </div>
      <div role="gridcell">
        <StatusCell status={row.status} />
      </div>
      <div role="gridcell">
        <LatencyCell ms={row.latencyMs} band={row.latencyBand} />
      </div>
      <div role="gridcell" className="id">
        {row.keyId ?? "—"}
      </div>
      <div role="gridcell">
        <PayloadPreview text={row.payloadPreview} />
      </div>
    </div>
  );
});
