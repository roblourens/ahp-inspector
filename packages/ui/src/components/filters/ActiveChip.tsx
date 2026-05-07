import { X } from "lucide-react";
import type { JSX } from "react";

interface ActiveChipProps {
  label: string;
  onDismiss(): void;
  ariaLabel: string;
}

export function ActiveChip({ label, onDismiss, ariaLabel }: ActiveChipProps): JSX.Element {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        height: 22,
        paddingLeft: "var(--space-2)",
        paddingRight: "var(--space-1)",
        background: "var(--color-chip-bg-active)",
        border: "1px solid var(--color-chip-border)",
        borderRadius: 4,
        color: "var(--color-chip-fg)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-ui-muted-size)",
        whiteSpace: "nowrap",
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onDismiss}
        style={{
          display: "flex",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-chip-dismiss)",
          padding: "1px",
          borderRadius: 2,
          outline: "none",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.outline = "2px solid var(--color-accent)";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.outline = "none";
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--color-destructive)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--color-chip-dismiss)";
        }}
      >
        <X size={12} />
      </button>
    </span>
  );
}
