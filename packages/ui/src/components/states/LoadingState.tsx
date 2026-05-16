import { Loader2 } from "lucide-react";
import type { JSX } from "react";
import type { LoadProgress } from "../../state/store.js";

export function LoadingState({
  filename,
  progress,
}: {
  filename: string;
  progress?: LoadProgress;
}): JSX.Element {
  return (
    <div
      data-testid="state-loading"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: "var(--space-2)",
      }}
    >
      <Loader2 className="spin" color="var(--color-text-muted)" size={24} />
      <div style={{ fontWeight: 600 }}>Loading log…</div>
      <div>
        Reading <span className="mono">{filename}</span>
      </div>
      {progress?.percent !== undefined ? (
        <div>{progress.percent}% loaded</div>
      ) : progress && (progress.loadedRows > 0 || progress.loadedBytes > 0) ? (
        <div>{progress.loadedRows.toLocaleString()} rows loaded</div>
      ) : null}
    </div>
  );
}
