import type { JSX } from "react";

export function NoCandidatesHint(): JSX.Element {
  return (
    <div
      role="status"
      style={{
        padding: "var(--space-5)",
        background: "var(--color-surface)",
        border: "1px dashed var(--color-border)",
        borderRadius: 6,
        color: "var(--color-text-muted)",
        fontSize: "var(--text-body-size)",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "var(--color-text)",
          marginBottom: "var(--space-2)",
        }}
      >
        No logs discovered
      </div>
      <p style={{ margin: 0 }}>
        AHP logs are created when VS Code and the Copilot extension generate protocol traffic. Check
        that VS Code is installed and has been used recently.
      </p>
    </div>
  );
}
