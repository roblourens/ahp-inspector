// SwitchLogButton (Plan 04-05 Task 2 / UI-SPEC §3 HeaderBar).
// Mounted in HeaderBar; toggles LogPickerPanel in AppShell.

import type { JSX } from "react";

export function SwitchLogButton({ onClick }: { onClick(): void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Switch log"
      style={{
        height: 28,
        padding: "0 var(--space-3)",
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: 4,
        color: "var(--color-text)",
        cursor: "pointer",
        fontSize: "var(--text-ui-muted-size)",
      }}
    >
      Switch log…
    </button>
  );
}
