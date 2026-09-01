// Test helpers private to the Plan 02-05 CLI integration tests.
// Spawns the CLI via tsx so tests don't depend on dist artifacts.

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { resolve } from "node:path";

export const CLI_ENTRY = resolve(__dirname, "index.ts");
export const CLI_MINI = resolve(process.cwd(), "test/fixtures/cli-mini.jsonl");

export interface RunningCli {
  child: ChildProcessWithoutNullStreams;
  stdout: string;
  stderr: string;
}

/** Spawn the CLI without waiting; caller drives the lifecycle. */
export function spawnCliRaw(args: string[]): RunningCli {
  const child = spawn(process.execPath, ["--import", "tsx", CLI_ENTRY, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, BROWSER: "none" },
  }) as ChildProcessWithoutNullStreams;
  const r: RunningCli = { child, stdout: "", stderr: "" };
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

export interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: NodeJS.Signals | null;
}

/** Spawn and resolve when the process exits. */
export function spawnCli(args: string[], timeoutMs = 8000): Promise<SpawnResult> {
  const r = spawnCliRaw(args);
  return new Promise((resolveP, reject) => {
    const t = setTimeout(() => {
      r.child.kill("SIGKILL");
      reject(
        new Error(
          `spawnCli timed out after ${timeoutMs}ms\nargs=${JSON.stringify(args)}\nstdout=${r.stdout}\nstderr=${r.stderr}`,
        ),
      );
    }, timeoutMs);
    r.child.once("exit", (code, signal) => {
      clearTimeout(t);
      resolveP({ stdout: r.stdout, stderr: r.stderr, code, signal });
    });
    r.child.once("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

export function waitForLine(r: RunningCli, regex: RegExp, timeoutMs = 5000): Promise<string> {
  return new Promise((resolveP, reject) => {
    const seen = () => {
      const m = r.stdout.match(regex);
      return m ? m[0] : null;
    };
    const initial = seen();
    if (initial) return resolveP(initial);
    const start = Date.now();
    const tick = setInterval(() => {
      const m = seen();
      if (m) {
        clearInterval(tick);
        resolveP(m);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(tick);
        reject(
          new Error(
            `timeout (${timeoutMs}ms) waiting for ${regex}\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`,
          ),
        );
      }
    }, 25);
  });
}

export function waitForExit(child: ChildProcessWithoutNullStreams): Promise<number | null> {
  return new Promise((resolveP) => child.once("exit", (code) => resolveP(code)));
}
