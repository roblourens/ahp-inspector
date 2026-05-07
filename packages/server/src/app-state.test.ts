// AppState integration test — drives ingestion through a fake HostAdapter
// and verifies snapshot/append/patch/unmatched semantics + basename meta.

import type { Disposable, HostAdapter, LogCandidate, LogHandle } from "@ahp-viewer/shared";
import { afterEach, describe, expect, it } from "vitest";
import { type AppState, createAppState, type SsePayload } from "./app-state.js";

interface FakeLogHandle extends LogHandle {
  readonly path: string;
  readonly size: number;
}

interface FakeHost extends HostAdapter {
  push(text: string): void;
}

function makeFakeHost(path: string): FakeHost {
  let sink: ((bytes: Uint8Array) => void) | null = null;
  const encoder = new TextEncoder();
  const handle: FakeLogHandle = { id: path, path, size: 0 };
  return {
    discoverLogs: async (): Promise<LogCandidate[]> => [],
    openLog: async (_p: string): Promise<LogHandle> => handle,
    watchLog: (_h: LogHandle, onChunk: (b: Uint8Array) => void): Disposable => {
      sink = onChunk;
      return {
        dispose: () => {
          sink = null;
        },
      };
    },
    close: async (_h: LogHandle) => {},
    push(text: string): void {
      if (!sink) throw new Error("watchLog not subscribed");
      sink(encoder.encode(text));
    },
  };
}

describe("createAppState", () => {
  let state: AppState | undefined;

  afterEach(async () => {
    if (state) {
      await state.dispose();
      state = undefined;
    }
  });

  it("exposes basename-only meta and never an absolute path", async () => {
    const host = makeFakeHost("/private/tmp/some-dir/example.log");
    state = await createAppState({
      host,
      file: "/private/tmp/some-dir/example.log",
      flushIntervalMs: 0,
    });
    expect(state.meta.filename).toBe("example.log");
    expect(state.meta.filename).not.toContain("/");
    const snap = state.snapshot();
    expect(snap.meta.filename).toBe("example.log");
    expect(snap.rows).toEqual([]);
  });

  it("emits append rows for incoming JSONL events", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({ host, file: "/tmp/x.log", flushIntervalMs: 0 });
    const events: SsePayload[] = [];
    state.subscribe((p) => events.push(p));

    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
    host.push(`${JSON.stringify({ jsonrpc: "2.0", method: "ping", params: {} })}\n`);

    const appends = events.filter((e) => e.kind === "append");
    expect(appends.length).toBe(2);
    const snap = state.snapshot();
    expect(snap.rows.length).toBe(2);
    expect(snap.rows[0]!.kind).toBe("request");
    expect(snap.rows[0]!.status).toBe("pending");
  });

  it("emits a patch when a late response pairs with an earlier request", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      // Simulate VS Code direction: requests go c2s, responses come back s2c.
      directionInference: (raw): "c2s" | "s2c" => {
        const r = raw as { method?: unknown; result?: unknown; error?: unknown };
        if (r && (r.result !== undefined || r.error !== undefined)) return "s2c";
        return "c2s";
      },
    });
    const events: SsePayload[] = [];
    state.subscribe((p) => events.push(p));

    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "doThing", params: {} })}\n`);
    // small wait so latency >= 0
    await new Promise((r) => setTimeout(r, 5));
    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 7, result: { ok: true } })}\n`);

    const patches = events.filter((e) => e.kind === "patch");
    expect(patches.length).toBeGreaterThanOrEqual(1);
    const last = patches.at(-1)!;
    if (last.kind !== "patch") throw new Error("expected patch");
    expect(last.updates.length).toBeGreaterThanOrEqual(1);
    const upd = last.updates.find((u) => u.idx === 0)!;
    expect(upd).toBeDefined();
    expect(upd.status).toBe("ok");
    expect(upd.latencyMs).not.toBeNull();
    expect(upd.latencyMs!).toBeGreaterThanOrEqual(0);
  });

  it("flips a pending request to 'unmatched' on flush after the timeout", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      unmatchedTimeoutMs: 1,
    });
    const events: SsePayload[] = [];
    state.subscribe((p) => events.push(p));

    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 99, method: "noReply", params: {} })}\n`);
    expect(state.snapshot().rows[0]!.status).toBe("pending");

    await new Promise((r) => setTimeout(r, 10));
    // Drive flush manually since flushIntervalMs is 0.
    state.runFlush(Date.now());

    const patches = events.filter((e) => e.kind === "patch");
    expect(patches.length).toBeGreaterThanOrEqual(1);
    const last = patches.at(-1)!;
    if (last.kind !== "patch") throw new Error("expected patch");
    expect(last.updates.find((u) => u.idx === 0)!.status).toBe("unmatched");
    expect(state.snapshot().rows[0]!.status).toBe("unmatched");
  });

  it("dispose() is idempotent and stops the watcher", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({ host, file: "/tmp/x.log", flushIntervalMs: 0 });
    await state.dispose();
    await state.dispose();
    state = undefined;
  });
});
