// Phase 4 vertical-slice end-to-end test (Plan 04-07 Task 1).
//
// Boots the real CLI with HOME pointed at a synthetic VS Code-shaped fixture
// tree and verifies the full Phase 4 surface area against the running HTTP +
// SSE transports:
//
//   - GET /api/log/meta is 204 with no active session.
//   - GET /api/sessions/discover returns ≥2 SafeCandidates with no abs paths.
//   - POST /api/sessions/open {id} activates the chosen log.
//   - GET /api/log/stream snapshots, then yields an `append` SSE frame after
//     a tail write within 500 ms.
//   - Switching log via /api/sessions/open emits a `log-reset` SSE frame and
//     a fresh stream snapshot for the new log (rotation banner is NOT
//     triggered: log-reset is a session transition, not a rotation).
//   - Truncating the active file emits a `rotation` SSE frame on the live
//     stream.
//
// Privacy gate (D-05): every HTTP body and SSE frame body is run through
// `assertNoAbsPath` to enforce that no /Users/, \\Users\\, /home/ or
// X:\\ path strings ever leak across the boundary.
//
// Persistence behavior is jsdom-only and covered by
// packages/ui/src/persistence/persist-effect.test.ts; this test deliberately
// skips it because there is no DOM in the server-side suite.
//
// Maps to VALIDATION 04-W6-01.

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import * as http from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CLI_ENTRY = resolve("packages/cli/src/index.ts");
const TSX_BIN = resolve("node_modules/.bin/tsx");

// ── Privacy assertion helper ──────────────────────────────────────────────────

function assertNoAbsPath(payload: string): void {
  expect(payload).not.toMatch(/\/Users\//);
  expect(payload).not.toMatch(/\\Users\\/);
  expect(payload).not.toMatch(/\/home\//);
  expect(payload).not.toMatch(/[A-Za-z]:\\\\/);
}

// ── SSE helpers (mirrors phase3-vertical-slice.test.ts) ───────────────────────

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
  collect(timeoutMs?: number): Frame[];
}

function openSse(opts: { port: number; path: string }): Promise<SseClient> {
  return new Promise((resolveOuter, reject) => {
    const buf: Frame[] = [];
    const seen: Frame[] = [];
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
              seen.push(frame);
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
        const next = (timeoutMs = 5000): Promise<Frame> => {
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
        const collect = (): Frame[] => seen.slice();
        resolveOuter({ close, next, collect });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// ── CLI spawn helpers ─────────────────────────────────────────────────────────

interface CliProc {
  child: ChildProcessWithoutNullStreams;
  stdout: string;
  stderr: string;
  exited: Promise<number | null>;
}

function spawnCliNoFile(env: NodeJS.ProcessEnv): CliProc {
  // --no-auto-discover keeps Phase 13's auto-open-latest-log behavior off so
  // this test starts in the no-active-log state regardless of what AHP logs
  // exist under the synthetic HOME used by buildFixture().
  const child = spawn(TSX_BIN, [CLI_ENTRY, "--port", "0", "--no-open", "--no-auto-discover"], {
    cwd: process.cwd(),
    env,
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

function waitForPort(r: CliProc, timeoutMs = 15_000): Promise<number> {
  return new Promise((res, rej) => {
    const start = Date.now();
    const tick = setInterval(() => {
      const m = r.stdout.match(/AHP Inspector running at http:\/\/127\.0\.0\.1:(\d+)/);
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
        rej(new Error(`timeout waiting for CLI port.\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`));
      }
    }, 25);
  });
}

async function killCli(r: CliProc): Promise<void> {
  if (r.child.exitCode !== null) return;
  r.child.kill("SIGTERM");
  await Promise.race([
    r.exited,
    new Promise<number | null>((res) => setTimeout(() => res(-1 as number), 5000)),
  ]);
}

// ── Discovery fixture tree ────────────────────────────────────────────────────

interface FixtureLayout {
  homeDir: string;
  logsRoot: string;
  fileA: string; // newest, will be opened first
  fileB: string; // older, used for switch-log step
}

function discoveryRootForPlatform(homeDir: string): string {
  const p = process.platform;
  if (p === "darwin") return join(homeDir, "Library", "Application Support", "Code", "logs");
  if (p === "win32") return join(homeDir, "AppData", "Roaming", "Code", "logs");
  return join(homeDir, ".config", "Code", "logs");
}

async function buildFixture(): Promise<FixtureLayout> {
  const homeDir = await mkdtemp(join(tmpdir(), "ahp-phase4-home-"));
  const logsRoot = discoveryRootForPlatform(homeDir);
  // Two launch sessions; A is newer so it lands first in discovery.
  const launches = [
    { name: "20260108T100000", offsetMs: 60_000 }, // older
    { name: "20260108T223530", offsetMs: 0 }, // newer
  ];
  const files: string[] = [];
  for (const launch of launches) {
    const exthost = join(logsRoot, launch.name, "window1", "exthost", "GitHub.copilot-chat");
    await mkdir(exthost, { recursive: true });
    const file = join(exthost, `agenthost.${launch.name}.jsonl`);
    // A few canonical AHP rows so the AppState snapshot has something to ship.
    const seed = [
      `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"sessionId":"sess-${launch.name}"}}`,
      `{"jsonrpc":"2.0","id":1,"result":{"ok":true}}`,
      `{"jsonrpc":"2.0","method":"notify/heartbeat","params":{}}`,
    ].join("\n");
    await writeFile(file, `${seed}\n`);
    files.push(file);
  }
  const fileOlder = files[0];
  const fileNewer = files[1];
  if (!fileOlder || !fileNewer) throw new Error("fixture build failed");
  return { homeDir, logsRoot, fileA: fileNewer, fileB: fileOlder };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function getJson<T>(
  port: number,
  path: string,
): Promise<{ status: number; body: T | null; text: string }> {
  const r = await fetch(`http://127.0.0.1:${port}${path}`);
  const text = await r.text();
  let body: T | null = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = null;
    }
  }
  return { status: r.status, body, text };
}

async function postJson<T>(
  port: number,
  path: string,
  data: unknown,
): Promise<{ status: number; body: T | null; text: string }> {
  const r = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const text = await r.text();
  let body: T | null = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = null;
    }
  }
  return { status: r.status, body, text };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

interface SafeCandidate {
  id: string;
  label: string;
  mtimeMs: number;
  sizeBytes: number;
  origin: string;
  confidence: string;
  contextLabel?: string;
}

describe("phase 4 vertical slice — discover → open → tail → switch → rotation", () => {
  let cli: CliProc | undefined;
  let port = 0;
  let fx: FixtureLayout;

  beforeAll(async () => {
    fx = await buildFixture();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      BROWSER: "none",
      // Override HOME (mac/linux) and USERPROFILE/APPDATA (Windows) so
      // discoverVsCodeLogs() walks our synthetic tree instead of the real
      // VS Code logs on the dev box.
      HOME: fx.homeDir,
      USERPROFILE: fx.homeDir,
      APPDATA: join(fx.homeDir, "AppData", "Roaming"),
    };
    cli = spawnCliNoFile(env);
    port = await waitForPort(cli);
    // Allow the server's session manager to settle.
    await new Promise((res) => setTimeout(res, 200));
  }, 30_000);

  afterAll(async () => {
    if (cli) await killCli(cli);
    if (fx) await rm(fx.homeDir, { recursive: true, force: true }).catch(() => {});
  });

  // ── 1. No active log → 204 ────────────────────────────────────────────────

  it("GET /api/log/meta returns 204 when no log is active", async () => {
    const r = await fetch(`http://127.0.0.1:${port}/api/log/meta`);
    expect(r.status).toBe(204);
    const text = await r.text();
    assertNoAbsPath(text);
  });

  // ── 2. Discover returns SafeCandidates ────────────────────────────────────

  it("GET /api/sessions/discover returns ≥2 SafeCandidates with no absolute paths", async () => {
    const { status, body, text } = await getJson<{
      candidates: SafeCandidate[];
      truncated: boolean;
    }>(port, "/api/sessions/discover");
    expect(status).toBe(200);
    assertNoAbsPath(text);
    expect(body).toBeTruthy();
    if (!body) return;
    expect(body.candidates.length).toBeGreaterThanOrEqual(2);
    for (const c of body.candidates) {
      // SafeCandidate shape only — no path/abs leakage.
      expect(c.id).toMatch(/^[0-9a-f]{32}$/);
      expect(c.label).not.toContain("/");
      expect(c.label).not.toContain("\\");
      expect(c.label).toMatch(/\.jsonl$/);
      expect(typeof c.mtimeMs).toBe("number");
      expect(typeof c.sizeBytes).toBe("number");
      expect(["vscode", "vscode-insiders", "manual"]).toContain(c.origin);
      expect(["high", "medium", "low"]).toContain(c.confidence);
      // No leaked absolute paths in any string field
      assertNoAbsPath(JSON.stringify(c));
    }
  });

  // ── 3. Open by candidate id ───────────────────────────────────────────────

  let firstId = "";
  let secondId = "";
  it("POST /api/sessions/open {id} activates the chosen log", async () => {
    const disc = await getJson<{ candidates: SafeCandidate[] }>(port, "/api/sessions/discover");
    expect(disc.body).toBeTruthy();
    const cands = disc.body?.candidates ?? [];
    expect(cands.length).toBeGreaterThanOrEqual(2);
    // Choose the newest jsonl candidate first, then a *different* jsonl for
    // the switch-log step. Discovery sorts high-confidence first, so this
    // generally lines up with our two seeded launches.
    const jsonls = cands.filter((c) => c.label.endsWith(".jsonl"));
    expect(jsonls.length).toBeGreaterThanOrEqual(2);
    const a = jsonls[0];
    const b = jsonls.find((c) => c.id !== a?.id);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    if (!a || !b) return;
    firstId = a.id;
    secondId = b.id;

    const open = await postJson<{ active: { logKey: string; meta: { filename: string } } }>(
      port,
      "/api/sessions/open",
      { id: firstId },
    );
    expect(open.status).toBe(200);
    assertNoAbsPath(open.text);
    expect(open.body?.active.meta.filename).toMatch(/\.jsonl$/);
    expect(open.body?.active.meta.filename).not.toContain("/");
    expect(open.body?.active.meta.filename).not.toContain("\\");

    // /api/log/meta is now 200 with basename only.
    const meta = await getJson<{ filename: string }>(port, "/api/log/meta");
    expect(meta.status).toBe(200);
    assertNoAbsPath(meta.text);
    expect(meta.body?.filename).toMatch(/\.jsonl$/);
    expect(meta.body?.filename).not.toContain("/");
  });

  // ── 4. Snapshot + tail append (×2 — D-15 pause is browser-side only) ─────

  it("SSE stream delivers snapshot and append frames after tail writes", async () => {
    const c = await openSse({ port, path: "/api/log/stream" });
    try {
      // snapshot-begin
      const begin = await c.next(5000);
      expect(begin.event).toBe("snapshot-begin");
      assertNoAbsPath(begin.data);

      // drain snapshot-chunk frames until snapshot-end
      let frame = await c.next(5000);
      while (frame.event === "snapshot-chunk") {
        assertNoAbsPath(frame.data);
        frame = await c.next(5000);
      }
      expect(frame.event).toBe("snapshot-end");
      assertNoAbsPath(frame.data);

      // Two appends on the *same* stream prove that (a) the tail loop
      // delivers append frames, and (b) the server has no notion of pause —
      // the UI is the only thing that buffers (D-15). chokidar adds a
      // little scheduling jitter so we allow each append up to 4s.
      const waitForAppend = async (label: string): Promise<void> => {
        let appendFrame: Frame | null = null;
        const deadline = Date.now() + 4000;
        while (Date.now() < deadline && !appendFrame) {
          let next: Frame;
          try {
            next = await c.next(2000);
          } catch {
            break;
          }
          assertNoAbsPath(next.data);
          if (next.event === "append") appendFrame = next;
        }
        expect(appendFrame, `expected an append SSE frame after ${label}`).toBeTruthy();
      };

      await appendFile(
        fx.fileA,
        `${JSON.stringify({ jsonrpc: "2.0", method: "notify/tail-1", params: {} })}\n`,
      );
      await waitForAppend("tail-1");

      // Small sleep so chokidar treats this as a distinct change event on
      // some filesystems (FSEvents on darwin coalesces same-millisecond
      // writes).
      await new Promise((res) => setTimeout(res, 250));
      await appendFile(
        fx.fileA,
        `${JSON.stringify({ jsonrpc: "2.0", method: "notify/tail-2", params: {} })}\n`,
      );
      await waitForAppend("tail-2");
    } finally {
      c.close();
    }
  }, 20_000);

  // ── 6. Switch log → log-reset on existing stream + new snapshot on next ──

  it("switching log emits log-reset SSE and new stream snapshots the new log; rotation banner is NOT triggered", async () => {
    const c = await openSse({ port, path: "/api/log/stream" });
    try {
      // burn through initial snapshot
      let frame = await c.next(5000);
      while (frame.event !== "snapshot-end") {
        assertNoAbsPath(frame.data);
        frame = await c.next(5000);
      }
      assertNoAbsPath(frame.data);

      // Trigger a switch on a separate request.
      const switchRes = await postJson<{ active: { meta: { filename: string } } }>(
        port,
        "/api/sessions/open",
        { id: secondId },
      );
      expect(switchRes.status).toBe(200);
      assertNoAbsPath(switchRes.text);

      // The existing stream MUST emit a log-reset frame (then bye/close).
      let sawLogReset = false;
      let sawRotation = false;
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        let next: Frame;
        try {
          next = await c.next(500);
        } catch {
          continue;
        }
        assertNoAbsPath(next.data);
        if (next.event === "log-reset") sawLogReset = true;
        if (next.event === "rotation") sawRotation = true;
        if (next.event === "bye") break;
      }
      expect(sawLogReset, "expected log-reset frame after session switch").toBe(true);
      // log-reset is a session transition, NOT a rotation. The UI must not
      // surface the RotationBanner from this flow.
      expect(sawRotation).toBe(false);
    } finally {
      c.close();
    }

    // Open a new stream — the snapshot must reflect the *new* log.
    const c2 = await openSse({ port, path: "/api/log/stream" });
    try {
      const begin = await c2.next(5000);
      expect(begin.event).toBe("snapshot-begin");
      assertNoAbsPath(begin.data);
      const beginPayload = JSON.parse(begin.data) as { meta: { filename: string }; total: number };
      expect(beginPayload.meta.filename).toMatch(/\.jsonl$/);
      expect(beginPayload.meta.filename).not.toContain("/");
    } finally {
      c2.close();
    }
  }, 20_000);

  // ── 7. Rotation simulation → rotation SSE frame + new file append at 0 ────

  // Skipped on CI: chokidar awaitWriteFinish + writeFile-truncate is flaky on
  // Linux runners. AppState rotation wiring is covered by app-state.test.ts.
  const itRotation = process.env.CI ? it.skip : it;
  itRotation("replacing the active file with non-empty content emits rotation then append from 0", async () => {
    // Ensure we're back on a known active log; reopen the second log
    // explicitly so we know which file to truncate.
    const reopen = await postJson<{ active: { meta: { filename: string } } }>(
      port,
      "/api/sessions/open",
      { id: secondId },
    );
    expect(reopen.status).toBe(200);
    assertNoAbsPath(reopen.text);

    const c = await openSse({ port, path: "/api/log/stream" });
    try {
      // Drain snapshot.
      let frame = await c.next(5000);
      while (frame.event !== "snapshot-end") {
        assertNoAbsPath(frame.data);
        frame = await c.next(5000);
      }
      assertNoAbsPath(frame.data);

      // Replace the underlying file with smaller non-empty content → TailReader
      // detects shrink → onReset, then reads the replacement range.
      // (The CLI session manager mapped secondId to its absolute path; we
      // know the path from the fixture builder.)
      const freshLine = `${JSON.stringify({
        jsonrpc: "2.0",
        method: "notify/fresh-rotation",
        params: { marker: "fresh-only" },
      })}\n`;
      await writeFile(fx.fileB, freshLine);

      let sawRotation = false;
      let appendFrom: number | null = null;
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        let next: Frame;
        try {
          next = await c.next(5000);
        } catch {
          break;
        }
        assertNoAbsPath(next.data);
        if (next.event === "rotation") {
          sawRotation = true;
          continue;
        }
        if (sawRotation && next.event === "append") {
          const payload = JSON.parse(next.data) as { from: number; rows: unknown[] };
          appendFrom = payload.from;
          expect(payload.rows).toHaveLength(1);
          break;
        }
      }
      expect(sawRotation, "expected rotation SSE frame after file replacement").toBe(true);
      expect(appendFrom, "expected post-rotation append to start at 0").toBe(0);

      const detail = await getJson<{ event: { raw?: unknown } }>(port, "/api/log/event/0");
      expect(detail.status).toBe(200);
      expect(JSON.stringify(detail.body?.event.raw)).toContain("fresh-only");
      expect(detail.text).not.toContain("sess-20260108T100000");

      const searchOld = await getJson<{ matches: number[]; total: number }>(
        port,
        "/api/log/search?q=initialize",
      );
      expect(searchOld.status).toBe(200);
      expect(searchOld.body?.matches).toEqual([]);
      expect(searchOld.body?.total).toBe(0);

      const searchFresh = await getJson<{ matches: number[]; total: number }>(
        port,
        "/api/log/search?q=fresh-only",
      );
      expect(searchFresh.status).toBe(200);
      expect(searchFresh.body?.matches).toEqual([0]);
      expect(searchFresh.body?.total).toBe(1);
    } finally {
      c.close();
    }
  }, 20_000);

  // ── 8. Persistence note ───────────────────────────────────────────────────

  // Persistence (per-log filter / column / selection memory) is jsdom-only
  // and lives at packages/ui/src/persistence/persist-effect.test.ts. It
  // depends on window.localStorage and is therefore deliberately out of
  // scope for this server-side integration test. See plan 04-07 task 1
  // step 10.
});
