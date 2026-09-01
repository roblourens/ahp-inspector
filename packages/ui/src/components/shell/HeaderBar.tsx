import { Check, ChevronDown, Palette } from "lucide-react";
import type { JSX, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Z } from "../../styles/zLayers.js";
import {
  applyTheme,
  labelForTheme,
  persistTheme,
  THEMES,
  type ThemeId,
} from "../../theme/theme.js";
import { __APP_VERSION__ } from "../../version.js";
import { LivePauseButton } from "./LivePauseButton.js";

interface HeaderBarProps {
  version: string;
}

function readTheme(): ThemeId {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "hacker" ? attr : "dark";
}

export function HeaderBar({ version }: HeaderBarProps): JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(readTheme);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent): void {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  function closeThemeMenu(): void {
    setIsThemeMenuOpen(false);
    themeButtonRef.current?.focus();
  }

  function setTheme(next: ThemeId): void {
    applyTheme(next);
    persistTheme(next);
    setThemeState(next);
    closeThemeMenu();
  }

  function focusOption(index: number): void {
    optionRefs.current[index]?.focus();
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === "Escape") {
      event.preventDefault();
      closeThemeMenu();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption((index + 1) % THEMES.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption((index - 1 + THEMES.length) % THEMES.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(THEMES.length - 1);
    }
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
      <span style={{ fontWeight: 600 }}>AHP Inspector</span>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <LivePauseButton />
        <div ref={themeMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-label={`Theme picker (${labelForTheme(theme)})`}
            aria-haspopup="menu"
            aria-expanded={isThemeMenuOpen}
            title={`Theme: ${labelForTheme(theme)}`}
            ref={themeButtonRef}
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
                zIndex: Z.popover,
                minWidth: 148,
                padding: "var(--space-1) 0",
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 6,
                boxShadow: "var(--shadow-menu)",
              }}
            >
              {THEMES.map((option, index) => {
                const active = theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    onClick={() => setTheme(option.id)}
                    onKeyDown={(event) => handleOptionKeyDown(event, index)}
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
                      boxShadow: active ? "inset 3px 0 0 var(--color-accent)" : "none",
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
