import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanConfiguredRoots } from "./bounded-log-discovery.js";

const matchesAhpJsonl = (name: string): boolean =>
  name.startsWith("agenthost") && name.endsWith(".jsonl");

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "ahp-bounded-discovery-"));
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
});

describe("scanConfiguredRoots", () => {
  it("gives every configured root independent bounds", async () => {
    const noisyRoot = join(tmpRoot, "noisy");
    const laterRoot = join(tmpRoot, "later");
    await mkdir(noisyRoot, { recursive: true });
    await mkdir(laterRoot, { recursive: true });
    await writeFile(join(noisyRoot, "noise-a.txt"), "noise");
    await writeFile(join(noisyRoot, "noise-b.txt"), "noise");
    const laterLog = join(laterRoot, "agenthost.latest.jsonl");
    await writeFile(laterLog, "{}\n");

    const result = await scanConfiguredRoots({
      roots: [{ dir: noisyRoot }, { dir: laterRoot }],
      matchesFilename: matchesAhpJsonl,
      maxImmediateEntries: 1,
      maxStats: 10,
      timeBudgetMs: 10_000,
      topLaunchDirs: 1,
    });

    expect(result.roots[0]?.truncated).toBe(true);
    expect(result.roots[1]?.files.map((file) => file.absPath)).toContain(laterLog);
    expect(
      result.roots.reduce((total, root) => total + root.immediateEntriesExamined, 0),
    ).toBeLessThanOrEqual(2);
    expect(
      result.roots.reduce((total, root) => total + root.statsAttempted, 0),
    ).toBeLessThanOrEqual(20);
  });

  it("selects newest launch directories after examining the bounded root entries", async () => {
    const logsRoot = join(tmpRoot, "logs");
    await mkdir(logsRoot, { recursive: true });
    for (let index = 0; index < 60; index++) {
      const launchDir = join(logsRoot, `launch-${index.toString().padStart(2, "0")}`);
      await mkdir(launchDir);
      await utimes(launchDir, 1_700_000_000 + index, 1_700_000_000 + index);
    }
    const actualOrder = await readdir(logsRoot);
    const targetName = actualOrder[55];
    expect(targetName).toBeDefined();
    if (!targetName) return;
    const targetLog = join(logsRoot, targetName, "agenthost.latest.jsonl");
    await writeFile(targetLog, "{}\n");
    await utimes(join(logsRoot, targetName), 1_800_000_000, 1_800_000_000);

    const result = await scanConfiguredRoots({
      roots: [{ dir: logsRoot }],
      matchesFilename: matchesAhpJsonl,
      maxImmediateEntries: 100,
      maxStats: 1_000,
      timeBudgetMs: 10_000,
      topLaunchDirs: 1,
    });

    expect(result.roots[0]?.files.map((file) => file.absPath)).toEqual([targetLog]);
    expect(result.truncated).toBe(true);
  });

  it("marks the root truncated when the depth bound omits a subtree", async () => {
    const logsRoot = join(tmpRoot, "logs");
    await mkdir(join(logsRoot, "launch", "too-deep"), { recursive: true });

    const result = await scanConfiguredRoots({
      roots: [{ dir: logsRoot }],
      matchesFilename: matchesAhpJsonl,
      maxImmediateEntries: 10,
      maxStats: 10,
      timeBudgetMs: 10_000,
      topLaunchDirs: 1,
      maxDepthBelowLaunch: 0,
    });

    expect(result.truncated).toBe(true);
  });

  it("resets deterministic time and stat allowances for every root", async () => {
    const firstRoot = join(tmpRoot, "first");
    const laterRoot = join(tmpRoot, "later");
    await mkdir(firstRoot, { recursive: true });
    await mkdir(laterRoot, { recursive: true });
    await writeFile(join(firstRoot, "agenthost.first.jsonl"), "{}\n");
    const laterLog = join(laterRoot, "agenthost.later.jsonl");
    await writeFile(laterLog, "{}\n");
    let clock = 0;

    const result = await scanConfiguredRoots({
      roots: [{ dir: firstRoot }, { dir: laterRoot }],
      matchesFilename: matchesAhpJsonl,
      maxImmediateEntries: 10,
      maxStats: 1,
      timeBudgetMs: 3,
      topLaunchDirs: 1,
      now: () => ++clock,
    });

    expect(result.roots[1]?.files.map((file) => file.absPath)).toContain(laterLog);
    expect(result.roots.every((root) => root.statsAttempted <= 1)).toBe(true);
  });

  it("gathers a fresh matching file encountered late without a candidate cap", async () => {
    const logsRoot = join(tmpRoot, "logs");
    await mkdir(logsRoot, { recursive: true });
    for (let start = 0; start < 805; start += 100) {
      const end = Math.min(start + 100, 805);
      await Promise.all(
        Array.from({ length: end - start }, (_, offset) =>
          writeFile(
            join(logsRoot, `agenthost.${(start + offset).toString().padStart(3, "0")}.jsonl`),
            "{}\n",
          ),
        ),
      );
    }
    const actualOrder = await readdir(logsRoot);
    const lateName = [...actualOrder].reverse().find(matchesAhpJsonl);
    expect(lateName).toBeDefined();
    if (!lateName) return;
    const lateLog = join(logsRoot, lateName);
    await utimes(lateLog, 1_800_000_000, 1_800_000_000);

    const result = await scanConfiguredRoots({
      roots: [{ dir: logsRoot }],
      matchesFilename: matchesAhpJsonl,
      maxImmediateEntries: 900,
      maxStats: 900,
      timeBudgetMs: 10_000,
      topLaunchDirs: 1,
    });

    expect(result.roots[0]?.files).toHaveLength(805);
    expect(result.roots[0]?.files.map((file) => file.absPath)).toContain(lateLog);
  });
});
