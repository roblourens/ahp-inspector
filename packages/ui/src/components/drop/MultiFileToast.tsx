// MultiFileToast — locked copy and tokens per 17-UI-SPEC.md.

import { type JSX, useEffect } from "react";

export function MultiFileToast(props: {
  basename: string;
  ignoredCount: number;
  onDismiss: () => void;
}): JSX.Element {
  const { basename, ignoredCount, onDismiss } = props;

  useEffect(() => {
    const id = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(id);
  }, [onDismiss]);

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    bottom: "var(--space-6)",
    right: "var(--space-6)",
    maxWidth: 360,
    padding: "var(--space-2) var(--space-3)",
    background: "var(--color-surface-raised)",
    borderLeft: "2px solid var(--color-accent)",
    borderRadius: 4,
    color: "var(--color-text)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-ui-size)",
    lineHeight: 1.4,
    zIndex: 1001,
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
  };

  const codeStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-ui-size)",
  };

  const dismissStyle: React.CSSProperties = {
    marginLeft: "var(--space-3)",
    background: "transparent",
    border: "none",
    color: "var(--color-text-muted)",
    cursor: "pointer",
    fontSize: "var(--text-ui-size)",
    fontFamily: "var(--font-sans)",
    padding: 0,
    lineHeight: 1,
  };

  const plural = ignoredCount === 1 ? "" : "s";

  return (
    <div
      role="status"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: toast is focusable so users can dismiss via Escape (UI-SPEC requirement)
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDismiss();
      }}
      style={containerStyle}
    >
      <span>
        Opened <code style={codeStyle}>{basename}</code>. Ignored {ignoredCount} other file{plural}.
      </span>
      <button type="button" aria-label="Dismiss notice" onClick={onDismiss} style={dismissStyle}>
        ×
      </button>
    </div>
  );
}
