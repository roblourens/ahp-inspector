import type { JSX } from "react";
import type { Status } from "@ahp-viewer/core";

interface Spec {
  text: string;
  color: string;
  pill?: boolean;
}

const SPEC: Record<Status, Spec> = {
  ok: { text: "2xx", color: "var(--color-success)" },
  error: { text: "ERR", color: "var(--color-destructive)" },
  pending: { text: "…", color: "var(--color-text-muted)" },
  orphan: { text: "ORPHAN", color: "var(--color-warning)", pill: true },
  unmatched: { text: "TIMEOUT", color: "var(--color-warning)", pill: true },
  "n/a": { text: "—", color: "var(--color-text-muted)" },
};

export function StatusCell({ status }: { status: Status }): JSX.Element {
  const s = SPEC[status];
  if (s.pill) {
    return (
      <span
        data-testid="status-cell"
        data-status={status}
        style={{
          display: "inline-block",
          padding: "0 4px",
          fontSize: "var(--text-ui-muted-size)",
          textTransform: "uppercase",
          color: s.color,
          background: `color-mix(in srgb, ${s.color} 20%, transparent)`,
          borderRadius: 2,
        }}
      >
        {s.text}
      </span>
    );
  }
  return (
    <span
      data-testid="status-cell"
      data-status={status}
      style={{ color: s.color }}
    >
      {s.text}
    </span>
  );
}
