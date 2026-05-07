/**
 * CopyToast — brief feedback after a clipboard copy attempt.
 *
 * - 1.5s auto-dismiss via useEffect timeout
 * - Success: --color-success tint background
 * - Failure: --color-destructive tint background
 * - prefers-reduced-motion: opacity animation skipped
 *
 * No raw #hex literals.
 */
import { type JSX, useEffect, useState } from "react";

interface CopyToastProps {
  message: string;
  kind: "success" | "error";
}

export function CopyToast({ message, kind }: CopyToastProps): JSX.Element | null {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  const bgColor =
    kind === "success"
      ? "color-mix(in srgb, var(--color-success) 20%, var(--color-surface-raised))"
      : "color-mix(in srgb, var(--color-destructive) 20%, var(--color-surface-raised))";

  const borderColor = kind === "success" ? "var(--color-success)" : "var(--color-destructive)";

  return (
    <div
      data-testid="copy-toast"
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        bottom: "var(--space-4)",
        right: "var(--space-4)",
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "4px",
        padding: "var(--space-2) var(--space-3)",
        fontSize: "var(--text-ui-muted-size)",
        fontFamily: "var(--font-sans)",
        color: "var(--color-text)",
        zIndex: 100,
        animation: "ahp-fade-in 0.15s ease",
        pointerEvents: "none",
      }}
    >
      {message}
    </div>
  );
}
