// AppState integration test — drives ingestion through a fake HostAdapter
// and verifies snapshot/append/patch/unmatched semantics + basename meta.

import {
  ActionType,
  ReconnectResultType,
  SessionLifecycle,
  SessionStatus,
  TerminalClaimKind,
} from "@ahp-viewer/protocol";
import type { DiscoveryResult, Disposable, HostAdapter, LogHandle } from "@ahp-viewer/shared";
import { afterEach, describe, expect, it } from "vitest";
import { type AppState, createAppState, type SsePayload } from "./app-state.js";

interface FakeLogHandle extends LogHandle {
  readonly path: string;
  readonly size: number;
}

interface FakeHost extends HostAdapter {
  push(text: string): void;
  /** Phase 4: directly invoke the active sink's onReset (if WatchSink). */
  triggerReset(info: { newSize: number; reason: "shrink" | "rename" }): void;
  /** Phase 4: directly invoke the active sink's onError (if WatchSink). */
  triggerError(err: Error, fatal: boolean): void;
}

type WatchSinkObj = {
  onChunk(bytes: Uint8Array, byteOffset: number): void;
  onReset(info: { newSize: number; reason: "shrink" | "rename" }): void;
  onError(err: Error, fatal: boolean): void;
};

function makeFakeHost(path: string): FakeHost {
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
    close: async (_h: LogHandle) => {},
    push(text: string): void {
      if (!sink) throw new Error("watchLog not subscribed");
      const bytes = encoder.encode(text);
      sink.onChunk(bytes, offset);
      offset += bytes.byteLength;
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
      serverSeq,
      origin: { clientId: "client-1", clientSeq: 99 },
      action: { type: ActionType.SessionTitleChanged, session: SESSION, title },
    },
  });
}

function rootActiveSessionsAction(serverSeq: number, activeSessions: number): string {
  return jsonl({
    jsonrpc: "2.0",
    method: "action",
    params: {
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
    expect(last.updates.length).toBeGreaterThanOrEqual(1);
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

  it("dispose() is idempotent and stops the watcher", async () => {
    const host = makeFakeHost("/tmp/x.log");
    state = await createAppState({ host, file: "/tmp/x.log", flushIntervalMs: 0 });
    await state.dispose();
    await state.dispose();
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
          clientSeq: 99,
          action: { type: ActionType.SessionTitleChanged, session: SESSION, title: "Client title" },
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
              serverSeq: 2,
              action: {
                type: ActionType.SessionTitleChanged,
                session: SESSION,
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
});
