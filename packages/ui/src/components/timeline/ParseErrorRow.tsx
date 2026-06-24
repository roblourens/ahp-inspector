// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid rows/cells use divs per ARIA grid pattern and absolute positioning.
// biome-ignore-all lint/a11y/useFocusableInteractive: grid keyboard focus is managed at the row level; individual cells are not tab stops.

import type { EventRow as EventRowData } from "@ahp-inspector/core";
import type { CSSProperties, JSX } from "react";

export function ParseErrorRow({
  row,
  isSelected,
  onClick,
  isAlternate = false,
  style,
}: {
  row: EventRowData;
  isSelected: boolean;
  onClick: () => void;
  isAlternate?: boolean;
  style?: CSSProperties;
}): JSX.Element {
  const cellStyle: CSSProperties = {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <div
      role="row"
      aria-rowindex={row.idx + 1}
      aria-selected={isSelected}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      tabIndex={isSelected ? 0 : -1}
      data-testid={`parse-error-${row.idx}`}
      data-alternate={isAlternate ? "true" : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "2px 1fr",
        alignItems: "center",
        height: "var(--row-height)",
        boxSizing: "border-box",
        padding: "2px 8px",
        cursor: "pointer",
        fontSize: "var(--text-ui-muted-size)",
        lineHeight: "16px",
        background: isSelected
          ? "var(--color-surface-raised)"
          : isAlternate
            ? "color-mix(in srgb, var(--color-surface-raised) 18%, transparent)"
            : "transparent",
        ...style,
      }}
    >
      <div
        role="gridcell"
        data-testid="parse-error-rail"
        style={{
          width: 2,
          height: "100%",
          overflow: "hidden",
          background:
            "repeating-linear-gradient(45deg, var(--color-destructive) 0 2px, transparent 2px 6px)",
        }}
      />
      <div
        role="gridcell"
        className="mono"
        style={{ ...cellStyle, color: "var(--color-destructive)" }}
      >
        {`BAD · line ${row.lineIndex ?? "?"} · ${row.parseErrorReason ?? "unknown"}`}
      </div>
    </div>
  );
}
