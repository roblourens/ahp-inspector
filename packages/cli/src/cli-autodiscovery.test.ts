// CLI auto-discovery integration tests (Phase 13, Plan 13-01 Task 2).
// Verifies that `ahp-inspector` (no path arg) auto-opens the newest AHP log
// under the standard VS Code log roots, and falls back to the picker UI with
// a friendly stderr message when no candidate qualifies. Hermetic: redirects
// HOME to a tmpdir so the CLI never touches the real machine's logs.

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_ENTRY = resolve(__dirname, "index.ts");
const TSX_BIN = resolve(process.cwd(), "node_modules/.bin/tsx");

const VALID_AHP_LINE =
  '{"jsonrpc":"2.0","method":"someRequest","params":{},"id":1}\n';

let tmpHome: string;

function spawnWithHome(args: string[]): {
  child: ChildProcessWithoutNullStreams;
  stdout: string;
  stderr: string;
} {
  const child = spawn(TSX_BIN, [CLI_ENTRY, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: tmpHome,
      // On Windows, defaultRoots reads APPDATA; keep parity by clearing it.
      APPDATA: join(tmpHome, "AppData", "Roaming"),
      BROWSER: "none",
    },
  }) as ChildProcessWithoutNullStreams;
  const r = { child, stdout: "", stderr: "" };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (d: string) => {
    r.stdout += d;
  });
  child.stderr.on("data", (d: string) => {
    r.stderr += d;
  });
  return r;
}

async function waitFor(
  read: () => string,
  regex: RegExp,
  timeoutMs = 8000,
): Promise<string> {
  const start = Date.now();
  return new Promise((resolveP, reject) => {
    const tick = setInterval(() => {
      const m = read().match(regex);
      if (m) {
        clearInterval(tick);
        resolveP(m[0]);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(tick);
        reject(new Error(`timeout waiting for ${regex}\nGot:\n${read()}`));
      }
    }, 25);
  });
}

function waitExit(child: ChildProcessWithoutNullStreams): Promise<number | null> {
  return new Promise((res) => child.once("exit", (code) => res(code)));
}

beforeEach(async () => {
  tmpHome = await mkdtemp(join(tmpdir(), "ahp-cli-autodiscovery-"));
});

afterEach(async () => {
  await rm(tmpHome, { recursive: true, force: true }).catch(() => {});
});

describe("ahp-inspector CLI auto-discovery (Phase 13)", () => {
  it("no-arg miss: empty HOME → stderr 'No AHP logs found' + server still starts", async () => {
    const proc = spawnWithHome(["--no-open", "--port", "0"]);
    try {
      const banner = await waitFor(
        () => proc.stdout,
        /AHP Inspector running at http:\/\/127\.0\.0\.1:\d+/,
      );
      expect(banner).toMatch(/127\.0\.0\.1/);
      // The stderr message lands after auto-discovery completes (~1.5s budget).
      await waitFor(
        () => proc.stderr,
        /No AHP logs found under VS Code log roots — opened picker UI\./,
      );
      // Old in-stdout note must be gone.
      expect(proc.stdout).not.toMatch(/No log file selected/);
    } finally {
      proc.child.kill("SIGTERM");
      const code = await Promise.race([
        waitExit(proc.child),
        new Promise<number | null>((res) => setTimeout(() => res(null), 5000)),
      ]);
      // Exit code is signal-driven; just ensure we didn't crash hard.
      expect(code === 0 || code === null).toBe(true);
    }
  }, 20_000);

  it("no-arg hit: fixture log under $HOME/Library/Application Support/Code/logs → Watching <path>", async () => {
    if (process.platform !== "darwin") return; // hermetic root layout differs per platform
    const launchDir = join(
      tmpHome,
      "Library",
      "Application Support",
      "Code",
      "logs",
      "20260101T000000",
      "exthost",
      "GitHub.copilot-chat",
    );
    await mkdir(launchDir, { recursive: true });
    const fixturePath = join(launchDir, "agenthost.20260101.jsonl");
    await writeFile(fixturePath, VALID_AHP_LINE);
    const recent = Math.floor(Date.now() / 1000);
    await utimes(fixturePath, recent, recent);

    const proc = spawnWithHome(["--no-open", "--port", "0"]);
    try {
      await waitFor(() => proc.stdout, /AHP Inspector running at /);
      const watchingLine = await waitFor(() => proc.stdout, /Watching .+\.jsonl/);
      expect(watchingLine).toContain(fixturePath);
      // Friendly miss-message must NOT appear on a hit.
      expect(proc.stderr).not.toMatch(/No AHP logs found/);
    } finally {
      proc.child.kill("SIGTERM");
      await waitExit(proc.child);
    }
  }, 20_000);

  it("explicit path bypasses auto-discovery (no scan even when HOME is empty)", async () => {
    const fixture = resolve(process.cwd(), "test/fixtures/cli-mini.jsonl");
    const proc = spawnWithHome([fixture, "--no-open", "--port", "0"]);
    try {
      await waitFor(() => proc.stdout, /AHP Inspector running at /);
      const watchingLine = await waitFor(() => proc.stdout, /Watching .+cli-mini\.jsonl/);
      expect(watchingLine).toContain("cli-mini.jsonl");
      // The miss-message is exclusive to no-arg branch — must NOT appear.
      expect(proc.stderr).not.toMatch(/No AHP logs found/);
    } finally {
      proc.child.kill("SIGTERM");
      await waitExit(proc.child);
    }
  }, 15_000);
});
