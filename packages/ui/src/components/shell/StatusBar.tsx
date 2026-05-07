import type { JSX } from "react";
import type { Connection } from "../../state/store.js";

interface StatusBarProps {
  connection: Connection;
  eventCount: number;
  selectedRowIndex?: number | null;
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
): StatusVisual {
  switch (connection) {
    case "connected": {
      const base = `Connected · ${eventCount} events`;
      const label =
        selectedRowIndex != null && selectedRowIndex >= 0
          ? `${base} · selected #${selectedRowIndex}`
          : base;
      return { glyph: "●", dotColor: "var(--color-success)", label };
    }
    case "connecting":
      return { glyph: "◐", dotColor: "var(--color-warning)", label: "Connecting…" };
    case "disconnected":
      return { glyph: "●", dotColor: "var(--color-destructive)", label: "Disconnected" };
    case "no-server":
      return { glyph: "●", dotColor: "var(--color-destructive)", label: "No server" };
  }
}

export function StatusBar({
  connection,
  eventCount,
  selectedRowIndex = null,
}: StatusBarProps): JSX.Element {
  const { glyph, dotColor, label } = visualFor(connection, eventCount, selectedRowIndex);
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
    </div>
  );
}
