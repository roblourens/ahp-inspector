import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENTS_DIR = new URL("../components/", import.meta.url).pathname;

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walk(full));
    } else if (s.isFile()) {
      if (full.endsWith(".tsx") && !full.endsWith(".test.tsx")) out.push(full);
    }
  }
  return out;
}

// Matches color literals embedded in string/JSX-attribute quotes only.
// Allows JSX text like "selected #5" because that has no surrounding quotes.
const HEX_LITERAL = /["']#[0-9a-fA-F]{3,8}["']/;

describe("components/** must not contain hex color literals", () => {
  it("rejects raw #RRGGBB / #RGB literals in component sources", () => {
    const files = walk(COMPONENTS_DIR);
    const violations: { file: string; line: number; text: string }[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (HEX_LITERAL.test(line)) {
          violations.push({ file, line: i + 1, text: line.trim() });
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
