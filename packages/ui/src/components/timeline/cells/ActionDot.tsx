import type { ActionFamily } from "@ahp-viewer/core";
import type { JSX } from "react";

const VAR: Record<NonNullable<ActionFamily>, string> = {
  text: "--action-text",
  "tool-call": "--action-tool-call",
  "tool-result": "--action-tool-result",
  status: "--action-status",
  unknown: "--action-unknown",
};

const LABEL: Partial<Record<NonNullable<ActionFamily>, string>> = {
  text: "Text action",
  "tool-call": "Tool call",
  "tool-result": "Tool result",
  status: "Status action",
};

export function ActionDot({ family }: { family: ActionFamily | null }): JSX.Element | null {
  if (family == null || family === "unknown") return null;
  const label = LABEL[family];
  if (!label) return null;
  return (
    <span
      data-testid="action-dot"
      data-family={family}
      role="img"
      aria-label={label}
      title={label}
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: `var(${VAR[family]})`,
      }}
    />
  );
}
