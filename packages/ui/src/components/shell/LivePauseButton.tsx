// LivePauseButton — Phase 4 Plan 06 Task 1 / UI-SPEC §3 / D-13.
// Toggles `store.livePaused`. Pause is UI-only (D-15): SSE keeps streaming,
// the server is unaware. While paused, scroll is anchored and incoming rows
// accumulate in the store's pendingBuffer + pendingNewCount counter.

import { Pause, Play } from "lucide-react";
import type { JSX } from "react";
import { useAppStore } from "../../state/store.js";

export function LivePauseButton(): JSX.Element {
  const livePaused = useAppStore((s) => s.livePaused);
  const setLivePaused = useAppStore((s) => s.setLivePaused);
  const Icon = livePaused ? Play : Pause;
  return (
    <button
      type="button"
      onClick={() => setLivePaused(!livePaused)}
      aria-pressed={livePaused}
      aria-label={livePaused ? "Resume live follow" : "Pause live follow"}
      data-testid="live-pause-button"
      style={{
        height: 28,
        padding: "0 var(--space-3)",
        background: livePaused
          ? "color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))"
          : "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: 4,
        color: livePaused ? "var(--color-accent)" : "var(--color-text)",
        cursor: "pointer",
        fontSize: "var(--text-ui-muted-size)",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <Icon size={14} aria-hidden="true" />
      {livePaused ? "Resume" : "Pause"}
    </button>
  );
}
