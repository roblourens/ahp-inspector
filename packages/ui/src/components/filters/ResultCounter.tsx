import type { JSX } from "react";

interface ResultCounterProps {
  visible: number;
  total: number;
}

export function ResultCounter({ visible, total }: ResultCounterProps): JSX.Element {
  const isFiltered = visible !== total;
  const isZero = visible === 0 && isFiltered;

  return (
    <span
      style={{
        color: isZero ? "var(--color-warning)" : "var(--color-text-muted)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-ui-muted-size)",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      {isFiltered ? `${visible}/${total} events` : `${total} events`}
    </span>
  );
}
