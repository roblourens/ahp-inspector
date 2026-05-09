import type { JSX } from "react";

export function ServerNotRunningState(): JSX.Element {
  return (
    <div
      data-testid="state-server-not-running"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "var(--space-2)",
        padding: "var(--space-4)",
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 600 }}>Start the viewer from the CLI</div>
      <div>
        Run <code className="mono">ahp-inspector path/to/log.jsonl</code> from your terminal, then
        refresh this page.
      </div>
    </div>
  );
}
