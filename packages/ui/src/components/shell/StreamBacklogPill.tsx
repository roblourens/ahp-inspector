import type { JSX } from "react";

export function StreamBacklogPill({ count }: { count: number }): JSX.Element {
  const display = count >= 100 ? "99+" : count.toLocaleString();
  const noun = count === 1 ? "event" : "events";
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="stream-backlog-pill"
      style={{
        position: "absolute",
        bottom: 52,
        left: "50%",
        transform: "translateX(-50%)",
        height: 28,
        padding: "0 var(--space-4)",
        background: "var(--color-surface-raised)",
        color: "var(--color-text)",
        border: "1px solid var(--color-pill-border)",
        borderRadius: 14,
        boxShadow: "var(--shadow-menu)",
        fontWeight: 600,
        fontSize: "var(--text-row-size)",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {display} stream {noun} queued
    </div>
  );
}
