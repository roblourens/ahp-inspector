import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for Phase 27 — the detail-pane pretty-JSON layout fix.
 *
 * react-json-view-lite wraps each object/array's child fields in a
 * `<ul class="ahp-json-children">`. Without an explicit reset, that <ul> falls
 * back to browser defaults (40px inline padding, vertical margins, disc
 * bullets), which stacks on top of `.ahp-json-child { margin-left: var(--space-4) }`
 * and produces over-indented, gap-ridden JSON in the detail pane.
 *
 * jsdom does not compute layout, so this asserts on the CSS source: if the
 * `.ahp-json-children` reset (margin/padding/list-style) is removed, this fails.
 */

const GLOBAL_CSS = existsSync("src/styles/global.css")
  ? "src/styles/global.css"
  : "packages/ui/src/styles/global.css";

function getRuleBody(css: string, selector: string): string | null {
  const idx = css.indexOf(selector);
  if (idx === -1) return null;
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  if (open === -1 || close === -1) return null;
  return css.slice(open + 1, close);
}

describe("pretty-JSON tree indentation guard", () => {
  const css = readFileSync(GLOBAL_CSS, "utf8");

  it("defines a .ahp-json-children rule", () => {
    expect(css).toContain(".ahp-json-children");
  });

  it("resets the child-fields container so indentation comes only from .ahp-json-child", () => {
    const body = getRuleBody(css, ".ahp-json-children");
    expect(body).not.toBeNull();
    const rule = body ?? "";
    expect(rule).toMatch(/margin\s*:\s*0/);
    expect(rule).toMatch(/padding\s*:\s*0/);
    expect(rule).toMatch(/list-style\s*:\s*none/);
  });

  it("keeps the single-level indentation source on .ahp-json-child", () => {
    const body = getRuleBody(css, ".ahp-json-child ");
    expect(body).not.toBeNull();
    expect(body ?? "").toMatch(/margin-left\s*:\s*var\(--space-4\)/);
  });
});
