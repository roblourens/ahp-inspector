import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/tokens.css", "utf8");

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
  it.each([":root,\n[data-theme=\"dark\"]", "[data-theme=\"light\"]", "[data-theme=\"hacker\"]"])(
    "%s exposes the baseline semantic tokens",
    (selector) => {
      const block = blockFor(selector);
      const missing = REQUIRED_THEME_TOKENS.filter((token) => !block.includes(`${token}:`));
      expect(missing).toEqual([]);
    },
  );
});
