import type { JSX } from "react";
import { __APP_VERSION__ } from "../../version.js";

interface HeaderBarProps {
  version: string;
}

export function HeaderBar({ version }: HeaderBarProps): JSX.Element {
  return (
    <header
      style={{
        height: 40,
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-3)",
        flex: "0 0 auto",
      }}
      data-testid="header-bar"
    >
      <span style={{ fontWeight: 600 }}>AHP Log Viewer</span>
      <span className="mono" style={{ color: "var(--color-text-muted)" }}>
        v{version}
      </span>
    </header>
  );
}

HeaderBar.defaultVersion = __APP_VERSION__;
