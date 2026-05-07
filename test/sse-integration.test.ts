// SSE integration test. Boots a real loopback log-server against a fake host
// that we can drive synchronously, connects via Node 22 global EventSource,
// and verifies the snapshot/append/patch handshake end-to-end.

import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import * as http from "node:http";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type AppState, createAppState } from "../packages/server/src/app-state.js";
import { type LogServerHandle, startLogServer } from "../packages/server/src/log-server.js";
import type {
  Direction,
  Disposable,
  HostAdapter,
  LogCandidate,
  LogHandle,
} from "../packages/shared/src/index.js";

interface FakeHost extends HostAdapter {
  push(text: string): void;
}

function makeFakeHost(path: string): FakeHost {
  let sink: ((bytes: Uint8Array) => void) | null = null;
  return {
    discoverLogs: async (): Promise<LogCandidate[]> => [],
    openLog: async (_p: string): Promise<LogHandle> => ({ id: path }),
    watchLog: (_h, onChunk) => {
      sink = onChunk;
      return {
        dispose: () => {
          sink = null;
        },
      } satisfies Disposable;
    },
    close: async () => {},
    push(text) {
      if (!sink) throw new Error("watchLog not subscribed");
      sink(new TextEncoder().encode(text));
    },
  };
}

function inferDir(raw: unknown): Direction {
  const r = raw as { method?: unknown; result?: unknown; error?: unknown };
  if (r && (r.result !== undefined || r.error !== undefined)) return "s2c";
  return "c2s";
}

interface Frame {
  event: string;
  data: string;
}

/**
 * Minimal SSE client built on Node's http module. EventSource-globals exist
 * in Node 22 but their lifecycle is awkward inside Vitest — this works the
 * same with no extra dep and lets the test wait deterministically.
 */
function openSseClient(opts: {
  port: number;
  path: string;
  hostHeader: string;
}): Promise<{ close(): void; next(timeoutMs?: number): Promise<Frame>; readonly all: Frame[] }> {
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
        headers: { Host: opts.hostHeader, Accept: "text/event-stream" },
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
              const waiter = waiters.shift();
              if (waiter) waiter(frame);
              else buf.push(frame);
            }
            sep = pending.indexOf("\n\n");
          }
        });
        const close = () => {
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
        const next = (timeoutMs = 2000): Promise<Frame> => {
          const buffered = buf.shift();
          if (buffered) return Promise.resolve(buffered);
          return new Promise<Frame>((res2, rej2) => {
            const t = setTimeout(() => rej2(new Error("SSE next() timeout")), timeoutMs);
            waiters.push((f) => {
              clearTimeout(t);
              res2(f);
            });
          });
        };
        resolveOuter({ close, next, all: buf });
      },
    );
    req.on("error", reject);
    req.end();
  });
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

describe("SSE log stream", () => {
  let appState: AppState | undefined;
  let handle: LogServerHandle | undefined;
  let client: { close(): void } | undefined;

  afterEach(async () => {
    if (client) {
      client.close();
      client = undefined;
    }
    if (handle) {
      await handle.close();
      handle = undefined;
    }
    if (appState) {
      await appState.dispose();
      appState = undefined;
    }
  });

  it("emits snapshot-begin → chunk → end → append → patch end-to-end", async () => {
    const fixturePath = resolve("test/fixtures/phase2-mini.jsonl");
    const fixture = readFileSync(fixturePath, "utf8");
    // Split into request line, then everything else, then the late response.
    const lines = fixture.split("\n").filter((l) => l.length > 0);
    const requestLine = lines[0];
    const responseLine = lines[1];
    if (!requestLine || !responseLine) throw new Error("expected request and response lines");
    const remaining = lines.slice(2);

    const host = makeFakeHost(fixturePath);
    appState = await createAppState({
      host,
      file: fixturePath,
      flushIntervalMs: 0,
      directionInference: inferDir,
    });

    // Push baseline lines BEFORE starting the SSE: request + orphan + parse-err + action.
    host.push(`${requestLine}\n`);
    for (const l of remaining) host.push(`${l}\n`);

    handle = await startLogServer({ appState, port: 0, version: "0.1.0" });

    const c = await openSseClient({
      port: handle.port,
      path: "/api/log/stream",
      hostHeader: `127.0.0.1:${handle.port}`,
    });
    client = c;

    // 1. snapshot-begin
    const begin = await c.next();
    expect(begin.event).toBe("snapshot-begin");
    const beginPayload = JSON.parse(begin.data);
    expect(beginPayload.meta.filename).toBe("phase2-mini.jsonl");
    expect(beginPayload.total).toBeGreaterThanOrEqual(4);
    // T-02-03: no absolute fixture dir leakage.
    expect(begin.data).not.toContain("/Users/");
    expect(begin.data).not.toContain("test/fixtures");

    // 2. snapshot-chunk(s) followed by snapshot-end
    let sawChunk = false;
    let frame = await c.next();
    while (frame.event === "snapshot-chunk") {
      sawChunk = true;
      expect(frame.data).not.toContain("/Users/");
      expect(frame.data).not.toContain("test/fixtures");
      frame = await c.next();
    }
    expect(sawChunk).toBe(true);
    expect(frame.event).toBe("snapshot-end");

    // 3. Push the late response. Expect append THEN patch.
    // Small delay to ensure the server has registered its AppState subscriber.
    await new Promise((r) => setTimeout(r, 50));
    host.push(`${responseLine}\n`);

    let appendSeen = false;
    let patchSeen = false;
    let okPatch: { idx: number; status: string; latencyMs: number | null } | undefined;
    for (let i = 0; i < 6 && !(appendSeen && patchSeen); i++) {
      const f = await c.next(2000);
      if (f.event === "append") {
        appendSeen = true;
        expect(f.data).not.toContain("/Users/");
      } else if (f.event === "patch") {
        const payload = JSON.parse(f.data) as {
          updates: Array<{ idx: number; status: string; latencyMs: number | null }>;
        };
        const upd = payload.updates.find((u) => u.idx === 0);
        if (upd) {
          patchSeen = true;
          okPatch = upd;
        }
      }
    }
    expect(appendSeen).toBe(true);
    expect(patchSeen).toBe(true);
    expect(okPatch?.status).toBe("ok");
    expect(okPatch?.latencyMs ?? -1).toBeGreaterThanOrEqual(0);
  });
});

// Reference Buffer to keep the import tree sane in some Node configurations.
void Buffer;
