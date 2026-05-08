import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative, join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = new URL("../", import.meta.url).pathname;
const ALLOWED_DIR_PARTS = ["/styles/"];

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
      if ((full.endsWith(".ts") || full.endsWith(".tsx")) && !full.endsWith(".test.ts") && !full.endsWith(".test.tsx")) {
        out.push(full);
      }
    }
  }
  return out;
}

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "hex", re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "rgb", re: /rgba?\([^)]*\)/i },
  { name: "hsl", re: /hsla?\([^)]*\)/i },
];

function isAllowed(file: string): boolean {
  const normalized = file.replaceAll("\\", "/");
  return ALLOWED_DIR_PARTS.some((part) => normalized.includes(part));
}

describe("component and UI source color guard", () => {
  it("rejects raw hex/rgb/hsl color literals outside tokenized styles", () => {
    const violations: { file: string; line: number; pattern: string; text: string }[] = [];
    for (const file of walk(SRC_DIR)) {
      if (isAllowed(file)) continue;
      const text = readFileSync(file, "utf8");
      text.split("\n").forEach((line, i) => {
        for (const pattern of PATTERNS) {
          if (pattern.re.test(line)) {
            violations.push({
              file: relative(process.cwd(), file),
              line: i + 1,
              pattern: pattern.name,
              text: line.trim(),
            });
          }
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
