import type { JSX } from "react";

export function SummaryCell({ text }: { text: string }): JSX.Element {
  return (
    <span
      data-testid="row-summary"
      className="summary"
      style={{
        color: "var(--color-text-muted)",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        overflow: "hidden",
        display: "inline-block",
        maxWidth: "100%",
      }}
    >
      {text}
    </span>
  );
}
