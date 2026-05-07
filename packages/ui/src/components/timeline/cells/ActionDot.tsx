import type { JSX } from "react";
import type { ActionFamily } from "@ahp-viewer/core";

const VAR: Record<NonNullable<ActionFamily>, string> = {
  text: "--action-text",
  "tool-call": "--action-tool-call",
  "tool-result": "--action-tool-result",
  status: "--action-status",
  unknown: "--action-unknown",
};

export function ActionDot({
  family,
}: {
  family: ActionFamily | null;
}): JSX.Element | null {
  if (family == null) return null;
  return (
    <span
      data-testid="action-dot"
      data-family={family}
      title={`Action family: ${family}`}
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
