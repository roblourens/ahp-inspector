import type { CSSProperties, JSX } from "react";

export interface StickyGroupBarProps {
  topGroup: { level: "session" | "turn"; label: string } | null;
}

/**
 * Renders a 24px bar above the timeline showing the current topmost visible
 * group label. Hidden (returns null) when topGroup is null (no grouping or
 * no visible headers).
 */
export function StickyGroupBar({ topGroup }: StickyGroupBarProps): JSX.Element | null {
  if (topGroup === null) return null;

  return (
    <div
      data-testid="sticky-group-bar"
      style={{
        height: "var(--row-group-header-height)",
        display: "flex",
        alignItems: "center",
        paddingLeft: topGroup.level === "turn" ? "var(--space-5)" : "var(--space-3)",
        paddingRight: "var(--space-3)",
        background: "var(--color-group-header-bg)",
        color: "var(--color-group-header-fg)",
        fontSize: "var(--text-ui-muted-size)",
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--weight-semibold)" as CSSProperties["fontWeight"],
        borderBottom: "1px solid var(--color-border)",
        flexShrink: 0,
        zIndex: 1,
      }}
    >
      {topGroup.label}
    </div>
  );
}
