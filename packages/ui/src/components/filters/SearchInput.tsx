import { Search, X } from "lucide-react";
import type { JSX, RefObject } from "react";

interface SearchInputProps {
  value: string;
  onChange(q: string): void;
  onClear(): void;
  ref?: RefObject<HTMLInputElement | null>;
}

export function SearchInput({ value, onChange, onClear, ref }: SearchInputProps): JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        flex: "1 1 520px",
        minWidth: 360,
        maxWidth: 720,
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
        <Search size={16} />
        <span>Search</span>
      </span>
      <input
        type="text"
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="all JSON payloads, methods, ids, sessions..."
        aria-label="Search all events"
        style={{
          width: "100%",
          height: "var(--filter-bar-height)",
          paddingLeft: "92px",
          paddingRight: value.length > 0 ? "var(--space-6)" : "var(--space-8)",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: 6,
          color: "var(--color-text)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-row-size)",
          lineHeight: "var(--text-row-line)",
          outline: "none",
        }}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.outline = "2px solid var(--color-accent)";
          (e.target as HTMLInputElement).style.outlineOffset = "-2px";
        }}
        onBlur={(e) => {
          (e.target as HTMLInputElement).style.outline = "none";
        }}
      />
      {value.length === 0 && (
        <span
          aria-hidden="true"
          title="Press / to focus search"
          style={{
            position: "absolute",
            right: "var(--space-2)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            padding: "0 var(--space-1)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-ui-muted-size)",
            lineHeight: "16px",
            pointerEvents: "none",
          }}
        >
          /
        </span>
      )}
      {value.length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
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
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "2px solid var(--color-accent)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "none";
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
