// NOTE: lucide-react@1.14.0 does not export `FileJson`; using `FileBraces`
// (JSON-style braces icon) is the closest semantic match. Tracked in SUMMARY
// as a Rule 3 deviation.
import { FileBraces } from "lucide-react";
import type { JSX } from "react";

interface SourceStripProps {
  filename: string | null;
  eventCount: number;
  sessionCount: number;
}

export function SourceStrip({ filename, eventCount, sessionCount }: SourceStripProps): JSX.Element {
  return (
    <div
      style={{
        height: 32,
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "0 var(--space-3)",
        fontSize: "var(--text-ui-size)",
        flex: "0 0 auto",
      }}
      data-testid="source-strip"
    >
      {filename === null ? (
        <span style={{ color: "var(--color-text-muted)" }}>No file open</span>
      ) : (
        <>
          <FileBraces size={14} aria-hidden />
          <span className="mono">{filename}</span>
          <span style={{ color: "var(--color-text-muted)" }}>
            {" · "}
            {eventCount} events
            {eventCount > 0 && sessionCount > 0 ? ` · ${sessionCount} sessions` : ""}
          </span>
        </>
      )}
    </div>
  );
}
