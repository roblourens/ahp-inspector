/**
 * CopyMenu — dropdown button with three copy actions.
 *
 * T-03-04-03: Copy is explicit user action only.
 * Uses navigator.clipboard.writeText with textarea execCommand fallback.
 * PrivacyCaption discloses that raw payload may contain tokens/prompts/paths.
 *
 * No raw #hex literals. No dangerouslySetInnerHTML.
 */

import type { Status } from "@ahp-inspector/core";
import type { AhpEvent } from "@ahp-inspector/shared";
import { ChevronDown } from "lucide-react";
import { type JSX, useEffect, useRef, useState } from "react";
import { copyText } from "./clipboard.js";

interface CopyMenuProps {
  event: AhpEvent;
  pairEvent: AhpEvent | null;
  pairIdx: number | null;
  latencyMs: number | null;
  status: Status;
  onCopy(msg: string, ok: boolean): void;
}

function directionWord(dir: string): string {
  switch (dir) {
    case "c2s":
      return "Client→Server";
    case "s2c":
      return "Server→Client";
    default:
      return "Internal";
  }
}

function fmtTs(ts: number): string {
  const d = new Date(ts);
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  const ms = d.getUTCMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function eventLabel(event: AhpEvent): string {
  return event.method ?? event.actionType ?? event.kind;
}

function idLabel(event: AhpEvent): string | null {
  if (event.id === null) return null;
  return `${String(event.id)} (${event.idType})`;
}

function appendEventContext(prefix: string, event: AhpEvent): string {
  let out = `${prefix}=${directionWord(event.dir)} ${event.kind} ${eventLabel(event)}`;
  const id = idLabel(event);
  if (id) out += ` id=${id}`;
  if (event.sessionId) out += ` session=${event.sessionId}`;
  if (event.turnId) out += ` turn=${event.turnId}`;
  if (event.toolCallId) out += ` tool=${event.toolCallId}`;
  return `${out}\n`;
}

function buildSummary(
  event: AhpEvent,
  pairEvent: AhpEvent | null,
  pairIdx: number | null,
  latencyMs: number | null,
  status: Status,
): string {
  const ts = fmtTs(event.ts);
  const dir = directionWord(event.dir);
  const method = event.method ?? event.actionType ?? "—";
  let summary = `${ts} ${dir} ${event.kind} ${method}\nstatus=${status} latency=${latencyMs !== null ? `${latencyMs}ms` : "—"}\n`;

  if (event.sessionId) summary += `session=${event.sessionId}\n`;
  if (event.turnId) summary += `turn=${event.turnId}\n`;
  if (event.serverSeq !== null) summary += `serverSeq=${event.serverSeq}\n`;
  if (pairEvent) {
    summary += `correlation=paired`;
    if (pairIdx !== null) summary += ` pairIdx=${pairIdx}`;
    summary += ` status=${status} latency=${latencyMs !== null ? `${latencyMs}ms` : "—"}\n`;
    summary += appendEventContext("current", event);
    summary += appendEventContext("pair", pairEvent);
  }

  return summary;
}

export function CopyMenu({
  event,
  pairEvent,
  pairIdx,
  latencyMs,
  status,
  onCopy,
}: CopyMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click-outside.
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleCopy(getContent: () => string) {
    setOpen(false);
    const text = getContent();
    try {
      await copyText(text);
      onCopy(`Copied ${text.length} chars`, true);
    } catch {
      onCopy("Copy failed. Select and copy manually.", false);
    }
  }

  const menuItems = [
    {
      label: "Copy raw JSON",
      action: () => {
        try {
          return JSON.stringify(event.raw);
        } catch {
          return "[Circular or non-serializable value]";
        }
      },
    },
    {
      label: "Copy pretty JSON",
      action: () => {
        try {
          return JSON.stringify(event.raw, null, 2);
        } catch {
          return "[Circular or non-serializable value]";
        }
      },
    },
    {
      label: "Copy summary",
      action: () => buildSummary(event, pairEvent, pairIdx, latencyMs, status),
    },
  ];

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1)",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "4px",
          color: "var(--color-text)",
          cursor: "pointer",
          fontSize: "var(--text-ui-muted-size)",
          fontFamily: "var(--font-sans)",
          padding: "var(--space-1) var(--space-2)",
        }}
      >
        Copy <ChevronDown size={12} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + var(--space-1))",
            right: 0,
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "4px",
            minWidth: "180px",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              onClick={() => handleCopy(item.action)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                color: "var(--color-text)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-ui-muted-size)",
                padding: "var(--space-2) var(--space-3)",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
