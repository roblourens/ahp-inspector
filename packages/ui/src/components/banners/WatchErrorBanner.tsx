// WatchErrorBanner (Plan 04-05 Task 2 / UI-SPEC §7).
// Shown by AppShell while `store.lastWatchError` is non-null.
// Copy uses MAPPED display strings — never raw OS error text.

import type { JSX } from "react";

const CODE_DISPLAY: Record<string, string> = {
  "read-error": "file read error",
  "watch-fatal": "watcher stopped",
};

export function WatchErrorBanner({
  code,
  onRetry,
  onReopen,
}: {
  code: string;
  onRetry(): void;
  onReopen(): void;
}): JSX.Element {
  const display = CODE_DISPLAY[code] ?? "unknown error";
  return (
    <div
      role="alert"
      data-testid="watch-error-banner"
      style={{
        height: 40,
        background: "var(--color-banner-watch-error-bg)",
        color: "var(--color-banner-watch-error-fg)",
        borderLeft: "2px solid var(--color-destructive)",
        padding: "0 var(--space-4)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        flex: "0 0 auto",
      }}
    >
      <span aria-hidden="true">✕</span>
      <span style={{ flex: 1 }}>Watch error: {display}</span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          height: 24,
          padding: "0 var(--space-3)",
          background: "transparent",
          border: "1px solid currentColor",
          borderRadius: 4,
          color: "inherit",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Retry Connection
      </button>
      <button
        type="button"
        onClick={onReopen}
        style={{
          height: 24,
          padding: "0 var(--space-3)",
          background: "transparent",
          border: "1px solid currentColor",
          borderRadius: 4,
          color: "inherit",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Reopen log
      </button>
    </div>
  );
}
