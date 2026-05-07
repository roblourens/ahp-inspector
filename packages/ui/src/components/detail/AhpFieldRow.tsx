/**
 * AhpFieldRow — a single 24 px-tall labeled field row in the AHP strip.
 *
 * Layout: 2px color stripe | 96px label | flex value | optional annotation
 * No raw #hex literals — all colors come from CSS variables.
 */
import type { JSX } from "react";

interface AhpFieldRowProps {
  stripeColor: string;
  label: string;
  value: string;
  annotation?: string;
}

export function AhpFieldRow({
  stripeColor,
  label,
  value,
  annotation,
}: AhpFieldRowProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "24px",
        borderLeft: `2px solid ${stripeColor}`,
        paddingLeft: "var(--space-2)",
        gap: "var(--space-2)",
        fontSize: "var(--text-ui-muted-size)",
        fontFamily: "var(--font-mono)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: "96px",
          color: "var(--color-text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          color: "var(--color-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      {annotation ? (
        <span
          style={{
            flexShrink: 0,
            color: "var(--color-warning)",
            fontSize: "12px",
            fontFamily: "var(--font-sans)",
          }}
        >
          {annotation}
        </span>
      ) : null}
    </div>
  );
}
