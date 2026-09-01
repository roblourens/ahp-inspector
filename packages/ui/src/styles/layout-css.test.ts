import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cssPath = existsSync("src/styles/global.css")
  ? "src/styles/global.css"
  : "packages/ui/src/styles/global.css";
const css = readFileSync(cssPath, "utf8");

describe("layout CSS", () => {
  it("keeps the CRT display wrapper full-height for every theme", () => {
    expect(css).toMatch(/\.crt-display-surface\s*\{[^}]*height:\s*100%;[^}]*\}/s);
  });
});
