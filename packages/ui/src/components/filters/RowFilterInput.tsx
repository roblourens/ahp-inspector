import { Filter, X } from "lucide-react";
import type { JSX } from "react";

interface RowFilterInputProps {
  value: string;
  onChange(value: string): void;
  onClear(): void;
}

export function RowFilterInput({ value, onChange, onClear }: RowFilterInputProps): JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        flex: "1 1 auto",
        minWidth: 200,
        maxWidth: 480,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "var(--space-2)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1)",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-ui-muted-size)",
          fontWeight: "var(--weight-semibold)",
          pointerEvents: "none",
        }}
      >
        <Filter size={16} />
        <span>Filter rows</span>
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter visible rows..."
        aria-label="Filter rows"
        style={{
          width: "100%",
          height: "var(--filter-bar-height)",
          paddingLeft: "104px",
          paddingRight: value.length > 0 ? "var(--space-6)" : "var(--space-2)",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: 6,
          color: "var(--color-text)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-row-size)",
          lineHeight: "var(--text-row-line)",
          outline: "none",
        }}
        onFocus={(event) => {
          event.currentTarget.style.outline = "2px solid var(--color-accent)";
          event.currentTarget.style.outlineOffset = "-2px";
        }}
        onBlur={(event) => {
          event.currentTarget.style.outline = "none";
        }}
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label="Clear row filter"
          onClick={onClear}
          style={{
            position: "absolute",
            right: "var(--space-2)",
            display: "flex",
            alignItems: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            padding: 0,
            borderRadius: 3,
          }}
          onFocus={(event) => {
            event.currentTarget.style.outline = "2px solid var(--color-accent)";
          }}
          onBlur={(event) => {
            event.currentTarget.style.outline = "none";
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}