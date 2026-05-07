/**
 * DetailSummary — 2-line summary block for a selected event.
 *
 * Line 1: {tsFmt} · {direction-word} · {kindTag} · {method ?? actionType ?? "—"}
 * Line 2: Status: {status} · Latency: {latencyMs}ms or "—"
 *
 * Status coloring: ok/200 → --color-success, error → --color-destructive,
 * others → --color-text-muted.
 *
 * No raw #hex literals.
 */
import type { JSX } from "react";
import type { AhpEvent } from "@ahp-viewer/shared";
import type { Status } from "@ahp-viewer/core";

interface DetailSummaryProps {
  event: AhpEvent;
  latencyMs: number | null;
  status: Status;
}

function directionWord(dir: string): string {
  switch (dir) {
    case "c2s":
      return "Client → Server";
    case "s2c":
      return "Server → Client";
    default:
      return "Internal";
  }
}

function statusColor(status: Status): string {
  if (status === "ok") return "var(--color-success)";
  if (status === "error") return "var(--color-destructive)";
  return "var(--color-text-muted)";
}

function fmtTs(ts: number): string {
  const d = new Date(ts);
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  const ms = d.getUTCMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function kindTagFor(kind: AhpEvent["kind"]): string {
  switch (kind) {
    case "request": return "REQ";
    case "response": return "RES";
    case "client-notification":
    case "server-notification":
    case "protocol-notification":
      return "NTF";
    case "action": return "ACT";
    case "parse-error": return "BAD";
    case "log": return "LOG";
    default: return "?";
  }
}

export function DetailSummary({ event, latencyMs, status }: DetailSummaryProps): JSX.Element {
  const tsFmt = fmtTs(event.ts);
  const dirWord = directionWord(event.dir);
  const kindTag = kindTagFor(event.kind);
  const methodLabel = event.method ?? event.actionType ?? "—";

  return (
    <div data-testid="detail-summary" style={{ padding: "var(--space-2) var(--space-3)" }}>
      <div
        style={{
          fontSize: "var(--text-row-size)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-text)",
          lineHeight: "var(--text-row-line)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {tsFmt} · {dirWord} · {kindTag} · {methodLabel}
      </div>
      <div
        style={{
          fontSize: "var(--text-ui-muted-size)",
          fontFamily: "var(--font-sans)",
          color: "var(--color-text-muted)",
          lineHeight: "var(--text-row-line)",
          marginTop: "2px",
        }}
      >
        Status:{" "}
        <span style={{ color: statusColor(status) }}>{status}</span>
        {" · "}
        Latency: {latencyMs !== null ? `${latencyMs}ms` : "—"}
      </div>
    </div>
  );
}
