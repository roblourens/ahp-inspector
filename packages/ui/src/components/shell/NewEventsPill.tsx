// NewEventsPill — Phase 4 Plan 06 Task 1 / UI-SPEC §5.
// Floating pill rendered by TimelineRegion (absolute, bottom-center) when
// livePaused === true && pendingNewCount > 0. Click flushes the buffered rows
// and resumes live-follow.

import type { JSX } from "react";

export function NewEventsPill({ count, onClick }: { count: number; onClick(): void }): JSX.Element {
  const display = count >= 100 ? "99+" : count.toLocaleString();
  const noun = count === 1 ? "new event" : "new events";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      data-testid="new-events-pill"
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        height: 28,
        padding: "0 var(--space-4)",
        background: "var(--color-surface-raised)",
        color: "var(--color-text)",
        border: "1px solid var(--color-pill-border)",
        borderRadius: 14,
        boxShadow: "var(--shadow-menu)",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: "var(--text-row-size)",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <span>
        {display} {noun}
      </span>
      <span aria-hidden="true">·</span>
      <span style={{ color: "var(--color-accent)" }}>Resume Following</span>
    </button>
  );
}
