import type { ReplayDiagnostic, ReplayResourceState } from "@ahp-viewer/core";
import type { AhpEvent } from "@ahp-viewer/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppState, LogMeta } from "./app-state.js";
import { SearchIndex } from "./search-index.js";
import { registerStateRoutes, type StateAtSuccessResponse } from "./state-routes.js";
import type { ActiveSession, LogSessionManager } from "./session-manager.js";

const LOG_KEY = "0".repeat(32);
const SESSION = "copilot:/session/1";

function fakeSessions(appState: AppState | null, logKey = LOG_KEY): LogSessionManager {
  const active: ActiveSession | null = appState ? { logKey, appState } : null;
  return {
    current: () => active,
    open: async () => {
      if (!active) throw new Error("no active log");
      return active;
    },
    close: async () => {},
    onChange: () => () => {},
    dispose: async () => {},
  };
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

function makeAppState(options: {
  totalEvents?: number;
  resources?: readonly ReplayResourceState[];
  diagnostics?: readonly ReplayDiagnostic[];
  logKey?: string;
} = {}): AppState {
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
    snapshot: () => ({ meta, rows: [] }),
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

    expect((await app.request("/api/state-at?idx=0&resourceKind=unknown&resourceUri=x")).status).toBe(
      400,
    );
    expect((await app.request("/api/state-at?idx=0&resourceKind=session&resourceUri=%20")).status).toBe(
      400,
    );
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
    const res = await app.request("/api/state-at?idx=0&resourceKind=root&resourceUri=agenthost%3A%2Froot");

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
});
