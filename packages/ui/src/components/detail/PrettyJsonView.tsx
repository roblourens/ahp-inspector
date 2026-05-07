/**
 * PrettyJsonView — renders a collapsible JSON tree via react-json-view-lite.
 *
 * T-03-04-02: If JSON.stringify(data).length > 256KB, show TruncationBanner
 * instead of the tree. Raw view is still available.
 *
 * No raw #hex literals — token colors come from CSS variables.
 * react-json-view-lite uses text-only rendering, no eval (verified 03-RESEARCH).
 */
import type { JSX } from "react";
import { JsonView, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { TruncationBanner } from "./TruncationBanner.js";

const CLIENT_CAP_BYTES = 256 * 1024; // 256KB

interface PrettyJsonViewProps {
  data: unknown;
  query?: string;
  capBytes?: number;
  onOpenRaw?(): void;
}

export function PrettyJsonView({
  data,
  capBytes = CLIENT_CAP_BYTES,
  onOpenRaw,
}: PrettyJsonViewProps): JSX.Element {
  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch {
    serialized = "[Circular or non-serializable value]";
  }

  if (serialized.length > capBytes) {
    return (
      <TruncationBanner
        kind="client-cap"
        bytes={serialized.length}
        {...(onOpenRaw !== undefined ? { onOpenRaw } : {})}
      />
    );
  }

  return (
    <div
      data-testid="pretty-json-view"
      className="ahp-json-view"
      style={{
        padding: "var(--space-2) var(--space-3)",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-ui-muted-size)",
        color: "var(--color-text)",
        flex: 1,
      }}
    >
      <JsonView
        data={data as object}
        shouldExpandNode={(level: number) => level < 2}
        style={defaultStyles}
      />
    </div>
  );
}
