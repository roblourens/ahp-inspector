import type { JSX } from "react";

export function NoResultsBanner({ heading, body }: { heading: string; body: string }): JSX.Element {
  return (
    <div
      data-testid="banner-no-results"
      style={{
        minHeight: 64,
        padding: "var(--space-3)",
        background: "var(--color-surface)",
        borderLeft: "4px solid var(--color-warning)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
      }}
    >
      <div style={{ fontWeight: 600 }}>{heading}</div>
      <div>{body}</div>
    </div>
  );
}
