import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const fixtureDir = resolve(root, "../test-cases/reducers");
const transportKeys = ["jsonrpc", "method", "params", "timestamp"] as const;

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

describe("reducer fixture privacy", () => {
  const files = walk(fixtureDir);

  it("contains only JSON reducer fixtures", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file.endsWith(".json")).toBe(true);
      expect(file.endsWith(".jsonl")).toBe(false);
      expect(file.endsWith(".log")).toBe(false);
      expect(file.endsWith(".txt")).toBe(false);
      expect(statSync(file).isFile()).toBe(true);
    }
  });

  it("uses synthetic reducer fixture shape without top-level transport keys", () => {
    for (const file of files) {
      const fixture = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;

      expect(fixture).toHaveProperty("description");
      expect(fixture).toHaveProperty("reducer");
      expect(fixture).toHaveProperty("initial");
      expect(fixture).toHaveProperty("actions");
      expect(fixture).toHaveProperty("expected");

      for (const key of transportKeys) {
        expect(Object.hasOwn(fixture, key)).toBe(false);
      }
    }
  });
});
