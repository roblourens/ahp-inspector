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
