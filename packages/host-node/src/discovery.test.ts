import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverVsCodeLogs, resolveCandidateId } from "./discovery.js";

let tmpRoot: string;
let stableRoot: string;
let insidersRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "ahp-discovery-"));
  stableRoot = join(tmpRoot, "Code", "logs");
  insidersRoot = join(tmpRoot, "Code-Insiders", "logs");
  // Two launch sessions in stableRoot.
  for (const launch of ["20260407T100000", "20260407T223530"]) {
    const sessionDir = join(stableRoot, launch);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, "main.log"), "noise"); // not matched
    await writeFile(join(sessionDir, "mcpGateway.log"), "noise"); // not matched
    const exthost = join(sessionDir, "window1", "exthost", "GitHub.copilot-chat");
    await mkdir(exthost, { recursive: true });
    await writeFile(join(exthost, `agenthost.${launch}.jsonl`), "{}\n");
    await writeFile(join(exthost, `agenthost.${launch}.log`), "legacy");
  }
});

afterEach(async () => {
  // best-effort
  await import("node:fs/promises")
    .then((fs) => fs.rm(tmpRoot, { recursive: true, force: true }))
    .catch(() => {});
});

describe("discoverVsCodeLogs", () => {
  it("returns SafeCandidates from a synthetic tree, sorted high-confidence first", async () => {
    const { candidates, truncated } = await discoverVsCodeLogs({
      roots: [{ origin: "vscode", dir: stableRoot }],
    });
    expect(truncated).toBe(false);
    // 2 launch sessions × (1 jsonl + 1 legacy log) = 4 candidates.
    expect(candidates.length).toBe(4);
    // Highest confidence first.
    expect(candidates[0]?.confidence).toBe("high");
    expect(candidates[0]?.label).toMatch(/\.jsonl$/);
    // Newest launch first within tier.
    expect(candidates[0]?.label).toContain("20260407T223530");
    // Legacy logs come after jsonls.
    expect(candidates.at(-1)?.confidence).toBe("low");
  });

  it("returns opaque 32-hex ids and no absolute paths in candidate fields", async () => {
    const { candidates } = await discoverVsCodeLogs({
      roots: [{ origin: "vscode", dir: stableRoot }],
    });
    for (const c of candidates) {
      expect(c.id).toMatch(/^[0-9a-f]{32}$/);
      expect(c.label).not.toContain("/");
      expect(c.label).not.toContain("\\");
      // contextLabel is launch-relative — must NOT contain the tmpRoot path.
      expect(c.contextLabel ?? "").not.toContain(tmpRoot);
    }
  });

  it("resolveCandidateId round-trips back to the absolute path", async () => {
    const { candidates } = await discoverVsCodeLogs({
      roots: [{ origin: "vscode", dir: stableRoot }],
    });
    const c = candidates[0];
    expect(c).toBeDefined();
    if (!c) return;
    const abs = resolveCandidateId(c.id);
    expect(abs).not.toBeNull();
    expect(abs).toContain(stableRoot);
    expect(resolveCandidateId("not-a-real-id")).toBeNull();
  });

  it("flags truncated:true when maxStats is exceeded", async () => {
    const { truncated } = await discoverVsCodeLogs({
      roots: [{ origin: "vscode", dir: stableRoot }],
      maxStats: 2,
    });
    expect(truncated).toBe(true);
  });

  it("flags truncated:true when time budget elapses", async () => {
    let t = 0;
    const { truncated } = await discoverVsCodeLogs({
      roots: [{ origin: "vscode", dir: stableRoot }],
      timeBudgetMs: 0,
      now: () => {
        t += 10;
        return t;
      },
    });
    expect(truncated).toBe(true);
  });

  it("silently skips nonexistent roots", async () => {
    const { candidates, truncated } = await discoverVsCodeLogs({
      roots: [
        { origin: "vscode-insiders", dir: insidersRoot }, // not created
        { origin: "vscode", dir: stableRoot },
      ],
    });
    expect(truncated).toBe(false);
    expect(candidates.length).toBeGreaterThan(0);
    // All from stable root.
    for (const c of candidates) expect(c.origin).toBe("vscode");
  });
});
