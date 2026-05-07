/**
 * DetailTabs — tablist for Pretty / Raw JSON views.
 *
 * Keyboard: Left/Right arrows navigate; Enter/Space activate.
 * Active tab: 2px --color-accent bottom border, weight 600.
 *
 * No raw #hex literals.
 */
import type { JSX, KeyboardEvent } from "react";

type Tab = "pretty" | "raw";

interface DetailTabsProps {
  active: Tab;
  onChange(tab: Tab): void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "pretty", label: "Pretty" },
  { id: "raw", label: "Raw" },
];

export function DetailTabs({ active, onChange }: DetailTabsProps): JSX.Element {
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number): void {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = e.key === "ArrowRight" ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
      const tab = TABS[next];
      if (tab) onChange(tab.id);
    }
  }

  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "0 var(--space-3)",
        borderBottom: "1px solid var(--color-border)",
        height: "var(--filter-bar-height)",
      }}
    >
      {TABS.map((tab, idx) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            type="button"
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            style={{
              background: "none",
              border: "none",
              borderBottom: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
              color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-ui-size)",
              fontWeight: isActive ? "var(--weight-semibold)" : "var(--weight-regular)",
              padding: "var(--space-2) var(--space-2)",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
