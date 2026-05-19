import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cssPath = existsSync("src/styles/global.css")
  ? "src/styles/global.css"
  : "packages/ui/src/styles/global.css";
const css = readFileSync(cssPath, "utf8");

describe("reduced motion CSS", () => {
  it("disables hacker CRT animations when reduced motion is requested", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    const reducedBlockStart = css.indexOf("@media (prefers-reduced-motion: reduce)");
    const reducedBlock = css.slice(reducedBlockStart);
    expect(reducedBlock).toContain('[data-theme="hacker"]');
    expect(reducedBlock).toContain("animation: none");
    expect(reducedBlock).toContain("transition: none");
    expect(reducedBlock).toContain('[data-theme="hacker"] .crt-display-surface');
    expect(reducedBlock).toContain('[data-theme="hacker"] .crt-display-surface::before');
    expect(reducedBlock).toContain('[data-theme="hacker"] .crt-display-surface::after');
    expect(css).toContain("ahp-scanline-drift");
    expect(css).toContain("ahp-crt-surface-drift");
    expect(css).toContain("ahp-crt-signal-beat");
    expect(css).toContain("ahp-crt-fringe-jitter");
  });
});
