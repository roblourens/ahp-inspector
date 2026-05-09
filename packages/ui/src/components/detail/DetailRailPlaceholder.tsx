import type { EventRow } from "@ahp-inspector/core";
import type { JSX } from "react";

interface DetailRailPlaceholderProps {
  selectedEvent?: EventRow | null;
}

function dirWord(dir: string | undefined | null): string {
  switch (dir) {
    case "c2s":
      return "Client → Server";
    case "s2c":
      return "Server → Client";
    default:
      return "—";
  }
}

export function DetailRailPlaceholder({
  selectedEvent = null,
}: DetailRailPlaceholderProps): JSX.Element {
  return (
    <aside
      className="detail-rail"
      data-testid="detail-rail"
      style={{
        background: "var(--color-surface)",
        borderLeft: "1px solid var(--color-border-strong)",
        padding: "var(--space-3)",
        color: "var(--color-text)",
        flex: "0 0 auto",
        overflow: "auto",
      }}
    >
      {selectedEvent == null ? (
        <div style={{ color: "var(--color-text-muted)" }}>Select a row to preview.</div>
      ) : (
        <>
          <div className="mono">
            {selectedEvent.tsFmt} · {dirWord(selectedEvent.dir)} · {selectedEvent.kindTag} ·{" "}
            {selectedEvent.method ?? "—"}
          </div>
          <div style={{ color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
            Full detail view ships in Phase 3.
          </div>
        </>
      )}
    </aside>
  );
}
