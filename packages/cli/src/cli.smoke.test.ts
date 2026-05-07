import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLI = resolve(__dirname, "index.ts");
const TINY = resolve(process.cwd(), "test/fixtures/tiny.jsonl");
const TSX = resolve(process.cwd(), "node_modules/.bin/tsx");

interface RunResult {
  stdout: string;
  stderr: string;
  child: ChildProcessWithoutNullStreams;
}

function spawnCli(args: string[]): RunResult {
  const child = spawn(TSX, [CLI, ...args], {
    cwd: process.cwd(),
    env: process.env,
  }) as ChildProcessWithoutNullStreams;
  const result: RunResult = { stdout: "", stderr: "", child };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (d: string) => {
    result.stdout += d;
  });
  child.stderr.on("data", (d: string) => {
    result.stderr += d;
  });
  return result;
}

function waitForLine(r: RunResult, needle: string, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (r.stdout.includes(needle)) return resolve();
    const start = Date.now();
    const tick = setInterval(() => {
      if (r.stdout.includes(needle)) {
        clearInterval(tick);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(tick);
        reject(
          new Error(`timeout waiting for '${needle}'\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`),
        );
      }
    }, 25);
  });
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<number | null> {
  return new Promise((resolve) => child.once("exit", (code) => resolve(code)));
}

describe("ahp-viewer CLI smoke", () => {
  it("opens tiny.jsonl with --no-server and exits 0 on SIGINT", async () => {
    const r = spawnCli([TINY, "--no-server"]);
    await waitForLine(r, "[ahp-viewer] opened");
    expect(r.stdout).toMatch(/tiny\.jsonl/);
    r.child.kill("SIGINT");
    const code = await waitForExit(r.child);
    expect(code).toBe(0);
  }, 6000);

  it("starts health server bound to 127.0.0.1 and serves /health", async () => {
    // Use port 0 — CLI's startHealthServer prints the actual url.
    const r = spawnCli([TINY, "--port", "0"]);
    await waitForLine(r, "[ahp-viewer] listening on http://127.0.0.1:");
    const match = r.stdout.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/);
    expect(match).not.toBeNull();
    const url = match?.[1];
    if (!url) throw new Error("no url printed");
    const res = await fetch(`${url}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string; version?: string };
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    r.child.kill("SIGINT");
    const code = await waitForExit(r.child);
    expect(code).toBe(0);
  }, 6000);
});
