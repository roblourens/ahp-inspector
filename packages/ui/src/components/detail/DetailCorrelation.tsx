/**
 * DetailCorrelation — visible request/response pairing metadata for the
 * selected detail event.
 *
 * Renders only when the detail API reports a correlated pair, so unpaired
 * details stay visually clean.
 */

import type { Status } from "@ahp-viewer/core";
import type { AhpEvent } from "@ahp-viewer/shared";
import type { JSX } from "react";

interface DetailCorrelationProps {
  currentIdx: number;
  event: AhpEvent;
  pairEvent: AhpEvent | null;
  pairIdx: number | null;
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

function eventLabel(event: AhpEvent): string {
  return event.method ?? event.actionType ?? event.kind;
}

function requestIdLabel(event: AhpEvent): string | null {
  if (event.id === null) return null;
  return `${String(event.id)} (${event.idType})`;
}

function contextBits(event: AhpEvent): string[] {
  const bits: string[] = [];
  const requestId = requestIdLabel(event);
  if (requestId) bits.push(`id ${requestId}`);
  if (event.sessionId) bits.push(`session ${event.sessionId}`);
  if (event.turnId) bits.push(`turn ${event.turnId}`);
  if (event.toolCallId) bits.push(`tool ${event.toolCallId}`);
  return bits;
}

function CorrelationEventLine({
  label,
  idx,
  event,
}: {
  label: string;
  idx: number;
  event: AhpEvent;
}): JSX.Element {
  const bits = contextBits(event);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-ui-muted-size)",
          color: "var(--color-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label} #{idx} · {event.kind} · {eventLabel(event)}
      </div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-ui-muted-size)",
          color: "var(--color-text-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {directionWord(event.dir)}
        {bits.length ? ` · ${bits.join(" · ")}` : ""}
      </div>
    </div>
  );
}

export function DetailCorrelation({
  currentIdx,
  event,
  pairEvent,
  pairIdx,
  latencyMs,
  status,
}: DetailCorrelationProps): JSX.Element | null {
  if (!pairEvent || pairIdx === null) return null;

  return (
    <section
      aria-label="Correlation"
      data-testid="detail-correlation"
      style={{
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
        padding: "var(--space-2) var(--space-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--space-2)",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-ui-muted-size)",
        }}
      >
        <strong
          style={{
            color: "var(--color-text)",
            fontWeight: "var(--weight-semibold)",
          }}
        >
          Correlation
        </strong>
        <span>
          pair idx #{pairIdx} · status {status} · latency{" "}
          {latencyMs !== null ? `${latencyMs}ms` : "—"}
        </span>
      </div>
      <CorrelationEventLine label="This event" idx={currentIdx} event={event} />
      <CorrelationEventLine label="Pair" idx={pairIdx} event={pairEvent} />
    </section>
  );
}
