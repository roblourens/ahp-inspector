import type { JSX } from "react";
import type { Connection } from "../../state/store.js";

interface StatusBarProps {
  connection: Connection;
  eventCount: number;
  selectedRowIndex?: number | null;
  visibleCount?: number;
  totalCount?: number;
  groupCount?: number;
  notice?: string | null;
}

interface StatusVisual {
  glyph: string;
  dotColor: string;
  label: string;
}

function visualFor(
  connection: Connection,
  eventCount: number,
  selectedRowIndex: number | null | undefined,
  visibleCount: number | undefined,
  totalCount: number | undefined,
  groupCount: number | undefined,
): StatusVisual {
  switch (connection) {
    case "connected": {
      const base = `Connected · ${eventCount} events`;
      let label =
        selectedRowIndex != null && selectedRowIndex >= 0
          ? `${base} · selected #${selectedRowIndex}`
          : base;
      // Show visible/total when filtered
      if (visibleCount !== undefined && totalCount !== undefined && visibleCount !== totalCount) {
        label = `${label} · ${visibleCount}/${totalCount} visible`;
      }
      // Show group count when grouped
      if (groupCount !== undefined && groupCount > 0) {
        label = `${label} · ${groupCount} groups`;
      }
      return { glyph: "●", dotColor: "var(--color-success)", label };
    }
    case "connecting":
      return { glyph: "◐", dotColor: "var(--color-warning)", label: "Connecting…" };
    case "disconnected":
      return { glyph: "●", dotColor: "var(--color-destructive)", label: "Disconnected" };
    case "no-server":
      return { glyph: "●", dotColor: "var(--color-destructive)", label: "No server" };
    case "no-log":
      return { glyph: "○", dotColor: "var(--color-text-subtle)", label: "No log selected" };
  }
}

export function StatusBar({
  connection,
  eventCount,
  selectedRowIndex = null,
  visibleCount,
  totalCount,
  groupCount,
  notice,
}: StatusBarProps): JSX.Element {
  const { glyph, dotColor, label } = visualFor(
    connection,
    eventCount,
    selectedRowIndex,
    visibleCount,
    totalCount,
    groupCount,
  );
  return (
    <div
      style={{
        height: 24,
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        padding: "0 var(--space-2)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "var(--text-ui-muted-size)",
        flex: "0 0 auto",
      }}
      data-testid="status-bar"
    >
      <span data-testid="status-dot" style={{ color: dotColor, width: 8 }}>
        {glyph}
      </span>
      <span data-testid="status-label">{label}</span>
      {notice && (
        <span role="status" style={{ color: "var(--color-warning)" }}>
          · {notice}
        </span>
      )}
    </div>
  );
}
