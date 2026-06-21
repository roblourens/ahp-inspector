import { ChevronDown } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useRef } from "react";
import type { GroupingMode } from "../../state/store.js";
import { Z } from "../../styles/zLayers.js";
import { popoverPosition } from "./popoverPosition.js";

interface GroupToggleChipProps {
  value: GroupingMode;
  isOpen: boolean;
  onChange(mode: GroupingMode): void;
  onOpenChange(isOpen: boolean): void;
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
        ...popoverPosition("--group-popover-anchor", "end"),
        zIndex: Z.popover,
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 6,
        minWidth: 160,
        boxShadow: "var(--shadow-menu)",
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-1) 0",
      }}
    >
      {MODES.map(({ mode, label }) => (
        <label
          key={mode}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-1) var(--space-3)",
            background: value === mode ? "var(--color-chip-bg-active)" : "none",
            cursor: "pointer",
            color: "var(--color-text)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <input
            type="radio"
            name="group-mode"
            value={mode}
            checked={value === mode}
            onChange={() => handleSelect(mode)}
            style={{
              accentColor: "var(--color-accent)",
              outline: "none",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.outline = "2px solid var(--color-accent)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.outline = "none";
            }}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export function GroupToggleChip({
  value,
  isOpen,
  onChange,
  onOpenChange,
}: GroupToggleChipProps): JSX.Element {
  function handleChange(mode: GroupingMode) {
    onChange(mode);
    if (mode !== "none") {
      window.scrollTo(0, 0);
    }
  }

  return (
    <div
      style={{
        position: "relative",
        flexShrink: 0,
        ...(isOpen ? { anchorName: "--group-popover-anchor" } : {}),
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => onOpenChange(!isOpen)}
        onMouseDown={(event) => event.stopPropagation()}
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
          onClose={() => onOpenChange(false)}
        />
      )}
    </div>
  );
}
