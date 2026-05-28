// WatchErrorBanner (Plan 04-05 Task 2 / UI-SPEC §7).
// Shown by AppShell while `store.lastWatchError` is non-null.
// Copy uses MAPPED display strings for codes that may carry raw OS text.
// For `oversized-line` the server's message is curated and safe to render
// verbatim so the user knows which line was skipped and why.

import type { JSX } from "react";

const CODE_DISPLAY: Record<string, string> = {
  "read-error": "file read error",
  "watch-fatal": "watcher stopped",
  "oversized-line": "oversized line skipped",
};

export function WatchErrorBanner({
  code,
  message,
  onRetry,
  onReopen,
  onDismiss,
}: {
  code: string;
  message?: string;
  onRetry(): void;
  onReopen(): void;
  onDismiss?(): void;
}): JSX.Element {
  const display = CODE_DISPLAY[code] ?? "unknown error";
  const isOversized = code === "oversized-line";
  return (
    <div
      role="alert"
      data-testid="watch-error-banner"
      style={{
        minHeight: 40,
        background: "var(--color-banner-watch-error-bg)",
        color: "var(--color-banner-watch-error-fg)",
        borderLeft: "2px solid var(--color-destructive)",
        padding: "var(--space-2) var(--space-4)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        flex: "0 0 auto",
      }}
    >
      <span aria-hidden="true">✕</span>
      <span style={{ flex: 1 }}>
        Watch error: {display}
        {isOversized && message ? (
          <span style={{ opacity: 0.85, marginLeft: "var(--space-2)" }}>— {message}</span>
        ) : null}
      </span>
      {isOversized ? (
        onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
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
            Dismiss
          </button>
        ) : null
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
