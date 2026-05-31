import { Search } from "lucide-react";
import type { JSX } from "react";

interface SearchTriggerProps {
  isActive: boolean;
  onClick(): void;
}

export function SearchTrigger({ isActive, onClick }: SearchTriggerProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label="Open search"
      title="Press / to open search"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-1)",
        height: 28,
        paddingLeft: "var(--space-2)",
        paddingRight: "var(--space-2)",
        background: isActive ? "var(--color-chip-bg-active)" : "var(--color-chip-bg)",
        border: isActive
          ? "1px solid var(--color-accent)"
          : "1px solid var(--color-chip-border)",
        borderRadius: 4,
        color: "var(--color-chip-fg)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-ui-muted-size)",
        fontWeight: "var(--weight-semibold)",
        cursor: "pointer",
        outline: "none",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLButtonElement).style.outline = "2px solid var(--color-accent)";
        (e.currentTarget as HTMLButtonElement).style.outlineOffset = "2px";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLButtonElement).style.outline = "none";
      }}
    >
      <Search size={16} />
      <span>Search</span>
    </button>
  );
}
