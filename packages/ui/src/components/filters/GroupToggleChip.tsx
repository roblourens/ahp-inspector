import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { GroupingMode } from "../../state/store.js";

interface GroupToggleChipProps {
  value: GroupingMode;
  onChange(mode: GroupingMode): void;
}

const MODES: { mode: GroupingMode; label: string }[] = [
  { mode: "none", label: "None" },
  { mode: "session", label: "Session" },
  { mode: "session+turn", label: "Session + Turn" },
];

const modeLabel: Record<GroupingMode, string> = {
  none: "None",
  session: "Session",
  "session+turn": "Session + Turn",
};

interface GroupTogglePopoverProps {
  value: GroupingMode;
  onChange(mode: GroupingMode): void;
  onClose(): void;
}

function GroupTogglePopover({ value, onChange, onClose }: GroupTogglePopoverProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  function handleSelect(mode: GroupingMode) {
    onChange(mode);
    onClose();
  }

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        right: 0,
        zIndex: 200,
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 6,
        minWidth: 160,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-1) 0",
      }}
    >
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          onClick={() => handleSelect(mode)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-1) var(--space-3)",
            background: value === mode ? "var(--color-chip-bg-active)" : "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
            textAlign: "left",
            outline: "none",
            width: "100%",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "2px solid var(--color-accent)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "none";
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: value === mode
                ? "2px solid var(--color-accent)"
                : "2px solid var(--color-border-strong)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {value === mode && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--color-accent)",
                  display: "block",
                }}
              />
            )}
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}

export function GroupToggleChip({ value, onChange }: GroupToggleChipProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  function handleChange(mode: GroupingMode) {
    onChange(mode);
    if (mode !== "none") {
      window.scrollTo(0, 0);
    }
  }

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((o) => !o)}
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
          color: "var(--color-chip-fg)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-ui-muted-size)",
          cursor: "pointer",
          outline: "none",
          whiteSpace: "nowrap",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.outline = "2px solid var(--color-accent)";
          (e.currentTarget as HTMLButtonElement).style.outlineOffset = "2px";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.outline = "none";
        }}
      >
        <span>Group: {modeLabel[value]}</span>
        <ChevronDown size={12} style={{ color: "var(--color-chip-fg-muted)" }} />
      </button>
      {isOpen && (
        <GroupTogglePopover
          value={value}
          onChange={handleChange}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
