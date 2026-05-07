import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";

const MAX_VISIBLE = 100;

interface FacetOption {
  value: string;
  label: string;
  count: number;
}

interface FacetPopoverProps {
  options: FacetOption[];
  selected: string[];
  onChange(values: string[]): void;
  onClose(): void;
  searchable?: boolean;
}

export function FacetPopover({
  options,
  selected,
  onChange,
  onClose,
  searchable,
}: FacetPopoverProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  // Close on click-outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;
  const visible = filtered.slice(0, MAX_VISIBLE);
  const overflow = filtered.length - visible.length;

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div
      ref={ref}
      role="listbox"
      aria-multiselectable="true"
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        zIndex: 200,
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 6,
        minWidth: 180,
        maxWidth: 320,
        maxHeight: 320,
        overflowY: "auto",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {searchable && (
        <div style={{ padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            autoFocus
            style={{
              width: "100%",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              color: "var(--color-text)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-ui-muted-size)",
              padding: "var(--space-1) var(--space-2)",
              outline: "none",
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.outline =
                "2px solid var(--color-accent)";
              (e.target as HTMLInputElement).style.outlineOffset = "-2px";
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.outline = "none";
            }}
          />
        </div>
      )}
      {visible.length === 0 && (
        <div
          style={{
            padding: "var(--space-3)",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
          }}
        >
          No options
        </div>
      )}
      {visible.map((opt) => (
        <label
          key={opt.value}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-1) var(--space-3)",
            cursor: "pointer",
            color: "var(--color-text)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
          }}
        >
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            style={{ accentColor: "var(--color-accent)" }}
          />
          <span style={{ flex: 1 }}>{opt.label}</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-ui-muted-size)" }}>
            {opt.count}
          </span>
        </label>
      ))}
      {overflow > 0 && (
        <div
          style={{
            padding: "var(--space-1) var(--space-3)",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          …and {overflow} more
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "var(--space-1) var(--space-2)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <button
          type="button"
          onClick={() => onChange([])}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
            padding: "var(--space-1)",
            borderRadius: 3,
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline =
              "2px solid var(--color-accent)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "none";
          }}
        >
          Clear selection
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
            padding: "var(--space-1)",
            borderRadius: 3,
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline =
              "2px solid var(--color-accent)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "none";
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
