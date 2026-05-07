import type { JSX } from "react";

export function PayloadPreview({ text }: { text: string }): JSX.Element {
  return (
    <span
      data-testid="payload-preview"
      className="preview"
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
