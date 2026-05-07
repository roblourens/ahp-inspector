import type { JSX } from "react";
import { useState } from "react";
import { __APP_VERSION__ } from "../../version.js";

interface HeaderBarProps {
  version: string;
}

const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "hacker", label: "Hacker" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

function readTheme(): ThemeId {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "hacker" ? attr : "dark";
}

export function HeaderBar({ version }: HeaderBarProps): JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(readTheme);

  function setTheme(next: ThemeId): void {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ahp-theme", next);
    } catch {
      // Ignore unavailable storage; the selected theme still applies for this page.
    }
    setThemeState(next);
  }

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
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <fieldset
          style={{
            display: "inline-flex",
            padding: 2,
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            background: "var(--color-surface-raised)",
            margin: 0,
          }}
        >
          <legend
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            Theme
          </legend>
          {THEMES.map((option) => {
            const active = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTheme(option.id)}
                style={{
                  border: "none",
                  borderRadius: 4,
                  padding: "2px var(--space-2)",
                  background: active ? "var(--color-chip-bg-active)" : "transparent",
                  color: active ? "var(--color-text)" : "var(--color-text-muted)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-ui-muted-size)",
                  fontWeight: active ? "var(--weight-semibold)" : "var(--weight-regular)",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </fieldset>
        <span className="mono" style={{ color: "var(--color-text-muted)" }}>
          v{version}
        </span>
      </div>
    </header>
  );
}

HeaderBar.defaultVersion = __APP_VERSION__;
