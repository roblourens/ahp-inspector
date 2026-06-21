import { type JSX, useEffect, useRef } from "react";
import { Z } from "../../styles/zLayers.js";
import type { SafeCandidate } from "../../types/safe-candidate.js";
import { CandidateList } from "./CandidateList.js";
import { ManualOpenInput } from "./ManualOpenInput.js";

export function LogPickerPanel({
  open,
  candidates,
  isLoading,
  onSelect,
  onOpenPath,
  onRefresh,
  onClose,
}: {
  open: boolean;
  candidates: readonly SafeCandidate[];
  isLoading: boolean;
  onSelect(id: string): void;
  onOpenPath(path: string): Promise<void>;
  onRefresh(): void;
  onClose(): void;
}): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Move focus into the panel.
    const first = panelRef.current?.querySelector<HTMLElement>(
      'ul[aria-label="Discovered logs"] button',
    );
    if (first) first.focus();
    else panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Switch log"
      style={{
        position: "fixed",
        // Drop below the 40px HeaderBar; the FilterBar (Z.controls) sits below
        // it in the document, so the picker must outrank both the FilterBar and
        // the HeaderBar (Z.picker > Z.header) to fully cover the search row
        // underneath. Otherwise the FilterBar's search input paints on top.
        top: 40,
        left: 0,
        right: 0,
        maxHeight: "calc(100vh - 40px)",
        overflowY: "auto",
        zIndex: Z.picker,
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border-strong)",
        boxShadow: "var(--shadow-menu)",
        padding: "var(--space-4)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-4)",
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-heading-size)",
            fontWeight: 600,
            color: "var(--color-text)",
          }}
        >
          Switch log
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              height: 28,
              padding: "0 var(--space-3)",
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              color: "var(--color-text)",
              cursor: "pointer",
              fontSize: "var(--text-ui-muted-size)",
            }}
          >
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              height: 28,
              padding: "0 var(--space-3)",
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: 4,
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <CandidateList candidates={candidates} onSelect={onSelect} />
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            paddingTop: "var(--space-3)",
          }}
        >
          <ManualOpenInput onOpen={onOpenPath} />
        </div>
      </div>
    </div>
  );
}
