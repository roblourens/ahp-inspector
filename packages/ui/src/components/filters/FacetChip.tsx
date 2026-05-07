import { ChevronDown } from "lucide-react";
import type { JSX } from "react";

interface FacetChipProps {
  label: string;
  activeCount: number;
  isOpen: boolean;
  isDisabled: boolean;
  onClick(): void;
}

export function FacetChip({
  label,
  activeCount,
  isOpen,
  isDisabled,
  onClick,
}: FacetChipProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(event) => event.stopPropagation()}
      disabled={isDisabled}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        height: 28,
        paddingLeft: "var(--space-2)",
        paddingRight: "var(--space-2)",
        background: isOpen ? "var(--color-chip-bg-active)" : "var(--color-chip-bg)",
        border: "1px solid var(--color-chip-border)",
        borderRadius: 6,
        color: isDisabled ? "var(--color-text-disabled)" : "var(--color-chip-fg)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-ui-muted-size)",
        cursor: isDisabled ? "not-allowed" : "pointer",
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
      <span style={{ color: "var(--color-chip-fg)" }}>{label}</span>
      {activeCount > 0 && (
        <span style={{ color: "var(--color-chip-fg-muted)" }}>· {activeCount}</span>
      )}
      <ChevronDown size={12} style={{ color: "var(--color-chip-fg-muted)" }} />
    </button>
  );
}
