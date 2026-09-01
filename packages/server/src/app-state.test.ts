// AppState integration test — drives ingestion through a fake HostAdapter
// and verifies snapshot/append/patch/unmatched semantics + basename meta.

import {
  ActionType,
  ReconnectResultType,
  SessionLifecycle,
  SessionStatus,
  TerminalClaimKind,
} from "@ahp-inspector/protocol";
import type { DiscoveryResult, Disposable, HostAdapter, LogHandle } from "@ahp-inspector/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppState, createAppState, type SsePayload } from "./app-state.js";

interface FakeLogHandle extends LogHandle {
  readonly path: string;
  readonly size: number;
}

interface FakeHost extends HostAdapter {
  push(text: string): void;
  pushBytes(bytes: Uint8Array): void;
  triggerInitialReadStart(info: { totalBytes: number }): void;
  triggerInitialReadProgress(info: { loadedBytes: number; totalBytes: number }): void;
  triggerInitialReadComplete(info: { loadedBytes: number; totalBytes: number }): void;
  /** Phase 4: directly invoke the active sink's onReset (if WatchSink). */
  triggerReset(info: { newSize: number; reason: "shrink" | "rename" }): void;
  /** Phase 4: directly invoke the active sink's onError (if WatchSink). */
  triggerError(err: Error, fatal: boolean): void;
}

type WatchSinkObj = {
  onChunk(bytes: Uint8Array, byteOffset: number): void;
  onInitialReadStart?(info: { totalBytes: number }): void;
  onInitialReadProgress?(info: { loadedBytes: number; totalBytes: number }): void;
  onInitialReadComplete?(info: { loadedBytes: number; totalBytes: number }): void;
  onReset(info: { newSize: number; reason: "shrink" | "rename" }): void;
  onError(err: Error, fatal: boolean): void;
};

function makeFakeHost(path: string, close: () => Promise<void> = async () => {}): FakeHost {
  let sink: WatchSinkObj | null = null;
  let offset = 0;
  const encoder = new TextEncoder();
  const handle: FakeLogHandle = { id: path, path, size: 0 };
  return {
    discoverLogs: async (): Promise<DiscoveryResult> => ({ candidates: [], truncated: false }),
    openLog: async (_p: string): Promise<LogHandle> => handle,
    watchLog: (_h: LogHandle, sinkOrChunk): Disposable => {
      if (typeof sinkOrChunk === "function") {
        const fn = sinkOrChunk;
        sink = {
          onChunk: (bytes) => fn(bytes),
          onReset: () => {},
          onError: () => {},
        };
      } else {
        sink = sinkOrChunk as WatchSinkObj;
      }
      return {
        dispose: () => {
          sink = null;
        },
      };
    },
    close,
    push(text: string): void {
      this.pushBytes(encoder.encode(text));
    },
    pushBytes(bytes: Uint8Array): void {
      if (!sink) throw new Error("watchLog not subscribed");
      sink.onChunk(bytes, offset);
      offset += bytes.byteLength;
    },
    triggerInitialReadStart(info): void {
      if (!sink) throw new Error("watchLog not subscribed");
      sink.onInitialReadStart?.(info);
    },
    triggerInitialReadProgress(info): void {
      if (!sink) throw new Error("watchLog not subscribed");
      sink.onInitialReadProgress?.(info);
    },
    triggerInitialReadComplete(info): void {
      if (!sink) throw new Error("watchLog not subscribed");
      sink.onInitialReadComplete?.(info);
    },
    triggerReset(info): void {
      if (!sink) throw new Error("watchLog not subscribed");
      offset = 0;
      sink.onReset(info);
    },
    triggerError(err, fatal): void {
      if (!sink) throw new Error("watchLog not subscribed");
      sink.onError(err, fatal);
    },
  };
}

function ahpDirection(raw: unknown): "c2s" | "s2c" {
  const r = raw as { method?: unknown; result?: unknown; error?: unknown };
  return r && (r.method === "action" || r.result !== undefined || r.error !== undefined)
    ? "s2c"
    : "c2s";
}

function initializeRequest(id = 1): string {
  return `${JSON.stringify({ jsonrpc: "2.0", id, method: "initialize", params: {} })}\n`;
}

function initializeRootSnapshotResponse(id = 1): string {
  return `${JSON.stringify({
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: "0.1.0",
      serverSeq: 0,
      snapshots: [{ resource: ROOT, fromSeq: 0, state: rootSnapshotState() }],
    },
  })}\n`;
}

function expectNoReplayFields(json: string): void {
  expect(json).not.toContain('"resources"');
  expect(json).not.toContain('"diagnostics"');
  expect(json).not.toContain('"intents"');
  expect(json).not.toContain('"cache"');
  expect(json).not.toContain('"state":{');
}

const ROOT = "agenthost:/root";
const SESSION = "copilot:/session/1";
const TERMINAL = "terminal:/1";

function jsonl(raw: unknown): string {
  return `${JSON.stringify(raw)}\n`;
}

function rootSnapshotState(activeSessions = 0): Record<string, unknown> {
  return { agents: [], activeSessions };
}

function sessionSnapshotState(title = "Session"): Record<string, unknown> {
  return {
    summary: {
      resource: SESSION,
      provider: "copilot",
      title,
      status: SessionStatus.Idle,
      createdAt: 1,
      modifiedAt: 1,
    },
    lifecycle: SessionLifecycle.Creating,
    turns: [],
  };
}

function terminalSnapshotState(): Record<string, unknown> {
  return {
    title: "Terminal",
    content: [],
    claim: { kind: TerminalClaimKind.Client, clientId: "client-1" },
  };
}

function initializeFullSnapshotResponse(id = 1): string {
  return jsonl({
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: "0.1.0",
      serverSeq: 0,
      snapshots: [
        { resource: ROOT, fromSeq: 0, state: rootSnapshotState() },
        { resource: SESSION, fromSeq: 0, state: sessionSnapshotState() },
        { resource: TERMINAL, fromSeq: 0, state: terminalSnapshotState() },
      ],
    },
  });
}

function serverSessionTitleAction(serverSeq: number, title: string): string {
  return jsonl({
    jsonrpc: "2.0",
    method: "action",
    params: {
      channel: SESSION,
      serverSeq,
      origin: { clientId: "client-1", clientSeq: 99 },
      action: { type: ActionType.SessionTitleChanged, title },
    },
  });
}

function rootActiveSessionsAction(serverSeq: number, activeSessions: number): string {
  return jsonl({
    jsonrpc: "2.0",
    method: "action",
    params: {
      channel: ROOT,
      serverSeq,
      action: { type: ActionType.RootActiveSessionsChanged, activeSessions },
    },
  });
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
    const firstRow = snap.rows[0];
    if (!firstRow) throw new Error("expected first row");
    expect(firstRow.kind).toBe("request");
    expect(firstRow.status).toBe("pending");
  });

  it("ingests a valid final JSONL record without a trailing newline at snapshot EOF", async () => {
    const host = makeFakeHost("/tmp/final.jsonl");
    state = await createAppState({ host, file: "/tmp/final.jsonl", flushIntervalMs: 0 });
    const finalRecord = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "finalRecord",
      params: {},
    });

    host.push(finalRecord);
    expect(state.snapshot().rows).toEqual([]);
    host.triggerInitialReadComplete({
      loadedBytes: Buffer.byteLength(finalRecord),
      totalBytes: Buffer.byteLength(finalRecord),
    });

    expect(state.snapshot().rows).toHaveLength(1);
    expect(state.snapshot().rows[0]?.method).toBe("finalRecord");

    // A writer may append the missing terminator later; it must not create an
    // empty parse-error row or duplicate the already-finalized record.
    const nextRecord = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "nextRecord",
      params: {},
    });
    host.push(`\n${nextRecord}\n`);
    expect(state.snapshot().rows).toHaveLength(2);
    expect(state.eventAt(1)).toMatchObject({
      byteOffset: Buffer.byteLength(finalRecord) + 1,
      byteLength: Buffer.byteLength(nextRecord),
    });
  });

  it("does not finalize an incomplete live line at initial EOF", async () => {
    const host = makeFakeHost("/tmp/live-partial.jsonl");
    state = await createAppState({ host, file: "/tmp/live-partial.jsonl", flushIntervalMs: 0 });
    const partial = '{"jsonrpc":"2.0","id":1,"method":"still-writing"';
    host.push(partial);
    host.triggerInitialReadComplete({
      loadedBytes: Buffer.byteLength(partial),
      totalBytes: Buffer.byteLength(partial),
    });
    expect(state.snapshot().rows).toEqual([]);

    host.push(',"params":{}}\n');
    expect(state.snapshot().rows).toHaveLength(1);
    expect(state.snapshot().rows[0]?.method).toBe("still-writing");
  });

  it("tracks exact offsets across mixed endings, split CRLF, and split UTF-8", async () => {
    const host = makeFakeHost("/tmp/mixed.jsonl");
    state = await createAppState({ host, file: "/tmp/mixed.jsonl", flushIntervalMs: 0 });
    const first = JSON.stringify({
      jsonrpc: "2.0",
      method: "notice",
      params: { value: "😀é" },
    });
    const second = JSON.stringify({ jsonrpc: "2.0", method: "second", params: {} });
    const third = JSON.stringify({ jsonrpc: "2.0", method: "third", params: {} });
    const bytes = new TextEncoder().encode(`${first}\r\n${second}\n${third}`);
    const emojiStart = bytes.indexOf(0xf0);
    if (emojiStart < 0) throw new Error("expected encoded emoji");

    host.pushBytes(bytes.slice(0, emojiStart + 2));
    host.pushBytes(bytes.slice(emojiStart + 2, Buffer.byteLength(first) + 1));
    host.pushBytes(bytes.slice(Buffer.byteLength(first) + 1, Buffer.byteLength(first) + 2));
    host.pushBytes(bytes.slice(Buffer.byteLength(first) + 2));
    host.triggerInitialReadComplete({
      loadedBytes: bytes.byteLength,
      totalBytes: bytes.byteLength,
    });

    expect(state.snapshot().rows).toHaveLength(3);
    expect(state.eventAt(0)).toMatchObject({
      byteOffset: 0,
      byteLength: Buffer.byteLength(first),
    });
    expect(state.eventAt(1)).toMatchObject({
      byteOffset: Buffer.byteLength(first) + 2,
      byteLength: Buffer.byteLength(second),
    });
    expect(state.eventAt(2)).toMatchObject({
      byteOffset: Buffer.byteLength(first) + 2 + Buffer.byteLength(second) + 1,
      byteLength: Buffer.byteLength(third),
    });
  });

  it("accounts for a UTF-8 BOM that is split across input chunks", async () => {
    const host = makeFakeHost("/tmp/bom.jsonl");
    state = await createAppState({ host, file: "/tmp/bom.jsonl", flushIntervalMs: 0 });
    const first = JSON.stringify({ jsonrpc: "2.0", method: "first", params: {} });
    const second = JSON.stringify({ jsonrpc: "2.0", method: "second", params: {} });
    const bytes = new TextEncoder().encode(`\uFEFF${first}\n${second}\n`);

    host.pushBytes(bytes.slice(0, 2));
    host.pushBytes(bytes.slice(2));

    expect(state.eventAt(0)).toMatchObject({
      byteOffset: 3,
      byteLength: Buffer.byteLength(first),
    });
    expect(state.eventAt(1)).toMatchObject({
      byteOffset: 3 + Buffer.byteLength(first) + 1,
      byteLength: Buffer.byteLength(second),
    });
  });

  it("appends reshaped tool actions without EventStore subscriber warnings", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const host = makeFakeHost("/tmp/channel-actions.log");
    state = await createAppState({
      host,
      file: "/tmp/channel-actions.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });

    host.push(
      jsonl({
        jsonrpc: "2.0",
        method: "action",
        params: {
          channel: SESSION,
          serverSeq: 17,
          action: {
            type: "session/toolCallDelta",
            turnId: "turn-current",
            toolCallId: "tool-delta",
          },
        },
      }),
    );
    host.push(
      jsonl({
        jsonrpc: "2.0",
        method: "action",
        params: {
          channel: SESSION,
          serverSeq: 18,
          action: {
            type: "session/toolCallContentChanged",
            turnId: "turn-current",
            toolCallId: "tool-content",
          },
        },
      }),
    );

    expect(state.snapshot().rows.map((row) => row.summary)).toEqual([
      "tool delta tool-delta",
      "tool content tool-content",
    ]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("emits trustworthy optional load-progress percentages from initial-read bytes", async () => {
    const host = makeFakeHost("/private/tmp/progress.log");
    state = await createAppState({ host, file: "/private/tmp/progress.log", flushIntervalMs: 0 });
    const events: SsePayload[] = [];
    state.subscribe((payload) => events.push(payload));

    host.triggerInitialReadStart({ totalBytes: 100 });
    host.push(initializeRequest());
    host.triggerInitialReadProgress({ loadedBytes: 50, totalBytes: 100 });
    host.triggerInitialReadComplete({ loadedBytes: 100, totalBytes: 100 });

    const progress = events.filter((event) => event.kind === "load-progress");
    expect(progress).toMatchObject([
      {
        kind: "load-progress",
        phase: "loading",
        loadedRows: 0,
        loadedBytes: 0,
        totalBytes: 100,
        percent: 0,
      },
      {
        kind: "load-progress",
        phase: "loading",
        loadedRows: 1,
        loadedBytes: 50,
        totalBytes: 100,
        percent: 50,
      },
      {
        kind: "load-progress",
        phase: "complete",
        loadedRows: 1,
        loadedBytes: 100,
        totalBytes: 100,
        percent: 100,
      },
    ]);
    expect(state.snapshot().loadProgress).toMatchObject({ phase: "complete", percent: 100 });
    expect(JSON.stringify(progress)).not.toContain("/private/tmp");
  });

  it("omits percentage when an empty initial read has no usable denominator", async () => {
    const host = makeFakeHost("/tmp/empty.log");
    state = await createAppState({ host, file: "/tmp/empty.log", flushIntervalMs: 0 });
    const events: SsePayload[] = [];
    state.subscribe((payload) => events.push(payload));

    host.triggerInitialReadStart({ totalBytes: 0 });
    host.triggerInitialReadComplete({ loadedBytes: 0, totalBytes: 0 });

    const progress = events.filter((event) => event.kind === "load-progress");
    expect(progress).toMatchObject([
      { phase: "loading", loadedRows: 0, loadedBytes: 0, totalBytes: 0 },
      { phase: "complete", loadedRows: 0, loadedBytes: 0, totalBytes: 0 },
    ]);
    for (const payload of progress) expect("percent" in payload).toBe(false);
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
    const last = patches.at(-1);
    if (!last) throw new Error("expected patch payload");
    if (last.kind !== "patch") throw new Error("expected patch");
    expect(last.updates.map((update) => update.idx)).toEqual([0]);
    const upd = last.updates.find((u) => u.idx === 0);
    if (!upd) throw new Error("expected patch update for row 0");
    expect(upd.status).toBe("ok");
    expect(upd.latencyMs).not.toBeNull();
    expect(upd.pairIdx).toBe(1);
    if (upd.latencyMs === null) throw new Error("expected latency");
    expect(upd.latencyMs).toBeGreaterThanOrEqual(0);
    const rows = state.snapshot().rows;
    expect(rows[0]?.pairIdx).toBe(1);
    expect(rows[1]?.pairIdx).toBe(0);
    expect(rows[1]?.summary).toBe("doThing result ok=true");
  });

  it("projects pair metadata when only the request carries a session", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });

    host.push(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "ping",
        params: { sessionId: "session-a" },
      })}\n`,
    );
    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 7, result: {} })}\n`);

    const rows = state.snapshot().rows;
    expect(rows[0]?.pairIdx).toBe(1);
    expect(rows[1]?.pairIdx).toBe(0);
  });

  it("patches only the displaced prior request during duplicate request churn", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({ host, file: "/tmp/x.log", flushIntervalMs: 0 });
    const events: SsePayload[] = [];
    state.subscribe((payload) => events.push(payload));

    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "first", params: {} })}\n`);
    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "unaffected", params: {} })}\n`);
    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "replacement", params: {} })}\n`);

    const patch = events.filter((event) => event.kind === "patch").at(-1);
    if (!patch || patch.kind !== "patch") throw new Error("expected displaced-row patch");
    expect(patch.updates).toMatchObject([{ idx: 0, status: "orphan" }]);
    expect(patch.updates.map((update) => update.idx)).toEqual([0]);
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
    const pendingRow = state.snapshot().rows[0];
    if (!pendingRow) throw new Error("expected pending row");
    expect(pendingRow.status).toBe("pending");

    await new Promise((r) => setTimeout(r, 10));
    // Drive flush manually since flushIntervalMs is 0.
    state.runFlush(Date.now());

    const patches = events.filter((e) => e.kind === "patch");
    expect(patches.length).toBeGreaterThanOrEqual(1);
    const last = patches.at(-1);
    if (!last) throw new Error("expected unmatched patch");
    if (last.kind !== "patch") throw new Error("expected patch");
    const update = last.updates.find((u) => u.idx === 0);
    if (!update) throw new Error("expected unmatched update");
    expect(update.status).toBe("unmatched");
    const unmatchedRow = state.snapshot().rows[0];
    if (!unmatchedRow) throw new Error("expected unmatched row");
    expect(unmatchedRow.status).toBe("unmatched");
  });

  it("keeps timeout patches bounded to the changed row after unaffected history", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      unmatchedTimeoutMs: 1,
    });
    const events: SsePayload[] = [];
    state.subscribe((payload) => events.push(payload));

    for (let idx = 0; idx < 20; idx++) {
      host.push(`${JSON.stringify({ jsonrpc: "2.0", method: "notice", params: { idx } })}\n`);
    }
    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 99, method: "noReply", params: {} })}\n`);

    state.runFlush(Number.MAX_SAFE_INTEGER);

    const patches = events.filter((event) => event.kind === "patch");
    const lastPatch = patches.at(-1);
    if (!lastPatch || lastPatch.kind !== "patch") throw new Error("expected timeout patch");
    expect(lastPatch.updates).toMatchObject([{ idx: 20, status: "unmatched" }]);
    expect(lastPatch.updates).toHaveLength(1);
    expectNoReplayFields(JSON.stringify(lastPatch.updates));
  });

  it("dispose() is idempotent and stops the watcher", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({ host, file: "/tmp/x.log", flushIntervalMs: 0 });
    await state.dispose();
    await state.dispose();
    state = undefined;
  });

  it("awaits and surfaces host shutdown failures", async () => {
    const host = makeFakeHost("/tmp/x.log", async () => {
      throw new Error("shutdown failed");
    });
    state = await createAppState({ host, file: "/tmp/x.log", flushIntervalMs: 0 });
    await expect(state.dispose()).rejects.toThrow("shutdown failed");
    state = undefined;
  });

  it("stateAtIndex(targetIndex: number) returns replay result, totalEvents, and cache.hit metadata", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });
    host.push(initializeRequest());
    host.push(initializeRootSnapshotResponse());

    const first = state.stateAtIndex(1);
    const second = state.stateAtIndex(1);

    expect(first.totalEvents).toBe(2);
    expect(first.cache.hit).toBe(false);
    expect(first.result.resources[0]?.key).toEqual({ kind: "root", uri: "agenthost:/root" });
    expect(second.cache.hit).toBe(true);
    expect(second.result).toEqual(first.result);
  });

  it("tracks serverSeq gaps globally and preserves the actual previous sequence", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });

    host.push(serverSessionTitleAction(1, "One"));
    host.push(rootActiveSessionsAction(2, 1));
    host.push(serverSessionTitleAction(3, "Three"));
    host.push(serverSessionTitleAction(5, "Five"));

    const rows = state.snapshot().rows;
    expect(rows[0]?.gapBefore).toBe(false);
    expect(rows[1]?.gapBefore).toBe(false);
    expect(rows[2]?.gapBefore).toBe(false);
    expect(rows[3]?.gapBefore).toBe(true);
    expect(rows[3]?.previousServerSeq).toBe(3);
    expect(rows[3]?.serverSeq).toBe(5);
  });

  it("clears stateAtIndex cache on rotation reset", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });

    host.push(initializeRequest());
    host.push(initializeRootSnapshotResponse());
    expect(state.stateAtIndex(1).cache.hit).toBe(false);
    expect(state.stateAtIndex(1).cache.hit).toBe(true);

    host.triggerReset({ newSize: 0, reason: "shrink" });
    host.push(initializeRequest(2));

    const replacement = state.stateAtIndex(0);
    expect(replacement.cache.hit).toBe(false);
    expect(replacement.totalEvents).toBe(1);
  });

  it("clears stateAtIndex cache during dispose without breaking idempotent dispose", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });

    host.push(initializeRequest());
    host.push(initializeRootSnapshotResponse());
    expect(state.stateAtIndex(1).cache.hit).toBe(false);

    await state.dispose();
    await state.dispose();
    state = undefined;
  });

  it("replays synthetic JSONL initialize snapshots, server actions, client intents, and reconnect replay", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });

    host.push(initializeRequest());
    host.push(initializeFullSnapshotResponse());
    host.push(jsonl({ jsonrpc: "2.0", id: 2, method: "subscribe", params: { resource: SESSION } }));
    host.push(
      jsonl({
        jsonrpc: "2.0",
        id: 2,
        result: { snapshot: { resource: SESSION, fromSeq: 0, state: sessionSnapshotState() } },
      }),
    );
    host.push(
      jsonl({
        jsonrpc: "2.0",
        method: "dispatchAction",
        params: {
          channel: SESSION,
          clientSeq: 99,
          action: { type: ActionType.SessionTitleChanged, title: "Client title" },
        },
      }),
    );
    host.push(serverSessionTitleAction(1, "Server title"));
    host.push(jsonl({ jsonrpc: "2.0", id: 3, method: "reconnect", params: {} }));
    host.push(
      jsonl({
        jsonrpc: "2.0",
        id: 3,
        result: {
          type: ReconnectResultType.Replay,
          actions: [
            {
              channel: SESSION,
              serverSeq: 2,
              action: {
                type: ActionType.SessionTitleChanged,
                title: "Replay title",
              },
            },
          ],
          missing: ["copilot:/gone"],
        },
      }),
    );

    const replayed = state.stateAtIndex(7);
    const session = replayed.result.resources.find((item) => item.key.uri === SESSION);
    expect(replayed.totalEvents).toBe(8);
    expect(session?.confidence).toBe("complete");
    expect(session?.state).toMatchObject({ summary: { title: "Replay title" } });
    expect(replayed.result.intents[0]).toMatchObject({
      clientSeq: 99,
      ignored: true,
      acceptedByServerSeq: 1,
    });
    expect(replayed.result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["ignored-client-intent", "reconnect-missing-resource"]),
    );
  });

  it("preserves cached historical replay results across live append", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });

    host.push(initializeRequest());
    host.push(initializeRootSnapshotResponse());
    expect(state.stateAtIndex(1).cache.hit).toBe(false);
    expect(state.stateAtIndex(1).cache.hit).toBe(true);

    host.push(rootActiveSessionsAction(1, 3));

    expect(state.stateAtIndex(1).cache.hit).toBe(true);
    const latest = state.stateAtIndex(2);
    const root = latest.result.resources.find((item) => item.key.uri === ROOT);
    expect(latest.cache.hit).toBe(false);
    expect(root?.state).toMatchObject({ activeSessions: 3 });
  });

  it("keeps ingesting while UI payload consumption is paused", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });
    const captured: SsePayload[] = [];
    state.subscribe((p) => captured.push(p));

    host.push(initializeRequest());
    host.push(initializeRootSnapshotResponse());
    const unreadPayloadCount = captured.length;
    host.push(rootActiveSessionsAction(1, 5));

    const latest = state.stateAtIndex(2);
    const root = latest.result.resources.find((item) => item.key.uri === ROOT);
    expect(unreadPayloadCount).toBeGreaterThan(0);
    expect(captured.length).toBeGreaterThan(unreadPayloadCount);
    expect(latest.totalEvents).toBe(3);
    expect(root?.state).toMatchObject({ activeSessions: 5 });
  });

  it("Calling stateAtIndex does not emit SSE payloads or add replay resources diagnostics intents cache state fields", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });
    const captured: SsePayload[] = [];
    state.subscribe((p) => captured.push(p));

    host.push(initializeRequest());
    host.push(initializeRootSnapshotResponse());
    const appendPayloads = captured.filter((p) => p.kind === "append");
    for (const append of appendPayloads) {
      expectNoReplayFields(JSON.stringify(append.rows));
    }
    captured.length = 0;

    state.stateAtIndex(1);

    expect(captured).toEqual([]);
    expectNoReplayFields(JSON.stringify(state.snapshot().rows));
  });
});

describe("AppState wire timestamp ingest (Phase 16)", () => {
  let state: AppState | undefined;

  afterEach(async () => {
    if (state) {
      await state.dispose();
      state = undefined;
    }
  });

  it("uses _ahpLog.ts as the row timestamp when present", async () => {
    const host = makeFakeHost("/tmp/wire.log");
    state = await createAppState({
      host,
      file: "/tmp/wire.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });
    const wireTs = "2026-05-11T17:11:14.356Z";
    host.push(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "ping",
        params: {},
        _ahpLog: { ts: wireTs, dir: "c2s", byteLength: 1 },
      })}\n`,
    );
    const row = state.snapshot().rows[0];
    if (!row) throw new Error("expected row");
    expect(row.ts).toBe(Date.parse(wireTs));
    expect(row.tsFmt).toBe("17:11:14.356");
  });

  it("honours _ahpLog.dir over the directionInference callback", async () => {
    const host = makeFakeHost("/tmp/wire.log");
    state = await createAppState({
      host,
      file: "/tmp/wire.log",
      flushIntervalMs: 0,
      // Always claim c2s — wire dir should win.
      directionInference: () => "c2s",
    });
    host.push(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "ping",
        params: {},
        _ahpLog: { ts: "2026-05-11T17:11:14.356Z", dir: "s2c" },
      })}\n`,
    );
    const row = state.snapshot().rows[0];
    if (!row) throw new Error("expected row");
    expect(row.dir).toBe("s2c");
  });

  it("falls back to ingest time and inferred direction when _ahpLog is absent", async () => {
    const host = makeFakeHost("/tmp/wire.log");
    state = await createAppState({
      host,
      file: "/tmp/wire.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });
    const fakeNow = 1_700_000_000_000;
    const spy = vi.spyOn(Date, "now").mockReturnValue(fakeNow);
    try {
      host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } })}\n`);
    } finally {
      spy.mockRestore();
    }
    const row = state.snapshot().rows[0];
    if (!row) throw new Error("expected row");
    expect(row.ts).toBe(fakeNow);
    // ahpDirection treats `result` as s2c.
    expect(row.dir).toBe("s2c");
  });

  it("falls back to ingest time when _ahpLog.ts is malformed", async () => {
    const host = makeFakeHost("/tmp/wire.log");
    state = await createAppState({
      host,
      file: "/tmp/wire.log",
      flushIntervalMs: 0,
      directionInference: ahpDirection,
    });
    const fakeNow = 1_700_000_000_000;
    const spy = vi.spyOn(Date, "now").mockReturnValue(fakeNow);
    try {
      host.push(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "ping",
          params: {},
          _ahpLog: { ts: "not-a-date" },
        })}\n`,
      );
    } finally {
      spy.mockRestore();
    }
    const row = state.snapshot().rows[0];
    if (!row) throw new Error("expected row");
    expect(row.ts).toBe(fakeNow);
    expect(row.kind).toBe("request");
  });
});

describe("AppState rotation/watch-error propagation (Phase 4 INGEST-04)", () => {
  let state: AppState | undefined;

  afterEach(async () => {
    if (state) {
      await state.dispose();
      state = undefined;
    }
  });

  it("emits rotation SsePayload when host signals onReset", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({ host, file: "/tmp/x.log", flushIntervalMs: 0 });
    const captured: SsePayload[] = [];
    state.subscribe((p) => captured.push(p));

    host.triggerReset({ newSize: 0, reason: "shrink" });
    host.triggerReset({ newSize: 42, reason: "rename" });

    const rotations = captured.filter((p) => p.kind === "rotation");
    expect(rotations.length).toBe(2);
    expect(rotations[0]).toMatchObject({ kind: "rotation", newSize: 0, reason: "shrink" });
    expect(rotations[1]).toMatchObject({ kind: "rotation", newSize: 42, reason: "rename" });
  });

  it("emits watch-error SsePayload with mapped code", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({ host, file: "/tmp/x.log", flushIntervalMs: 0 });
    const captured: SsePayload[] = [];
    state.subscribe((p) => captured.push(p));

    host.triggerError(new Error("boom"), true);
    host.triggerError(new Error("transient"), false);

    const errors = captured.filter((p) => p.kind === "watch-error");
    expect(errors.length).toBe(2);
    expect(errors.find((p) => p.kind === "watch-error" && p.code === "watch-fatal")).toBeTruthy();
    expect(errors.find((p) => p.kind === "watch-error" && p.code === "read-error")).toBeTruthy();
  });

  it("never exposes filesystem paths through watch-error payloads", async () => {
    class TypedReadError extends Error {
      readonly code = "read-stream-failed";
      readonly systemCode = "EACCES";
    }
    const host = makeFakeHost("/private/tmp/secret/session/log.jsonl");
    state = await createAppState({
      host,
      file: "/private/tmp/secret/session/log.jsonl",
      flushIntervalMs: 0,
    });
    const captured: SsePayload[] = [];
    state.subscribe((payload) => captured.push(payload));

    host.triggerError(
      new TypedReadError("EACCES: permission denied, open '/private/tmp/secret/session/log.jsonl'"),
      false,
    );
    host.triggerError(
      new Error("ENOENT: no such file, stat '/private/tmp/secret/session/log.jsonl'"),
      true,
    );

    const errors = captured.filter((payload) => payload.kind === "watch-error");
    expect(errors).toEqual([
      {
        kind: "watch-error",
        code: "read-stream-failed",
        message: "Unable to read log data (EACCES).",
      },
      {
        kind: "watch-error",
        code: "watch-fatal",
        message: "Unable to watch the log for changes.",
      },
    ]);
    expect(JSON.stringify(errors)).not.toContain("/private/tmp");
  });

  it("skips an oversized JSONL line, emits a watch-error, and continues ingesting subsequent events", async () => {
    const host = makeFakeHost("/tmp/big.log");
    state = await createAppState({ host, file: "/tmp/big.log", flushIntervalMs: 0 });
    const captured: SsePayload[] = [];
    state.subscribe((p) => captured.push(p));

    // First, a normal request so we have a baseline ingested row.
    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "before", params: {} })}\n`);

    // Now feed an oversized line in chunks (simulates TailReader behavior on
    // a 80MB single-line JSONL — the splitter's 16MB tail buffer would
    // throw without tolerant mode).
    const MB = 1024 * 1024;
    const chunk = "x".repeat(MB);
    // 20 chunks * 1MB = 20MB > MAX_BUF_BYTES (16MB).
    for (let i = 0; i < 20; i++) host.push(chunk);
    host.triggerInitialReadComplete({ loadedBytes: 20 * MB, totalBytes: 20 * MB });
    // Terminate the oversized line.
    host.push("\n");

    // Follow with a normal event that MUST still be ingested.
    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "after", params: {} })}\n`);

    // Rows: only the two normal events should be stored — oversized line dropped.
    const rows = state.snapshot().rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]?.method).toBe("before");
    expect(rows[1]?.method).toBe("after");
    const beforeBytes = Buffer.byteLength(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "before", params: {} })}\n`,
    );
    expect(state.eventAt(1)?.byteOffset).toBe(beforeBytes + 20 * MB + 1);

    // Exactly one watch-error reporting the skip.
    const errors = captured.filter((p) => p.kind === "watch-error");
    expect(errors).toHaveLength(1);
    const err = errors[0];
    if (!err || err.kind !== "watch-error") throw new Error("expected watch-error");
    expect(err.code).toBe("oversized-line");
    expect(err.message).toContain("oversized JSONL line");
  });

  it("rotation resets parser-side byteOffset and partial-line buffer", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({ host, file: "/tmp/x.log", flushIntervalMs: 0 });

    // Push a partial line (no trailing newline) — splitter holds it.
    host.push('{"jsonrpc":"2.0","id":1,"method":"part');
    expect(state.snapshot().rows.length).toBe(0);

    // Rotation: splitter buffer should drop, byteOffset should reset.
    host.triggerReset({ newSize: 0, reason: "shrink" });

    // Post-rotation push of a valid line — must parse cleanly without
    // concatenating the previous partial.
    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "fresh", params: {} })}\n`);
    const rows = state.snapshot().rows;
    expect(rows.length).toBe(1);
    expect(rows[0]?.kind).toBe("request");
    // First row after rotation starts at byteOffset 0.
    const ev0 = state.eventAt(0);
    expect(ev0?.byteOffset).toBe(0);
  });

  it("rotation clears rows and indexes before ingesting a non-empty replacement file", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({
      host,
      file: "/tmp/x.log",
      flushIntervalMs: 0,
      directionInference: (raw): "c2s" | "s2c" => {
        const r = raw as { result?: unknown; error?: unknown };
        return r && (r.result !== undefined || r.error !== undefined) ? "s2c" : "c2s";
      },
    });
    const captured: SsePayload[] = [];
    state.subscribe((p) => captured.push(p));

    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "oldMethod", params: {} })}\n`);
    expect(state.snapshot().rows).toHaveLength(1);
    expect(state.searchIndex.scan("oldmethod", 10).matches).toEqual([0]);

    host.triggerReset({ newSize: 128, reason: "shrink" });
    host.push(`${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { fresh: true } })}\n`);

    const rotationIdx = captured.findIndex((p) => p.kind === "rotation");
    expect(rotationIdx).toBeGreaterThanOrEqual(0);
    const appendAfterRotation = captured.slice(rotationIdx + 1).find((p) => p.kind === "append");
    expect(appendAfterRotation).toBeTruthy();
    if (!appendAfterRotation || appendAfterRotation.kind !== "append") {
      throw new Error("expected append after rotation");
    }
    expect(appendAfterRotation.from).toBe(0);
    expect(appendAfterRotation.rows).toHaveLength(1);

    const rows = state.snapshot().rows;
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows)).toEqual(["0"]);
    expect(rows[0]?.idx).toBe(0);
    expect(rows[0]?.summary).toContain("result");

    expect(state.eventAt(1)).toBeNull();
    expect(state.searchIndex.scan("oldmethod", 10).matches).toEqual([]);
    expect(state.searchIndex.scan("fresh", 10).matches).toEqual([0]);
    expect(state.correlatorDataFor(0)).toMatchObject({
      pairIdx: null,
      latencyMs: null,
      status: "n/a",
    });
  });

  it("finalizes a valid unterminated replacement record after rotation read completes", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({ host, file: "/tmp/x.log", flushIntervalMs: 0 });
    host.push(`${JSON.stringify({ jsonrpc: "2.0", method: "old", params: {} })}\n`);

    host.triggerReset({ newSize: 64, reason: "rename" });
    const replacement = JSON.stringify({
      jsonrpc: "2.0",
      method: "replacement-final",
      params: {},
    });
    host.push(replacement);
    host.triggerInitialReadComplete({
      loadedBytes: Buffer.byteLength(replacement),
      totalBytes: Buffer.byteLength(replacement),
    });

    expect(state.snapshot().rows).toHaveLength(1);
    expect(state.snapshot().rows[0]?.method).toBe("replacement-final");
    expect(state.eventAt(0)?.byteOffset).toBe(0);
  });
});
