import type { JSX } from "react";

export function EmptyState(): JSX.Element {
  return (
    <div
      data-testid="state-empty"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: "var(--space-2)",
        color: "var(--color-text-muted)",
      }}
    >
      <div style={{ fontWeight: 600, color: "var(--color-text)" }}>No events yet</div>
      <div>This log file is empty. Events will appear as they are written.</div>
    </div>
  );
}
