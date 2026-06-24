import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cssPath = existsSync("src/styles/tokens.css")
  ? "src/styles/tokens.css"
  : "packages/ui/src/styles/tokens.css";
const css = readFileSync(cssPath, "utf8");

export const REQUIRED_THEME_TOKENS = [
  "--color-bg",
  "--color-surface",
  "--color-surface-raised",
  "--color-border",
  "--color-border-strong",
  "--color-accent",
  "--color-text",
  "--color-text-muted",
  "--color-text-subtle",
  "--color-text-disabled",
  "--color-event-name-prefix",
  "--color-success",
  "--color-warning",
  "--color-destructive",
  "--color-info",
  "--dir-c2s",
  "--dir-s2c",
  "--dir-internal",
  "--kind-request",
  "--kind-response",
  "--kind-notification",
  "--kind-action",
  "--kind-error",
  "--kind-parse-error",
  "--action-text",
  "--action-tool-call",
  "--action-tool-result",
  "--action-status",
  "--action-unknown",
  "--latency-fast",
  "--latency-normal",
  "--latency-slow",
  "--latency-critical",
  "--color-search-match-bg",
  "--color-search-match-fg",
  "--color-chip-bg",
  "--color-chip-bg-active",
  "--color-chip-border",
  "--color-chip-fg",
  "--color-chip-fg-muted",
  "--color-chip-dismiss",
  "--color-json-bg",
  "--color-json-key",
  "--color-json-string",
  "--color-json-number",
  "--color-json-boolean",
  "--color-json-null",
  "--color-json-punctuation",
  "--shadow-menu",
  "--shadow-panel",
  "--shadow-drawer",
  "--focus-ring",
  "--row-selected-bg",
  "--row-hover-bg",
  "--overlay-backdrop",
  "--drawer-border",
  "--effect-scanline-opacity",
  "--effect-grid-opacity",
  "--effect-noise-opacity",
  "--effect-glow",
  "--effect-glow-strong",
  "--effect-crt-glass-opacity",
  "--effect-crt-frame-opacity",
  "--effect-crt-fringe-opacity",
  "--effect-crt-fringe-spread",
  "--effect-crt-vignette-stop",
  "--effect-crt-signal-jitter",
  "--effect-crt-glitch-boost",
  "--selection-bg",
  "--selection-fg",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function blockFor(selector: string): string {
  const escaped = escapeRegExp(selector);
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  if (!match?.[1]) throw new Error(`Missing theme block: ${selector}`);
  return match[1];
}

describe("theme token blocks", () => {
  it.each([
    ':root,\n[data-theme="dark"]',
    '[data-theme="light"]',
    '[data-theme="hacker"]',
  ])("%s exposes the baseline semantic tokens", (selector) => {
    const block = blockFor(selector);
    const missing = REQUIRED_THEME_TOKENS.filter((token) => !block.includes(`${token}:`));
    expect(missing).toEqual([]);
  });
});

describe("hacker CRT effect tokens", () => {
  it("pins the Phase 23 aggressive Hacker CRT tuning values", () => {
    const block = blockFor('[data-theme="hacker"]');
    const valueFor = (token: string): number => {
      const match = block.match(new RegExp(`${token}:\\s*([0-9.]+)`));
      return Number(match?.[1] ?? Number.NaN);
    };
    expect(valueFor("--effect-scanline-opacity")).toBe(0.22);
    expect(valueFor("--effect-grid-opacity")).toBe(0.12);
    expect(valueFor("--effect-noise-opacity")).toBe(0.085);
    expect(valueFor("--effect-crt-glass-opacity")).toBe(0.72);
    expect(valueFor("--effect-crt-frame-opacity")).toBe(0.94);
    expect(valueFor("--effect-crt-fringe-opacity")).toBe(0.34);
    expect(valueFor("--effect-crt-fringe-spread")).toBe(18);
    expect(valueFor("--effect-crt-vignette-stop")).toBe(64);
    expect(valueFor("--effect-crt-signal-jitter")).toBe(1.5);
    expect(valueFor("--effect-crt-glitch-boost")).toBe(1.08);
  });

  it.each([
    ':root,\n[data-theme="dark"]',
    '[data-theme="light"]',
  ])("%s keeps CRT frame and glitch tokens neutral", (selector) => {
    const block = blockFor(selector);
    expect(block).toContain("--effect-crt-frame-opacity: 0;");
    expect(block).toContain("--effect-crt-glitch-boost: 1;");
  });
});
