// RotationBanner (Plan 04-05 Task 2 / UI-SPEC §6).
// Auto-dismissing alert shown when SSE `rotation` event fires.
// Mounted by TimelineRegion (04-06 Task 2) above the virtual list — NOT by AppShell.

import { type JSX, useEffect } from "react";

export function RotationBanner({ onAutoDismiss }: { onAutoDismiss(): void }): JSX.Element {
  useEffect(() => {
    const t = setTimeout(onAutoDismiss, 5000);
    return () => clearTimeout(t);
  }, [onAutoDismiss]);
  return (
    <div
      role="alert"
      data-testid="rotation-banner"
      style={{
        height: 32,
        background: "var(--color-banner-rotation-bg)",
        color: "var(--color-banner-rotation-fg)",
        borderLeft: "3px solid var(--color-banner-rotation-fg)",
        padding: "0 var(--space-4)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <span aria-hidden="true">⚠</span>
      <span>Log rotated — reloading from new file.</span>
    </div>
  );
}
