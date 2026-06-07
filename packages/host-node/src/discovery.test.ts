import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverVsCodeLogs, defaultRoots, resolveCandidateId, type Root } from "./discovery.js";

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
  await rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
});

describe("discoverVsCodeLogs", () => {
  it("returns SafeCandidates from a synthetic tree, sorted high-confidence first", async () => {
    const { candidates, truncated } = await discoverVsCodeLogs({
      roots: [{ origin: "vscode", dir: stableRoot }],
    });
    expect(truncated).toBe(false);
    // 2 launch sessions × 1 jsonl = 2 candidates (legacy .log files are ignored).
    expect(candidates.length).toBe(2);
    // Highest confidence first.
    expect(candidates[0]?.confidence).toBe("high");
    expect(candidates[0]?.label).toMatch(/\.jsonl$/);
    // Newest launch first within tier.
    expect(candidates[0]?.label).toContain("20260407T223530");
    // No legacy .log entries should leak through.
    expect(candidates.every((c) => c.label.endsWith(".jsonl"))).toBe(true);
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
      expect(c.contextLabel).toMatch(/^20260407T\d+ \/ window1 \/ exthost \/ GitHub\.copilot-chat$/);
    }
  });

  it("uses an empty context label for candidates directly under a configured root", async () => {
    const directRoot = join(tmpRoot, "direct-root");
    await mkdir(directRoot, { recursive: true });
    await writeFile(join(directRoot, "agenthost.direct.jsonl"), "{}\n");

    const { candidates } = await discoverVsCodeLogs({ roots: [{ origin: "vscode", dir: directRoot }] });

    expect(candidates[0]?.contextLabel).toBe("");
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

  it("keeps opaque id resolution exact when discovery calls overlap", async () => {
    const firstRoot = join(tmpRoot, "overlap-first");
    const secondRoot = join(tmpRoot, "overlap-second");
    await mkdir(firstRoot, { recursive: true });
    await mkdir(secondRoot, { recursive: true });
    const firstLog = join(firstRoot, "agenthost.first.jsonl");
    const secondLog = join(secondRoot, "agenthost.second.jsonl");
    await writeFile(firstLog, "{}\n");
    await writeFile(secondLog, "{}\n");

    const firstPromise = discoverVsCodeLogs({ roots: [{ origin: "vscode", dir: firstRoot }] });
    const secondPromise = discoverVsCodeLogs({ roots: [{ origin: "vscode", dir: secondRoot }] });
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(resolveCandidateId(first.candidates[0]?.id ?? "")).toBeNull();
    expect(resolveCandidateId(second.candidates[0]?.id ?? "")).toBe(secondLog);
  });

  it("deduplicates candidates from repeated or overlapping roots", async () => {
    const result = await discoverVsCodeLogs({
      roots: [
        { origin: "vscode", dir: stableRoot },
        { origin: "vscode", dir: stableRoot },
      ],
    });
    const ids = result.candidates.map((candidate) => candidate.id);

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reserves a nested overlapping root candidate before filling a busy broad root", async () => {
    const broadRoot = join(tmpRoot, "broad-root");
    const nestedRoot = join(broadRoot, "nested-root");
    await mkdir(nestedRoot, { recursive: true });
    for (let index = 0; index < 205; index++) {
      await writeFile(join(broadRoot, `agenthost.busy-${index}.jsonl`), "{}\n");
    }
    const nestedLog = join(nestedRoot, "agenthost.nested.jsonl");
    await writeFile(nestedLog, "{}\n");
    await utimes(nestedLog, 1_600_000_000, 1_600_000_000);

    const result = await discoverVsCodeLogs({
      roots: [
        { origin: "vscode", dir: broadRoot },
        { origin: "vscode-oss-dev", dir: nestedRoot },
      ],
      maxImmediateEntries: 300,
      maxStats: 500,
    });

    expect(result.candidates).toHaveLength(200);
    expect(result.candidates.some((candidate) => resolveCandidateId(candidate.id) === nestedLog)).toBe(true);
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

  it("retains a fresh later-root candidate after a noisy first root truncates", async () => {
    const noisyRoot = join(tmpRoot, "noisy");
    const laterRoot = join(tmpRoot, "later");
    await mkdir(noisyRoot, { recursive: true });
    await mkdir(laterRoot, { recursive: true });
    await writeFile(join(noisyRoot, "noise-a.txt"), "noise");
    await writeFile(join(noisyRoot, "noise-b.txt"), "noise");
    const laterLog = join(laterRoot, "agenthost.latest.jsonl");
    await writeFile(laterLog, "{}\n");

    const result = await discoverVsCodeLogs({
      roots: [
        { origin: "vscode", dir: noisyRoot },
        { origin: "vscode-oss-dev", dir: laterRoot },
      ],
      maxImmediateEntries: 1,
      maxStats: 10,
    });

    expect(result.truncated).toBe(true);
    expect(result.candidates.some((candidate) => resolveCandidateId(candidate.id) === laterLog)).toBe(true);
  });

  it("selects the newest launch after examining more than 50 root entries", async () => {
    const logsRoot = join(tmpRoot, "many-launches");
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

    const result = await discoverVsCodeLogs({
      roots: [{ origin: "vscode", dir: logsRoot }],
      maxImmediateEntries: 100,
      maxStats: 1_000,
      topLaunchDirs: 1,
    });

    expect(result.candidates.map((candidate) => resolveCandidateId(candidate.id))).toEqual([targetLog]);
  });

  it("retains one ranked candidate from every populated root beyond the default result cap", async () => {
    const roots: Root[] = [];
    for (let index = 0; index < 201; index++) {
      const rootDir = join(tmpRoot, "populated-roots", index.toString());
      await mkdir(rootDir, { recursive: true });
      await writeFile(join(rootDir, `agenthost.${index}.jsonl`), "{}\n");
      roots.push({ origin: "vscode", dir: rootDir });
    }

    const result = await discoverVsCodeLogs({ roots, maxImmediateEntries: 2, maxStats: 2 });
    const resolvedRoots = new Set(
      result.candidates.map((candidate) => resolveCandidateId(candidate.id)).map((absPath) => join(absPath ?? "", "..")),
    );

    expect(result.candidates).toHaveLength(roots.length);
    expect(resolvedRoots.size).toBe(roots.length);
  });

  it("caps populations of 200 or fewer roots at the default result cap after ranking", async () => {
    const logsRoot = join(tmpRoot, "many-candidates");
    await mkdir(logsRoot, { recursive: true });
    for (let index = 0; index < 220; index++) {
      await writeFile(join(logsRoot, `agenthost.${index.toString().padStart(3, "0")}.jsonl`), "{}\n");
    }
    const actualOrder = await readdir(logsRoot);
    const lateName = actualOrder[actualOrder.length - 1];
    expect(lateName).toBeDefined();
    if (!lateName) return;
    const lateFreshLog = join(logsRoot, lateName);
    await utimes(lateFreshLog, 1_900_000_000, 1_900_000_000);

    const result = await discoverVsCodeLogs({
      roots: [{ origin: "vscode", dir: logsRoot }],
      maxImmediateEntries: 300,
      maxStats: 300,
    });

    expect(result.candidates).toHaveLength(200);
    expect(resolveCandidateId(result.candidates[0]?.id ?? "")).toBe(lateFreshLog);
    expect(result.truncated).toBe(true);
  });

  it("allocates equal extra quota before filling unused capacity", async () => {
    const busyRoot = join(tmpRoot, "busy-root");
    const sparseRoot = join(tmpRoot, "sparse-root");
    await mkdir(busyRoot, { recursive: true });
    await mkdir(sparseRoot, { recursive: true });
    for (let index = 0; index < 205; index++) {
      await writeFile(join(busyRoot, `agenthost.busy-${index}.jsonl`), "{}\n");
    }
    const sparseLogs = [join(sparseRoot, "agenthost.sparse-a.jsonl"), join(sparseRoot, "agenthost.sparse-b.jsonl")];
    for (const sparseLog of sparseLogs) await writeFile(sparseLog, "{}\n");

    const result = await discoverVsCodeLogs({
      roots: [
        { origin: "vscode", dir: busyRoot },
        { origin: "vscode-oss-dev", dir: sparseRoot },
      ],
      maxImmediateEntries: 300,
      maxStats: 300,
    });
    const resolved = new Set(result.candidates.map((candidate) => resolveCandidateId(candidate.id)));

    expect(result.candidates).toHaveLength(200);
    expect(sparseLogs.every((log) => resolved.has(log))).toBe(true);
  });

  it("defaultRoots includes both ~/.vscode-oss-dev/logs and ~/.vscode-oss-agents-dev/logs", () => {
    const dirs = defaultRoots().map((r) => r.dir.replace(/\\/g, "/"));
    expect(dirs.some((d) => d.endsWith("/.vscode-oss-dev/logs"))).toBe(true);
    expect(dirs.some((d) => d.endsWith("/.vscode-oss-agents-dev/logs"))).toBe(true);
  });
});
