import { chmod, mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findLatestAhpLog } from "./find-latest-ahp-log.js";

let tmpRoot: string;
let logsRoot: string;

// A line that normalizes successfully (request shape: has method + id).
const VALID_AHP_LINE = '{"jsonrpc":"2.0","method":"someRequest","params":{},"id":1}\n';

// A JSON line that does NOT match any AHP discriminator (no method/id/result/error).
const NON_AHP_LINE = '{"foo":"bar"}\n';

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "ahp-find-latest-"));
  logsRoot = join(tmpRoot, "logs");
  await mkdir(logsRoot, { recursive: true });
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
});

async function writeWithMtime(absPath: string, content: string, mtimeSec: number): Promise<void> {
  await mkdir(join(absPath, ".."), { recursive: true });
  await writeFile(absPath, content);
  await utimes(absPath, mtimeSec, mtimeSec);
}

async function writeNoiseFiles(root: string, count: number): Promise<void> {
  for (let start = 0; start < count; start += 250) {
    const end = Math.min(start + 250, count);
    await Promise.all(
      Array.from({ length: end - start }, (_, offset) =>
        writeFile(join(root, `noise-${start + offset}.txt`), "noise"),
      ),
    );
  }
}

describe("findLatestAhpLog", () => {
  it("returns the newest valid AHP-shape candidate (newest-mtime selection)", async () => {
    const oldest = join(logsRoot, "agenthost.old.jsonl");
    const middle = join(logsRoot, "agenthost.mid.jsonl");
    const newest = join(logsRoot, "agenthost.new.jsonl");
    await writeWithMtime(oldest, VALID_AHP_LINE, 1_700_000_000);
    await writeWithMtime(middle, VALID_AHP_LINE, 1_700_001_000);
    await writeWithMtime(newest, VALID_AHP_LINE, 1_700_002_000);

    const result = await findLatestAhpLog({
      rootsOverride: [{ origin: "vscode", dir: logsRoot }],
    });
    expect(result).toBe(newest);
  });

  it("skips 0-byte files even when their mtime is newest", async () => {
    const valid = join(logsRoot, "agenthost.valid.jsonl");
    const empty = join(logsRoot, "agenthost.empty.jsonl");
    await writeWithMtime(valid, VALID_AHP_LINE, 1_700_000_000);
    await writeWithMtime(empty, "", 1_700_999_999);

    const result = await findLatestAhpLog({
      rootsOverride: [{ origin: "vscode", dir: logsRoot }],
    });
    expect(result).toBe(valid);
  });

  it("rejects files whose first line does not normalize as an AHP event", async () => {
    const badShape = join(logsRoot, "agenthost.notahp.jsonl");
    const valid = join(logsRoot, "agenthost.valid.jsonl");
    await writeWithMtime(valid, VALID_AHP_LINE, 1_700_000_000);
    await writeWithMtime(badShape, NON_AHP_LINE, 1_700_999_999);

    const result = await findLatestAhpLog({
      rootsOverride: [{ origin: "vscode", dir: logsRoot }],
    });
    expect(result).toBe(valid);
  });

  it("probes past more than ten newer invalid matching files", async () => {
    const valid = join(logsRoot, "agenthost.valid.jsonl");
    await writeWithMtime(valid, VALID_AHP_LINE, 1_700_000_000);
    for (let index = 0; index < 12; index++) {
      await writeWithMtime(join(logsRoot, `agenthost.invalid-${index}.jsonl`), NON_AHP_LINE, 1_800_000_000 + index);
    }

    const result = await findLatestAhpLog({
      rootsOverride: [{ origin: "vscode", dir: logsRoot }],
    });

    expect(result).toBe(valid);
  });

  it("returns the globally newest valid log across configured roots", async () => {
    const firstRoot = join(tmpRoot, "first-root");
    const secondRoot = join(tmpRoot, "second-root");
    const older = join(firstRoot, "agenthost.older.jsonl");
    const newer = join(secondRoot, "agenthost.newer.jsonl");
    await writeWithMtime(older, VALID_AHP_LINE, 1_700_000_000);
    await writeWithMtime(newer, VALID_AHP_LINE, 1_800_000_000);

    const result = await findLatestAhpLog({
      rootsOverride: [
        { origin: "vscode", dir: firstRoot },
        { origin: "vscode-oss-dev", dir: secondRoot },
      ],
    });

    expect(result).toBe(newer);
  });

  it("preserves discovery of logs five directories below a configured root", async () => {
    const nested = join(logsRoot, "a", "b", "c", "d", "e", "agenthost.nested.jsonl");
    await writeWithMtime(nested, VALID_AHP_LINE, 1_800_000_000);

    const result = await findLatestAhpLog({ rootsOverride: [{ origin: "vscode", dir: logsRoot }] });

    expect(result).toBe(nested);
  });

  it("attempts a later root after a noisy first root exhausts its allowance", async () => {
    const noisyRoot = join(tmpRoot, "noisy-root");
    const laterRoot = join(tmpRoot, "later-root");
    await mkdir(noisyRoot, { recursive: true });
    const laterValid = join(laterRoot, "agenthost.latest.jsonl");
    await writeNoiseFiles(noisyRoot, 5_001);
    await writeWithMtime(laterValid, VALID_AHP_LINE, 1_900_000_000);

    const result = await findLatestAhpLog({
      rootsOverride: [
        { origin: "vscode", dir: noisyRoot },
        { origin: "vscode-oss-dev", dir: laterRoot },
      ],
    });

    expect(result).toBe(laterValid);
  });

  it("returns null when no candidate matches", async () => {
    const result = await findLatestAhpLog({
      rootsOverride: [{ origin: "vscode", dir: logsRoot }],
    });
    expect(result).toBeNull();
  });

  it("does not throw on unreadable file (chmod 000) and falls through to next candidate", async () => {
    if (process.platform === "win32") return; // chmod is a noop on Windows.
    const unreadable = join(logsRoot, "agenthost.locked.jsonl");
    const valid = join(logsRoot, "agenthost.valid.jsonl");
    await writeWithMtime(valid, VALID_AHP_LINE, 1_700_000_000);
    await writeWithMtime(unreadable, VALID_AHP_LINE, 1_700_999_999);
    await chmod(unreadable, 0o000);
    try {
      const result = await findLatestAhpLog({
        rootsOverride: [{ origin: "vscode", dir: logsRoot }],
      });
      expect(result).toBe(valid);
    } finally {
      await chmod(unreadable, 0o644).catch(() => {});
    }
  });
});
