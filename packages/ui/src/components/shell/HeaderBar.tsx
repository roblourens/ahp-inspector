import { Check, ChevronDown, Palette } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
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

const THEME_LABEL: Record<ThemeId, string> = {
  dark: "Dark",
  light: "Light",
  hacker: "Hacker",
};

function readTheme(): ThemeId {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "hacker" ? attr : "dark";
}

export function HeaderBar({ version }: HeaderBarProps): JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(readTheme);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent): void {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  function setTheme(next: ThemeId): void {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ahp-theme", next);
    } catch {
      // Ignore unavailable storage; the selected theme still applies for this page.
    }
    setThemeState(next);
    setIsThemeMenuOpen(false);
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
        <div ref={themeMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-label={`Theme picker (${THEME_LABEL[theme]})`}
            aria-haspopup="menu"
            aria-expanded={isThemeMenuOpen}
            title={`Theme: ${THEME_LABEL[theme]}`}
            onClick={() => setIsThemeMenuOpen((open) => !open)}
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              height: 28,
              padding: "0 var(--space-2)",
              background: isThemeMenuOpen ? "var(--color-chip-bg-active)" : "var(--color-chip-bg)",
              border: "1px solid var(--color-chip-border)",
              borderRadius: 6,
              color: "var(--color-chip-fg)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              outline: "none",
            }}
          >
            <Palette size={14} aria-hidden="true" />
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--color-accent)",
                boxShadow: "0 0 0 1px var(--color-border-strong)",
              }}
            />
            <ChevronDown
              size={12}
              aria-hidden="true"
              style={{ color: "var(--color-chip-fg-muted)" }}
            />
          </button>
          {isThemeMenuOpen && (
            <div
              role="menu"
              aria-label="Theme"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                zIndex: 1200,
                minWidth: 148,
                padding: "var(--space-1) 0",
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 6,
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              }}
            >
              {THEMES.map((option) => {
                const active = theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => setTheme(option.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-3)",
                      padding: "var(--space-1) var(--space-3)",
                      background: active ? "var(--color-chip-bg-active)" : "transparent",
                      border: "none",
                      color: active ? "var(--color-text)" : "var(--color-text-muted)",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-ui-muted-size)",
                      textAlign: "left",
                    }}
                  >
                    <span>{option.label}</span>
                    {active && <Check size={12} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <span className="mono" style={{ color: "var(--color-text-muted)" }}>
          v{version}
        </span>
      </div>
    </header>
  );
}

HeaderBar.defaultVersion = __APP_VERSION__;
