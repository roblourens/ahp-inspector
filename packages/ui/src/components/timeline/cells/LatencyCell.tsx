import type { LatencyBand } from "@ahp-viewer/core";
import type { JSX } from "react";

function fmt(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function LatencyCell({
  ms,
  band,
}: {
  ms: number | null;
  band: LatencyBand | null;
}): JSX.Element {
  return (
    <div
      data-testid="latency-cell"
      data-band={band ?? ""}
      className="latency"
      style={{
        position: "relative",
        width: 72,
        height: "var(--row-height)",
        display: "flex",
        alignItems: "center",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span>{fmt(ms)}</span>
      {band && (
        <span
          data-testid="latency-bar"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 4,
            background: `var(--latency-${band})`,
          }}
        />
      )}
    </div>
  );
}
