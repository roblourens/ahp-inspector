import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";

interface TimeRangePopoverProps {
  from: number | null;
  to: number | null;
  onApply(from: number | null, to: number | null): void;
  onClose(): void;
}

function tsToDatetimeLocal(ts: number | null): string {
  if (ts === null) return "";
  const d = new Date(ts);
  // format: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToTs(s: string): number | null {
  if (!s) return null;
  const ms = new Date(s).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function TimeRangePopover({
  from,
  to,
  onApply,
  onClose,
}: TimeRangePopoverProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [fromVal, setFromVal] = useState(tsToDatetimeLocal(from));
  const [toVal, setToVal] = useState(tsToDatetimeLocal(to));

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  function handleApply() {
    onApply(datetimeLocalToTs(fromVal), datetimeLocalToTs(toVal));
    onClose();
  }

  function handleClear() {
    setFromVal("");
    setToVal("");
    onApply(null, null);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 4,
    color: "var(--color-text)",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-ui-muted-size)",
    padding: "var(--space-1) var(--space-2)",
    outline: "none",
    colorScheme: "dark",
  };

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        zIndex: 200,
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 6,
        minWidth: 240,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-3)",
      }}
    >
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-ui-muted-size)",
        }}
      >
        From
        <input
          type="datetime-local"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.outline = "2px solid var(--color-accent)";
            (e.target as HTMLInputElement).style.outlineOffset = "-2px";
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.outline = "none";
          }}
        />
      </label>
      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-ui-muted-size)",
        }}
      >
        To
        <input
          type="datetime-local"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.outline = "2px solid var(--color-accent)";
            (e.target as HTMLInputElement).style.outlineOffset = "-2px";
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.outline = "none";
          }}
        />
      </label>
      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleClear}
          style={{
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
            padding: "var(--space-1) var(--space-2)",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "2px solid var(--color-accent)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "none";
          }}
        >
          Clear selection
        </button>
        <button
          type="button"
          onClick={handleApply}
          style={{
            background: "var(--color-accent)",
            border: "none",
            borderRadius: 4,
            color: "var(--color-accent-foreground)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
            fontWeight: "var(--weight-semibold)",
            padding: "var(--space-1) var(--space-2)",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "2px solid var(--color-accent)";
            (e.currentTarget as HTMLButtonElement).style.outlineOffset = "2px";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "none";
          }}
        >
          Apply range
        </button>
      </div>
    </div>
  );
}
