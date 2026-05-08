// Fixture scrubber: every committed fixture under test/fixtures/** must be
// synthetic. Mitigates T-01-01 (information disclosure via committed samples).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildFixtures, generateAll } from "./fixtures/generate.js";

// Ensure fixtures exist BEFORE test collection scans the directory, so per-file
// `it(...)` tests are registered for every fixture.
generateAll();

const FORBIDDEN: Array<[string, RegExp]> = [
  ["bearer-token", /Bearer\s+\S+/],
  ["authorization-header", /Authorization\s*[:=]/i],
  ["openai-key", /sk-[A-Za-z0-9]{20,}/],
  ["github-pat", /ghp_[A-Za-z0-9]{20,}/],
  ["jwt", /eyJ[A-Za-z0-9_-]{20,}\./],
  ["private-mac-path", /\/Users\//],
  ["private-linux-path", /\/home\//],
  ["private-windows-path", /[A-Za-z]:\\/],
  ["password", /password\s*[:=]\s*\S+/i],
  ["api-key", /api[_-]?key\s*[:=]\s*\S+/i],
  ["token-like-key", /\b(?:token|secret|cookie)\b\s*[:=]\s*\S+/i],
  ["email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ["real-log-host", /\b(?:ssh-macbook-air|macbook-air|roblou)\b/i],
  [
    "prompt-output-sentinel",
    /\b(?:prompt|completion|model output|assistant output|user message)\b/i,
  ],
];

function listFixtures(): string[] {
  const root = resolve("test/fixtures");
  const out: string[] = [];
  if (!statSync(root).isDirectory()) return out;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name === "generate.ts") continue;
    out.push(`${root}/${entry.name}`);
  }
  return out;
}

describe("fixture scrub", () => {
  beforeAll(() => {
    // Idempotent: ensure on-disk fixtures match canonical shapes before scanning.
    generateAll();
  });

  it("on-disk fixtures match generator output (idempotent)", () => {
    const expected = buildFixtures();
    const map: Record<string, string> = {
      "tiny.jsonl": expected.tiny,
      "malformed.jsonl": expected.malformed,
      "crlf.jsonl": expected.crlf,
      "bom.jsonl": expected.bom,
      "legacy.sample.log": expected.legacy,
    };
    for (const [name, body] of Object.entries(map)) {
      const onDisk = readFileSync(resolve("test/fixtures", name), "utf8");
      expect(onDisk, `fixture drift: ${name}`).toBe(body);
    }
  });

  for (const file of listFixtures()) {
    it(`${file.replace(`${process.cwd()}/`, "")} is scrubbed`, () => {
      const body = readFileSync(file, "utf8");
      const hits: string[] = [];
      for (const [name, re] of FORBIDDEN) {
        if (re.test(body)) hits.push(name);
      }
      expect(hits, `${file}: matched ${hits.join(", ")}`).toEqual([]);
    });
  }
});
