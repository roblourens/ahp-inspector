import type { KindTag as KindTagValue } from "@ahp-inspector/core";
import type { JSX } from "react";

const VAR: Record<KindTagValue, string> = {
  REQ: "--kind-request",
  RES: "--kind-response",
  NTF: "--kind-notification",
  ACT: "--kind-action",
  BAD: "--kind-parse-error",
  LOG: "--kind-action",
};

const TITLE: Record<KindTagValue, string> = {
  REQ: "Request",
  RES: "Response",
  NTF: "Notification",
  ACT: "Action",
  BAD: "Parse error",
  LOG: "Log",
};

export function KindTag({ kind }: { kind: KindTagValue }): JSX.Element {
  const v = VAR[kind];
  return (
    <span
      data-testid="kind-tag"
      data-kind={kind}
      title={TITLE[kind]}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 16,
        boxSizing: "border-box",
        textAlign: "center",
        padding: "0 3px",
        fontSize: "11px",
        lineHeight: "16px",
        textTransform: "uppercase",
        verticalAlign: "middle",
        background: `color-mix(in srgb, var(${v}) 20%, transparent)`,
        color: `var(${v})`,
        borderRadius: 2,
      }}
    >
      {kind}
    </span>
  );
}
