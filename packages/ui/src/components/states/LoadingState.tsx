import type { JSX } from "react";
import { Loader2 } from "lucide-react";

export function LoadingState({ filename }: { filename: string }): JSX.Element {
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
    </div>
  );
}
