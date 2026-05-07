import type { JSX, CSSProperties } from "react";
import type { EventRow as EventRowData } from "@ahp-viewer/core";

export function ParseErrorRow({
  row,
  isSelected,
  onClick,
  style,
}: {
  row: EventRowData;
  isSelected: boolean;
  onClick: () => void;
  style?: CSSProperties;
}): JSX.Element {
  return (
    <div
      role="row"
      aria-rowindex={row.idx + 1}
      aria-selected={isSelected}
      onClick={onClick}
      data-testid={`parse-error-${row.idx}`}
      style={{
        display: "grid",
        gridTemplateColumns: "2px 1fr",
        alignItems: "center",
        height: "var(--row-height)",
        padding: "4px 8px",
        cursor: "pointer",
        background: isSelected ? "var(--color-surface-raised)" : "transparent",
        ...style,
      }}
    >
      <div
        role="gridcell"
        data-testid="parse-error-rail"
        style={{
          width: 2,
          height: "100%",
          background:
            "repeating-linear-gradient(45deg, var(--color-destructive) 0 2px, transparent 2px 6px)",
        }}
      />
      <div role="gridcell" className="mono" style={{ color: "var(--color-destructive)" }}>
        {`BAD · line ${row.lineIndex ?? "?"} · ${row.parseErrorReason ?? "unknown"}`}
      </div>
    </div>
  );
}
