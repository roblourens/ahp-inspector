import type { JSX } from "react";
import { Loader2 } from "lucide-react";

interface SearchingIndicatorProps {
  candidateCount: number;
}

export function SearchingIndicator({ candidateCount }: SearchingIndicatorProps): JSX.Element {
  return (
    <div
      data-testid="searching-indicator"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        height: 40,
        paddingLeft: "var(--space-3)",
        color: "var(--color-text-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-ui-muted-size)",
      }}
    >
      <Loader2
        size={14}
        style={{
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .spin-icon { animation: none; } }
      `}</style>
      {`Searching ${candidateCount} events\u2026`}
    </div>
  );
}
