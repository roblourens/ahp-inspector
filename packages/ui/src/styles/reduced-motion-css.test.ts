import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/global.css", "utf8");

describe("reduced motion CSS", () => {
  it("disables hacker CRT animations when reduced motion is requested", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    const reducedBlockStart = css.indexOf("@media (prefers-reduced-motion: reduce)");
    const reducedBlock = css.slice(reducedBlockStart);
    expect(reducedBlock).toContain("[data-theme=\"hacker\"]");
    expect(reducedBlock).toContain("animation: none");
    expect(css).toContain("ahp-scanline-drift");
    expect(css).toContain("ahp-crt-pulse");
  });
});
