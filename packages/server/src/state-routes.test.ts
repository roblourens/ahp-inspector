import type { ReplayDiagnostic, ReplayResourceState } from "@ahp-inspector/core";
import {
  ActionType,
  ReconnectResultType,
  SessionLifecycle,
  SessionStatus,
  TerminalClaimKind,
} from "@ahp-inspector/protocol";
import type { AhpEvent, Disposable, HostAdapter, LogHandle } from "@ahp-inspector/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { type AppState, createAppState, type LogMeta } from "./app-state.js";
import { SearchIndex } from "./search-index.js";
import type { ActiveSession, LogSessionManager } from "./session-manager.js";
import { registerStateRoutes, type StateAtSuccessResponse } from "./state-routes.js";

const LOG_KEY = "0".repeat(32);
const ROOT = "agenthost:/root";
const SESSION = "copilot:/session/1";
const TERMINAL = "terminal:/1";

function fakeSessions(appState: AppState | null, logKey = LOG_KEY): LogSessionManager {
  const active: ActiveSession | null = appState ? { logKey, appState } : null;
  return {
    current: () => active,
    discover: async () => ({ candidates: [], truncated: false }),
    open: async () => {
      if (!active) throw new Error("no active log");
      return active;
    },
    close: async () => {},
    onChange: () => () => {},
    dispose: async () => {},
  };
}

function mutableSessions(initial: AppState): LogSessionManager & { set(appState: AppState): void } {
  let active: ActiveSession = { logKey: initial.meta.logKey, appState: initial };
  return {
    current: () => active,
    discover: async () => ({ candidates: [], truncated: false }),
    open: async () => active,
    close: async () => {},
    onChange: () => () => {},
    dispose: async () => {},
    set: (appState: AppState) => {
      active = { logKey: appState.meta.logKey, appState };
    },
  };
}

interface FakeHost extends HostAdapter {
  push(text: string): void;
  triggerReset(info: { newSize: number; reason: "shrink" | "rename" }): void;
}

function makeFakeHost(path: string): FakeHost {
  type WatchSinkObj = {
    onChunk(bytes: Uint8Array, byteOffset: number): void;
    onReset(info: { newSize: number; reason: "shrink" | "rename" }): void;
    onError(err: Error, fatal: boolean): void;
  };
  let sink: WatchSinkObj | null = null;
  let offset = 0;
  const encoder = new TextEncoder();
  return {
    discoverLogs: async () => ({ candidates: [], truncated: false }),
    openLog: async (): Promise<LogHandle> => ({ id: path }),
    watchLog: (_h, sinkOrChunk) => {
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
      } satisfies Disposable;
    },
    close: async () => {},
    push(text: string) {
      if (!sink) throw new Error("watchLog not subscribed");
      const bytes = encoder.encode(text);
      sink.onChunk(bytes, offset);
      offset += bytes.byteLength;
    },
    triggerReset(info) {
      if (!sink) throw new Error("watchLog not subscribed");
      offset = 0;
      sink.onReset(info);
    },
  };
}

function ahpDirection(raw: unknown): "c2s" | "s2c" {
  const r = raw as { method?: unknown; result?: unknown; error?: unknown };
  return r && (r.method === "action" || r.result !== undefined || r.error !== undefined)
    ? "s2c"
    : "c2s";
}

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

function initializeRequest(id = 1): string {
  return jsonl({ jsonrpc: "2.0", id, method: "initialize", params: {} });
}

function initializeSnapshotResponse(id = 1): string {
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

function subscribeRequest(id = 2): string {
  return jsonl({ jsonrpc: "2.0", id, method: "subscribe", params: { resource: SESSION } });
}

function subscribeSnapshotResponse(id = 2): string {
  return jsonl({
    jsonrpc: "2.0",
    id,
    result: { snapshot: { resource: SESSION, fromSeq: 0, state: sessionSnapshotState() } },
  });
}

function dispatchTitleIntent(): string {
  return jsonl({
    jsonrpc: "2.0",
    method: "dispatchAction",
    params: {
      clientSeq: 99,
      channel: SESSION,
      action: { type: ActionType.SessionTitleChanged, session: SESSION, title: "Client title" },
    },
  });
}

function serverTitleAction(serverSeq: number, title: string): string {
  return jsonl({
    jsonrpc: "2.0",
    method: "action",
    params: {
      channel: SESSION,
      serverSeq,
      origin: { clientId: "client-1", clientSeq: 99 },
      action: { type: ActionType.SessionTitleChanged, session: SESSION, title },
    },
  });
}

async function createSyntheticAppState(
  path: string,
): Promise<{ host: FakeHost; appState: AppState }> {
  const host = makeFakeHost(path);
  const appState = await createAppState({
    host,
    file: path,
    flushIntervalMs: 0,
    directionInference: ahpDirection,
  });
  return { host, appState };
}

function makeEvent(seq: number): AhpEvent {
  return {
    seq,
    ts: seq * 10,
    tsRaw: String(seq * 10),
    dir: "c2s",
    kind: "request",
    id: seq,
    idType: "number",
    method: "initialize",
    actionType: null,
    sessionId: null,
    turnId: null,
    toolCallId: null,
    serverSeq: null,
    byteOffset: 0,
    byteLength: 10,
    raw: { jsonrpc: "2.0", id: seq, method: "initialize", params: {} },
    parse: "ok",
  };
}

function resource(overrides: Partial<ReplayResourceState> = {}): ReplayResourceState {
  return {
    key: { kind: "session", uri: SESSION },
    state: { summary: { title: "Session" } },
    baselineEventIdx: 0,
    lastAppliedEventIdx: 1,
    baselineFromSeq: 0,
    lastServerSeq: 1,
    confidence: "complete",
    diagnostics: [],
    ...overrides,
  };
}

function diagnostic(code: ReplayDiagnostic["code"]): ReplayDiagnostic {
  return { code, severity: "warning", eventIdx: 0, message: code };
}

function makeAppState(
  options: {
    totalEvents?: number;
    resources?: readonly ReplayResourceState[];
    diagnostics?: readonly ReplayDiagnostic[];
    logKey?: string;
  } = {},
): AppState {
  const totalEvents = options.totalEvents ?? 2;
  const meta: LogMeta = {
    filename: "test.log",
    sizeBytes: 0,
    startedAt: 0,
    logKey: options.logKey ?? LOG_KEY,
  };
  const searchIndex = new SearchIndex();
  return {
    meta,
    searchIndex,
    snapshot: () => ({
      meta,
      rows: [],
      loadProgress: { kind: "load-progress", phase: "idle", loadedRows: 0, loadedBytes: 0 },
    }),
    subscribe: () => () => {},
    runFlush: () => {},
    eventAt: (idx) => (idx >= 0 && idx < totalEvents ? makeEvent(idx) : null),
    correlatorDataFor: () => ({ pairIdx: null, latencyMs: null, status: "n/a" }),
    stateAtIndex: (targetIndex: number) => ({
      totalEvents,
      result: {
        targetIndex,
        resources: options.resources ?? [resource()],
        intents: [],
        diagnostics: options.diagnostics ?? [],
      },
      cache: { hit: false, size: 1, maxEntries: 25 },
    }),
    dispose: async () => {},
  };
}

function buildApp(appState: AppState | null, logKey = LOG_KEY): Hono {
  const app = new Hono();
  registerStateRoutes(app, fakeSessions(appState, logKey));
  return app;
}

describe("GET /api/state-at", () => {
  it("returns no-active-log when no session is open", async () => {
    const app = buildApp(null);
    const res = await app.request("/api/state-at?idx=0");

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: "no-active-log", message: "no active log" });
  });

  it("returns missing idx for absent idx", async () => {
    const app = buildApp(makeAppState());
    const res = await app.request("/api/state-at");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "bad-request", message: "missing idx" });
  });

  it.each(["-1", "1abc", "1.5", "abc", ""])("rejects invalid idx %s", async (idx) => {
    const app = buildApp(makeAppState());
    const res = await app.request(`/api/state-at?idx=${encodeURIComponent(idx)}`);

    expect(res.status).toBe(400);
    expect((await res.json()) as { code: string }).toMatchObject({ code: "bad-request" });
  });

  it("returns not-found when idx is out of range", async () => {
    const app = buildApp(makeAppState({ totalEvents: 1 }));
    const res = await app.request("/api/state-at?idx=1");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      code: "not-found",
      message: "event index not found",
      totalEvents: 1,
    });
  });

  it("returns log-mismatch for stale logKey", async () => {
    const app = buildApp(makeAppState(), LOG_KEY);
    const res = await app.request("/api/state-at?idx=0&logKey=stale");

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: "log-mismatch", message: "active log changed" });
  });

  it("requires resourceKind and resourceUri to be provided together", async () => {
    const app = buildApp(makeAppState());

    expect((await app.request("/api/state-at?idx=0&resourceKind=session")).status).toBe(400);
    expect((await app.request("/api/state-at?idx=0&resourceUri=x")).status).toBe(400);
  });

  it("rejects invalid resourceKind and empty resourceUri", async () => {
    const app = buildApp(makeAppState());

    expect(
      (await app.request("/api/state-at?idx=0&resourceKind=unknown&resourceUri=x")).status,
    ).toBe(400);
    expect(
      (await app.request("/api/state-at?idx=0&resourceKind=session&resourceUri=%20")).status,
    ).toBe(400);
  });

  it("returns metadata-only resources by default and does not contain state", async () => {
    const app = buildApp(makeAppState());
    const res = await app.request("/api/state-at?idx=0");

    expect(res.status).toBe(200);
    const body = (await res.json()) as StateAtSuccessResponse;
    expect(body.selectedResource).toBeNull();
    expect(body.confidence).toBe("complete");
    expect(body.resources[0]).toMatchObject({
      kind: "session",
      uri: SESSION,
      diagnosticCount: 0,
    });
    expect(JSON.stringify(body.resources)).not.toContain('"state"');
  });

  it("returns selectedResource state for an exact selected resource", async () => {
    const app = buildApp(makeAppState());
    const res = await app.request(
      `/api/state-at?idx=0&resourceKind=session&resourceUri=${encodeURIComponent(SESSION)}`,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as StateAtSuccessResponse;
    expect(body.confidence).toBe("complete");
    expect(body.selectedResource?.state).toMatchObject({ summary: { title: "Session" } });
  });

  it("returns unknown confidence when selected resource is absent", async () => {
    const app = buildApp(makeAppState());
    const res = await app.request(
      "/api/state-at?idx=0&resourceKind=root&resourceUri=agenthost%3A%2Froot",
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as StateAtSuccessResponse;
    expect(body.confidence).toBe("unknown");
    expect(body.selectedResource).toBeNull();
  });

  it("aggregates partial and unknown confidence", async () => {
    const partialApp = buildApp(makeAppState({ resources: [resource({ confidence: "partial" })] }));
    const partialRes = await partialApp.request("/api/state-at?idx=0");
    expect(((await partialRes.json()) as StateAtSuccessResponse).confidence).toBe("partial");

    const emptyApp = buildApp(makeAppState({ resources: [] }));
    const emptyRes = await emptyApp.request("/api/state-at?idx=0");
    expect(((await emptyRes.json()) as StateAtSuccessResponse).confidence).toBe("unknown");
  });

  it("returns diagnostics intents and cache metadata without leaking absolute paths", async () => {
    const diagnostics = [
      diagnostic("missing-baseline"),
      diagnostic("server-seq-gap"),
      diagnostic("unknown-action"),
      diagnostic("ignored-client-intent"),
      diagnostic("parse-error"),
    ];
    const appState = makeAppState({ diagnostics });
    const hiddenPath = "/private/tmp/hidden-secret-dir/log.jsonl";
    const app = buildApp({
      ...appState,
      stateAtIndex: (targetIndex: number) => ({
        totalEvents: 2,
        result: {
          targetIndex,
          resources: [resource()],
          diagnostics,
          intents: [
            {
              eventIdx: 2,
              ts: 2000,
              clientSeq: 99,
              actionType: "session/titleChanged",
              resource: { kind: "session", uri: SESSION },
              ignored: true,
              acceptedByServerSeq: 1,
            },
          ],
        },
        cache: { hit: true, size: 2, maxEntries: 25 },
      }),
    });

    const res = await app.request("/api/state-at?idx=0");
    const text = await res.text();
    const body = JSON.parse(text) as StateAtSuccessResponse;

    expect(body.diagnostics.map((item) => item.code)).toEqual([
      "missing-baseline",
      "server-seq-gap",
      "unknown-action",
      "ignored-client-intent",
      "parse-error",
    ]);
    expect(body.intents[0]).toMatchObject({
      clientSeq: 99,
      ignored: true,
      acceptedByServerSeq: 1,
    });
    expect(body.cache).toEqual({ hit: true, size: 2, maxEntries: 25 });
    expect(text).not.toContain(hiddenPath);
    expect(text).not.toContain("/private/tmp/hidden-secret-dir");
  });

  it("returns selected state and ignored client intent from synthetic JSONL AppState replay", async () => {
    const { host, appState } = await createSyntheticAppState("/tmp/route-state.log");
    try {
      const app = buildApp(appState, appState.meta.logKey);
      host.push(initializeRequest());
      host.push(initializeSnapshotResponse());
      host.push(subscribeRequest());
      host.push(subscribeSnapshotResponse());
      host.push(dispatchTitleIntent());
      host.push(serverTitleAction(1, "Server title"));

      const res = await app.request(
        `/api/state-at?idx=5&logKey=${appState.meta.logKey}&resourceKind=session&resourceUri=${encodeURIComponent(
          SESSION,
        )}`,
      );
      const body = (await res.json()) as StateAtSuccessResponse;

      expect(res.status).toBe(200);
      expect(body.confidence).toBe("complete");
      expect(body.selectedResource?.state).toMatchObject({ summary: { title: "Server title" } });
      expect(body.intents[0]).toMatchObject({
        clientSeq: 99,
        ignored: true,
        acceptedByServerSeq: 1,
      });
      expect(body.diagnostics.map((item) => item.code)).toContain("ignored-client-intent");
    } finally {
      await appState.dispose();
    }
  });

  it("returns reconnect replay diagnostics and snapshot state from synthetic JSONL AppState replay", async () => {
    const { host, appState } = await createSyntheticAppState("/tmp/route-reconnect.log");
    try {
      const app = buildApp(appState, appState.meta.logKey);
      host.push(initializeRequest());
      host.push(initializeSnapshotResponse());
      host.push(subscribeRequest());
      host.push(subscribeSnapshotResponse());
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
                serverSeq: 1,
                action: {
                  type: ActionType.SessionTitleChanged,
                  session: SESSION,
                  title: "Reconnect one",
                },
              },
              {
                channel: SESSION,
                serverSeq: 2,
                action: {
                  type: ActionType.SessionTitleChanged,
                  session: SESSION,
                  title: "Reconnect two",
                },
              },
            ],
            missing: ["copilot:/gone"],
          },
        }),
      );
      host.push(jsonl({ jsonrpc: "2.0", id: 4, method: "reconnect", params: {} }));
      host.push(
        jsonl({
          jsonrpc: "2.0",
          id: 4,
          result: {
            type: ReconnectResultType.Snapshot,
            snapshots: [{ resource: ROOT, fromSeq: 0, state: rootSnapshotState(7) }],
          },
        }),
      );

      const sessionRes = await app.request(
        `/api/state-at?idx=5&resourceKind=session&resourceUri=${encodeURIComponent(SESSION)}`,
      );
      const sessionBody = (await sessionRes.json()) as StateAtSuccessResponse;
      expect(sessionBody.selectedResource?.state).toMatchObject({
        summary: { title: "Reconnect two" },
      });
      expect(sessionBody.diagnostics.map((item) => item.code)).toContain(
        "reconnect-missing-resource",
      );

      const rootRes = await app.request(
        `/api/state-at?idx=7&resourceKind=root&resourceUri=${encodeURIComponent(ROOT)}`,
      );
      const rootBody = (await rootRes.json()) as StateAtSuccessResponse;
      expect(rootBody.confidence).toBe("complete");
      expect(rootBody.selectedResource?.state).toMatchObject({ activeSessions: 7 });
    } finally {
      await appState.dispose();
    }
  });

  it("isolates replay caches and logKey scopes across log switch", async () => {
    const first = await createSyntheticAppState("/tmp/first.log");
    const second = await createSyntheticAppState("/tmp/second.log");
    try {
      first.host.push(initializeRequest());
      first.host.push(initializeSnapshotResponse());
      second.host.push(initializeRequest());
      second.host.push(initializeSnapshotResponse());

      const sessions = mutableSessions(first.appState);
      const app = new Hono();
      registerStateRoutes(app, sessions);

      const firstRes = await app.request(
        `/api/state-at?idx=1&logKey=${first.appState.meta.logKey}`,
      );
      expect(((await firstRes.json()) as StateAtSuccessResponse).cache.hit).toBe(false);

      sessions.set(second.appState);
      const staleRes = await app.request(
        `/api/state-at?idx=1&logKey=${first.appState.meta.logKey}`,
      );
      expect(staleRes.status).toBe(409);

      const secondRes = await app.request(
        `/api/state-at?idx=1&logKey=${second.appState.meta.logKey}`,
      );
      const secondBody = (await secondRes.json()) as StateAtSuccessResponse;
      expect(secondRes.status).toBe(200);
      expect(secondBody.cache.hit).toBe(false);
    } finally {
      await first.appState.dispose();
      await second.appState.dispose();
    }
  });
});
