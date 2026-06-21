// zLayers.test.ts — guards that the TS z-index constants stay in sync with the
// canonical --z-* custom properties in tokens.css (Plan 32-05).

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Z, Z_CSS_VAR } from "./zLayers.js";

const cssPath = existsSync("src/styles/tokens.css")
  ? "src/styles/tokens.css"
  : "packages/ui/src/styles/tokens.css";
const css = readFileSync(cssPath, "utf8");

function cssValueFor(varName: string): number {
  const match = css.match(new RegExp(`${varName.replace(/[-]/g, "\\-")}:\\s*(\\d+)\\b`));
  return Number(match?.[1] ?? Number.NaN);
}

describe("z-index layer scale", () => {
  it("every TS Z constant matches its tokens.css --z-* value", () => {
    for (const key of Object.keys(Z) as Array<keyof typeof Z>) {
      expect(cssValueFor(Z_CSS_VAR[key])).toBe(Z[key]);
    }
  });

  it("orders decorative CRT overlay below all interactive chrome", () => {
    expect(Z.crtOverlay).toBeLessThan(Z.sticky);
    expect(Z.crtOverlay).toBeLessThan(Z.controls);
    expect(Z.crtOverlay).toBeLessThan(Z.header);
    expect(Z.crtOverlay).toBeLessThan(Z.dialog);
  });

  it("orders the log picker above the header and dialogs above the drawer", () => {
    expect(Z.picker).toBeGreaterThan(Z.header);
    expect(Z.dialog).toBeGreaterThan(Z.drawer);
    expect(Z.drawer).toBeGreaterThan(Z.drawerBackdrop);
  });
});
