// Vertical-slice end-to-end test (Plan 02-06 Task 2). Boots the real CLI
// against test/fixtures/phase2-mini.jsonl, verifies the standalone web app
// is served, and confirms the SSE handshake delivers row data with the
// snapshot/append/patch contract intact.
//
// Maps to ROADMAP Phase-2 success criteria 1-5:
//   SC1 CLI → server → SSE handshake (snapshot-begin/chunk/end frames).
//   SC2 Snapshot chunk size cap (≤ 2000 rows; total reflects fixture).
//   SC3 EventRow contract (11 columns, no absolute path leakage).
//   SC4 Visual encoding correctness (parse-error tagged BAD + correlated
//        request row reaches status='ok' with a non-null latencyBand).
//   SC5 Server shutdown causes /api/log/meta to fail (no-server state).
//
// Per the existing sse-integration.test.ts, we use a hand-rolled SSE client
// over Node's http module (deterministic in Vitest).

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import * as http from "node:http";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const FIXTURE = resolve("test/fixtures/phase2-mini.jsonl");
const CLI_ENTRY = resolve("packages/cli/src/index.ts");
const TSX_BIN = resolve("node_modules/.bin/tsx");
const UI_DIST = resolve("packages/ui/dist");
const UI_INDEX = resolve(UI_DIST, "index.html");

interface Frame {
  event: string;
  data: string;
}

function parseFrame(block: string): Frame | null {
  let event = "message";
  const dataParts: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataParts.push(line.slice(5).trimStart());
  }
  if (dataParts.length === 0) return null;
  return { event, data: dataParts.join("\n") };
}

interface SseClient {
  close(): void;
  next(timeoutMs?: number): Promise<Frame>;
  collect(durationMs: number): Promise<Frame[]>;
}

function openSse(opts: { port: number; path: string }): Promise<SseClient> {
  return new Promise((resolveOuter, reject) => {
    const buf: Frame[] = [];
    const waiters: Array<(f: Frame) => void> = [];
    let pending = "";
    const req = http.request(
      {
        host: "127.0.0.1",
        port: opts.port,
        path: opts.path,
        method: "GET",
        headers: { Host: `127.0.0.1:${opts.port}`, Accept: "text/event-stream" },
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`SSE status ${res.statusCode}`));
          res.resume();
          return;
        }
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          pending += chunk;
          let sep = pending.indexOf("\n\n");
          while (sep !== -1) {
            const raw = pending.slice(0, sep);
            pending = pending.slice(sep + 2);
            const frame = parseFrame(raw);
            if (frame) {
              if (waiters.length > 0) waiters.shift()?.(frame);
              else buf.push(frame);
            }
            sep = pending.indexOf("\n\n");
          }
        });
        const close = (): void => {
          try {
            req.destroy();
          } catch {
            /* ignore */
          }
          try {
            res.destroy();
          } catch {
            /* ignore */
          }
        };
        const next = (timeoutMs = 3000): Promise<Frame> => {
          const head = buf.shift();
          if (head) return Promise.resolve(head);
          return new Promise<Frame>((res2, rej2) => {
            const t = setTimeout(() => rej2(new Error("SSE next() timeout")), timeoutMs);
            waiters.push((f) => {
              clearTimeout(t);
              res2(f);
            });
          });
        };
        const collect = (durationMs: number): Promise<Frame[]> =>
          new Promise<Frame[]>((res2) => {
            const collected: Frame[] = [];
            const drain = (): void => {
              while (buf.length > 0) {
                const f = buf.shift();
                if (f) collected.push(f);
              }
            };
            const tick = setInterval(() => {
              drain();
              if (collected.length >= 200) {
                clearInterval(tick);
                clearTimeout(timer);
                res2(collected);
              }
            }, 25);
            const timer = setTimeout(() => {
              clearInterval(tick);
              res2(collected);
            }, durationMs);
          });
        resolveOuter({ close, next, collect });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

interface CliProc {
  child: ChildProcessWithoutNullStreams;
  stdout: string;
  stderr: string;
  exited: Promise<number | null>;
}

function spawnCli(args: string[]): CliProc {
  const child = spawn(TSX_BIN, [CLI_ENTRY, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, BROWSER: "none" },
  }) as ChildProcessWithoutNullStreams;
  const r: CliProc = {
    child,
    stdout: "",
    stderr: "",
    exited: new Promise<number | null>((res) => child.once("exit", (code) => res(code))),
  };
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

function waitForPort(r: CliProc, timeoutMs = 5000): Promise<number> {
  return new Promise((res, rej) => {
    const start = Date.now();
    const tick = setInterval(() => {
      const m = r.stdout.match(/AHP Log Viewer running at http:\/\/127\.0\.0\.1:(\d+)/);
      if (m) {
        clearInterval(tick);
        const portStr = m[1];
        if (!portStr) {
          rej(new Error("port regex matched without capture group"));
          return;
        }
        res(Number(portStr));
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(tick);
        rej(new Error(`timeout waiting for CLI port. STDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`));
      }
    }, 25);
  });
}

async function killCli(r: CliProc): Promise<void> {
  if (r.child.exitCode !== null) return;
  r.child.kill("SIGTERM");
  const code = await Promise.race([
    r.exited,
    new Promise<number | null>((res) => setTimeout(() => res(-1 as number), 5000)),
  ]);
  if (code === -1) {
    try {
      r.child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }
}

function ensureUiBuilt(): void {
  if (existsSync(UI_INDEX)) {
    // Cache check: if the bundle exists and is newer than any src file, skip.
    const distMtime = statSync(UI_INDEX).mtimeMs;
    const srcRoot = resolve("packages/ui/src");
    let newestSrc = 0;
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const s = fs.statSync(p);
        if (s.isDirectory()) walk(p);
        else if (s.mtimeMs > newestSrc) newestSrc = s.mtimeMs;
      }
    };
    walk(srcRoot);
    if (distMtime >= newestSrc) return;
  }
  // Build (synchronous for determinism).
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  execSync("pnpm -F @ahp-viewer/ui build", { stdio: "inherit" });
}

describe("vertical-slice — CLI → server → SSE → UI bundle", () => {
  let cli: CliProc | undefined;
  let port = 0;

  beforeAll(async () => {
    ensureUiBuilt();
    cli = spawnCli([FIXTURE, "--port", "0", "--no-open"]);
    port = await waitForPort(cli);
    // Allow TailReader's initial read to settle so the snapshot contains
    // every fixture line. phase2-mini.jsonl is 5 lines — milliseconds.
    await new Promise((res) => setTimeout(res, 150));
  }, 60_000);

  afterAll(async () => {
    if (cli) await killCli(cli);
  });

  it("SC1: serves /api/log/meta with basename-only filename", async () => {
    const meta = await fetch(`http://127.0.0.1:${port}/api/log/meta`);
    expect(meta.status).toBe(200);
    const body = (await meta.json()) as { filename: string; sizeBytes: number };
    expect(body.filename).toBe("phase2-mini.jsonl");
    // T-02-03: never expose absolute path.
    expect(JSON.stringify(body)).not.toContain("/Users/");
    expect(JSON.stringify(body)).not.toContain("test/fixtures");
  });

  it("SC1: serves the standalone UI bundle at /", async () => {
    const r = await fetch(`http://127.0.0.1:${port}/`);
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain('<div id="root">');
    // CSP must be inherited by the static response (T-02-06-03).
    expect(r.headers.get("content-security-policy")).toMatch(/default-src 'self'/);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("SC1+SC2+SC3+SC4: SSE handshake + row contract + parse-error + correlation", async () => {
    const c = await openSse({ port, path: "/api/log/stream" });
    try {
      // 1. snapshot-begin
      const begin = await c.next(3000);
      expect(begin.event).toBe("snapshot-begin");
      const beginPayload = JSON.parse(begin.data) as {
        meta: { filename: string };
        total: number;
      };
      expect(beginPayload.meta.filename).toBe("phase2-mini.jsonl");
      expect(beginPayload.total).toBeGreaterThanOrEqual(4);
      expect(begin.data).not.toContain("/Users/");
      expect(begin.data).not.toContain("test/fixtures");

      // 2. snapshot-chunk(s) → snapshot-end
      const chunkRows: Array<Record<string, unknown>> = [];
      let frame = await c.next(3000);
      while (frame.event === "snapshot-chunk") {
        const payload = JSON.parse(frame.data) as { rows: Array<Record<string, unknown>> };
        // SC2: chunk size cap.
        expect(payload.rows.length).toBeLessThanOrEqual(2000);
        for (const row of payload.rows) chunkRows.push(row);
        // SC3: no absolute path leakage in any chunk frame.
        expect(frame.data).not.toContain("/Users/");
        expect(frame.data).not.toContain("test/fixtures");
        frame = await c.next(3000);
      }
      expect(frame.event).toBe("snapshot-end");
      expect(chunkRows.length).toBeGreaterThanOrEqual(4);

      // SC3: EventRow contract — every required field present on the first row.
      const first = chunkRows[0] as Record<string, unknown>;
      const requiredKeys = [
        "tsFmt",
        "dirGlyph",
        "kindTag",
        "method",
        "actionType",
        "sessionShort",
        "turnShort",
        "status",
        "latencyMs",
        "keyId",
        "payloadPreview",
        "idx",
      ];
      for (const k of requiredKeys) {
        expect(first).toHaveProperty(k);
      }

      // SC4a: parse-error fixture line (`{not valid json`) → kindTag='BAD'.
      const parseErr = chunkRows.find((r) => r.kind === "parse-error");
      expect(parseErr, "fixture should produce one parse-error row").toBeTruthy();
      expect(parseErr?.kindTag).toBe("BAD");
      expect(parseErr?.parseErrorReason).toBeTruthy();

      // SC4b: late-correlation request (line 1) ↔ response (line 2). By the
      // time the snapshot fires the correlator has already linked them, so
      // the request row should carry status='ok' with a valid latencyBand.
      const reqRow = chunkRows.find(
        (r) => r.kind === "request" && (r.method === "initialize" || r.idx === 0),
      );
      expect(reqRow, "fixture should produce a correlated request row").toBeTruthy();
      expect(reqRow?.status).toBe("ok");
      const lb = reqRow?.latencyBand as string | null;
      expect(["fast", "normal", "slow", "critical"]).toContain(lb);
    } finally {
      c.close();
    }
  }, 15_000);

  it("SC5: shutting down the server makes /api/log/meta unreachable", async () => {
    if (!cli) throw new Error("cli not started");
    await killCli(cli);
    cli = undefined;
    await expect(fetch(`http://127.0.0.1:${port}/api/log/meta`)).rejects.toThrow();
  }, 10_000);
});
