import { Search, X } from "lucide-react";
import type { JSX } from "react";

interface SearchInputProps {
  value: string;
  onChange(q: string): void;
  onClear(): void;
}

export function SearchInput({ value, onChange, onClear }: SearchInputProps): JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        flex: 1,
        minWidth: 280,
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
          color: "var(--color-text-muted)",
          pointerEvents: "none",
        }}
      >
        <Search size={16} />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search method, id, session, payload…"
        aria-label="Search events"
        style={{
          width: "100%",
          height: "var(--filter-bar-height)",
          paddingLeft: "var(--space-6)",
          paddingRight: value.length > 0 ? "var(--space-6)" : "var(--space-2)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
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
