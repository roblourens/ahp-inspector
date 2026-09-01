import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import * as http from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PHASE5_APPENDED_EVENT,
  PHASE5_BASE_JSONL,
} from "../packages/ui/src/test-fixtures/phase5-log.js";

const CLI_ENTRY = resolve("packages/cli/src/index.ts");
const TSX_BIN = resolve("node_modules/.bin/tsx");

interface CliProc {
  child: ChildProcessWithoutNullStreams;
  stdout: string;
  stderr: string;
  exited: Promise<number | null>;
}

function spawnCli(file: string): CliProc {
  const child = spawn(TSX_BIN, [CLI_ENTRY, file, "--port", "0", "--no-open"], {
    cwd: process.cwd(),
    env: { ...process.env, BROWSER: "none" },
  }) as ChildProcessWithoutNullStreams;
  const proc: CliProc = {
    child,
    stdout: "",
    stderr: "",
    exited: new Promise((res) => child.once("exit", (code) => res(code))),
  };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (data: string) => {
    proc.stdout += data;
  });
  child.stderr.on("data", (data: string) => {
    proc.stderr += data;
  });
  return proc;
}

function waitForPort(proc: CliProc, timeoutMs = 10_000): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const start = Date.now();
    const tick = setInterval(() => {
      const match = proc.stdout.match(/AHP Inspector running at http:\/\/127\.0\.0\.1:(\d+)/);
      if (match?.[1]) {
        clearInterval(tick);
        resolvePort(Number(match[1]));
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(tick);
        reject(new Error(`timeout waiting for CLI port\n${proc.stdout}\n${proc.stderr}`));
      }
    }, 25);
  });
}

function apiUrl(port: number, path: string, apiToken: string): string {
  const url = new URL(path, `http://127.0.0.1:${port}`);
  url.searchParams.set("_ahpToken", apiToken);
  return url.toString();
}

async function readStandaloneApiToken(port: number): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/`);
  const html = await response.text();
  const token = html.match(/<meta name="ahp-api-token" content="([^"]+)" \/>/)?.[1];
  if (!token) throw new Error("standalone UI did not provide an API capability");
  return token;
}

function requestJson<T>(port: number, path: string, apiToken: string): Promise<T> {
  return new Promise((resolveJson, reject) => {
    const url = new URL(apiUrl(port, path, apiToken));
    http
      .get(
        {
          host: "127.0.0.1",
          port,
          path: `${url.pathname}${url.search}`,
          headers: { Host: `127.0.0.1:${port}` },
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            body += chunk;
          });
          res.on("end", () => {
            if ((res.statusCode ?? 500) >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
              return;
            }
            expect(body).not.toMatch(/\/Users\//);
            expect(body).not.toMatch(/\/home\//);
            expect(body).not.toMatch(/[A-Za-z]:\\\\/);
            resolveJson(JSON.parse(body) as T);
          });
        },
      )
      .on("error", reject);
  });
}

async function killCli(proc: CliProc): Promise<void> {
  if (proc.child.exitCode !== null) return;
  proc.child.kill("SIGTERM");
  await Promise.race([proc.exited, new Promise((res) => setTimeout(res, 3000))]);
}

describe("Phase 5 vertical slice", () => {
  let dir = "";
  let file = "";
  let proc: CliProc;
  let port = 0;
  let apiToken = "";

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "ahp-phase5-"));
    file = join(dir, "phase5-safe.jsonl");
    await writeFile(file, PHASE5_BASE_JSONL);
    proc = spawnCli(file);
    port = await waitForPort(proc);
    apiToken = await readStandaloneApiToken(port);
  }, 15_000);

  afterAll(async () => {
    await killCli(proc);
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("opens fixture, searches, retrieves detail, and follows appended events", async () => {
    const meta = await requestJson<{ filename: string }>(port, "/api/log/meta", apiToken);
    expect(meta.filename).toBe("phase5-safe.jsonl");

    const search = await requestJson<{ matches: number[] }>(
      port,
      "/api/log/search?q=retrowave&limit=20",
      apiToken,
    );
    expect(search.matches.length).toBeGreaterThan(0);

    const detail = await requestJson<{ event: { raw: unknown } }>(
      port,
      "/api/log/event/0",
      apiToken,
    );
    expect(JSON.stringify(detail.event.raw)).toContain("initialize");

    await appendFile(file, `${PHASE5_APPENDED_EVENT}\n`);
    await new Promise((res) => setTimeout(res, 350));
    const appended = await requestJson<{ matches: number[]; total: number }>(
      port,
      "/api/log/search?q=append%20sentinel&limit=20",
      apiToken,
    );
    expect(appended.total).toBeGreaterThan(0);
  }, 15_000);
});
