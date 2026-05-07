/**
 * AhpFieldStrip — renders 0–9 AhpFieldRow items for AHP-specific fields.
 *
 * Present fields come from EventRow (projected) and AhpEvent (raw).
 * Absent fields are omitted — the strip has variable row count.
 *
 * Field order follows UI-SPEC §4.3 + §7.6:
 *   session, turn, toolCall, actionType, serverSeq, origin,
 *   requestId, errorCode, notificationType
 *
 * No raw #hex literals — all stripe colors use CSS var().
 */
import type { JSX } from "react";
import type { EventRow } from "@ahp-viewer/core";
import type { AhpEvent } from "@ahp-viewer/shared";
import { AhpFieldRow } from "./AhpFieldRow.js";

const AHP_ERROR_LABELS: Record<number, string> = {
  [-32700]: "Parse error",
  [-32600]: "Invalid request",
  [-32601]: "Method not found",
  [-32602]: "Invalid params",
  [-32603]: "Internal error",
  [-32007]: "Authentication required",
};

interface AhpFieldStripProps {
  row: EventRow;
  rawEvent: AhpEvent;
}

interface FieldDef {
  label: string;
  stripeColor: string;
  value: string;
  annotation?: string | undefined;
}

function getRawParams(rawEvent: AhpEvent): Record<string, unknown> | null {
  if (rawEvent.raw && typeof rawEvent.raw === "object") {
    const r = rawEvent.raw as Record<string, unknown>;
    if (r.params && typeof r.params === "object") {
      return r.params as Record<string, unknown>;
    }
  }
  return null;
}

export function AhpFieldStrip({ row, rawEvent }: AhpFieldStripProps): JSX.Element {
  const fields: FieldDef[] = [];
  const params = getRawParams(rawEvent);

  // 1. session
  if (row.sessionId) {
    fields.push({
      label: "Session",
      stripeColor: "var(--color-info)",
      value: row.sessionId,
    });
  }

  // 2. turn
  if (row.turnId) {
    fields.push({
      label: "Turn",
      stripeColor: "var(--color-info)",
      value: row.turnId,
    });
  }

  // 3. toolCall (from raw.params?.toolCall for tool-call actions)
  const toolCall = params?.toolCall;
  if (toolCall && typeof toolCall === "object") {
    const tc = toolCall as Record<string, unknown>;
    const tcName = typeof tc.name === "string" ? tc.name : JSON.stringify(toolCall);
    fields.push({
      label: "Tool call",
      stripeColor: "var(--action-tool-call)",
      value: tcName,
    });
  }

  // 4. actionType (for non-NTF rows — NTF uses notificationType below)
  if (row.actionType && row.kindTag !== "NTF") {
    fields.push({
      label: "Action type",
      stripeColor: "var(--action-text)",
      value: row.actionType,
    });
  }

  // 5. serverSeq
  if (row.serverSeq !== null) {
    fields.push({
      label: "Server seq",
      stripeColor: "var(--color-text-muted)",
      value: String(row.serverSeq),
      ...(row.gapBefore ? { annotation: "gap before" } : {}),
    });
  }

  // 6. origin (from raw.params?.origin)
  const origin = params?.origin;
  if (typeof origin === "string" && origin) {
    fields.push({
      label: "Origin",
      stripeColor: "var(--color-text-muted)",
      value: origin,
    });
  }

  // 7. requestId (for REQ/RES rows)
  if (row.keyId && (row.kindTag === "REQ" || row.kindTag === "RES")) {
    fields.push({
      label: "Request id",
      stripeColor: "var(--kind-request)",
      value: row.keyId,
    });
  }

  // 8. errorCode
  if (row.errorCode !== null) {
    const label = AHP_ERROR_LABELS[row.errorCode];
    const valueStr = label
      ? `${row.errorCode} — ${label}`
      : String(row.errorCode);
    fields.push({
      label: "Error code",
      stripeColor: "var(--color-destructive)",
      value: valueStr,
    });
  }

  // 9. notificationType (for NTF rows)
  if (row.kindTag === "NTF" && row.actionType) {
    fields.push({
      label: "Notification type",
      stripeColor: "var(--kind-notification)",
      value: row.actionType,
    });
  }

  return (
    <div
      data-testid="ahp-field-strip"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1px",
        padding: "var(--space-2) 0",
      }}
    >
      {fields.map((f) => (
        <AhpFieldRow
          key={f.label}
          stripeColor={f.stripeColor}
          label={f.label}
          value={f.value}
          {...(f.annotation !== undefined ? { annotation: f.annotation } : {})}
        />
      ))}
    </div>
  );
}
