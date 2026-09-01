import type { JSX } from "react";
import type { SafeCandidate } from "../../types/safe-candidate.js";

const ORIGIN_LABEL: Record<SafeCandidate["origin"], string> = {
  vscode: "VS Code",
  "vscode-insiders": "VS Code Insiders",
  "vscode-oss-dev": "VS Code OSS (dev)",
  manual: "Manual",
};

function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function stripJsonlExt(label: string): string {
  return label.endsWith(".jsonl") ? label.slice(0, -".jsonl".length) : label;
}

export function CandidateRow({
  candidate,
  onSelect,
  disabled = false,
}: {
  candidate: SafeCandidate;
  onSelect(): void;
  disabled?: boolean;
}): JSX.Element {
  const dotColor =
    candidate.confidence === "high"
      ? "var(--color-confidence-high)"
      : candidate.confidence === "medium"
        ? "var(--color-confidence-medium)"
        : "var(--color-confidence-low)";
  return (
    <li style={{ listStyle: "none" }}>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        title={candidate.contextLabel ?? ""}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          width: "100%",
          height: "var(--candidate-row-height)",
          padding: "0 var(--space-4)",
          background: "transparent",
          border: "none",
          color: "var(--color-text)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-row-size)",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            flex: "0 0 8px",
          }}
        />
        <span
          style={{
            width: 80,
            flex: "0 0 80px",
            textAlign: "left",
            fontSize: "var(--text-ui-muted-size)",
            color: "var(--color-text-muted)",
          }}
        >
          {relTime(candidate.mtimeMs)}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {stripJsonlExt(candidate.label)}
        </span>
        <span
          style={{
            minWidth: 80,
            textAlign: "right",
            fontSize: "var(--text-ui-muted-size)",
            color: "var(--color-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {ORIGIN_LABEL[candidate.origin]}
        </span>
        <span
          style={{
            width: 56,
            textAlign: "right",
            fontSize: "var(--text-ui-muted-size)",
            color: "var(--color-text-muted)",
          }}
        >
          {formatBytes(candidate.sizeBytes)}
        </span>
        <span aria-hidden="true" style={{ color: "var(--color-text-muted)", fontSize: 16 }}>
          ›
        </span>
      </button>
    </li>
  );
}
