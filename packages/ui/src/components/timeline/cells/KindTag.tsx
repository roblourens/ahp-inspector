import type { KindTag as KindTagValue } from "@ahp-viewer/core";
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
        display: "inline-block",
        width: 44,
        textAlign: "center",
        padding: "0 4px",
        fontSize: "var(--text-ui-muted-size)",
        textTransform: "uppercase",
        background: `color-mix(in srgb, var(${v}) 20%, transparent)`,
        color: `var(${v})`,
        borderRadius: 2,
      }}
    >
      {kind}
    </span>
  );
}
