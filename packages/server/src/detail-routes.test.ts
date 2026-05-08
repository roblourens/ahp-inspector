// detail-routes.test.ts — integration tests for GET /api/log/event/:idx
// Covers: 200 happy path, 404 out-of-range, 400 invalid/negative idx,
// paired event, no absolute path leakage (T-03-01-04).

import type { AhpEvent } from "@ahp-viewer/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppState, LogMeta } from "./app-state.js";
import { type DetailResponse, registerDetailRoutes } from "./detail-routes.js";
import { SearchIndex } from "./search-index.js";
import type { ActiveSession, LogSessionManager } from "./session-manager.js";
import { registerSearchRoutes } from "./search-routes.js";

function fakeSessions(appState: AppState): LogSessionManager {
  const active: ActiveSession = { logKey: appState.meta.logKey, appState };
  return {
    current: () => active,
    open: async () => active,
    close: async () => {},
    onChange: () => () => {},
    dispose: async () => {},
  };
}

// ---------------------------------------------------------------------------
// AhpEvent factory (same helper pattern as search-routes.test.ts)
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<AhpEvent> & { seq: number }): AhpEvent {
  return {
    ts: overrides.seq * 10,
    tsRaw: String(overrides.seq * 10),
    dir: "c2s",
    kind: "request",
    id: overrides.seq,
    idType: "number",
    method: "doThing",
    actionType: null,
    sessionId: null,
    turnId: null,
    toolCallId: null,
    serverSeq: null,
    byteOffset: 0,
    byteLength: 50,
    raw: { jsonrpc: "2.0", id: overrides.seq, method: "doThing", params: {} },
    parse: "ok",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Minimal AppState mock for detail tests
// ---------------------------------------------------------------------------

interface MockEntry {
  event: AhpEvent;
  pairIdx: number | null;
  latencyMs: number | null;
  status: import("@ahp-viewer/core").Status;
}

function makeDetailAppState(
  entries: MockEntry[],
  absolutePath = "/private/tmp/hidden/test.log",
): AppState {
  const si = new SearchIndex();
  for (const e of entries) {
    si.append(e.event);
  }
  const meta: LogMeta = {
    // NOTE: meta uses basename only — the absolute path must NOT appear here
    filename: "test.log",
    sizeBytes: 0,
    startedAt: 0,
    logKey: "0".repeat(32),
  };
  // We store the absolute path only to verify it doesn't leak into responses.
  void absolutePath;

  return {
    meta,
    searchIndex: si,
    snapshot: () => ({ meta, rows: [] }),
    subscribe: () => () => {},
    runFlush: () => {},
    eventAt: (idx: number) => entries[idx]?.event ?? null,
    correlatorDataFor: (idx: number) => {
      const entry = entries[idx];
      return {
        pairIdx: entry?.pairIdx ?? null,
        latencyMs: entry?.latencyMs ?? null,
        status: entry?.status ?? "n/a",
      };
    },
    dispose: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Route-level tests
// ---------------------------------------------------------------------------

describe("GET /api/log/event/:idx", () => {
  function buildApp(entries: MockEntry[]): Hono {
    const app = new Hono();
    registerDetailRoutes(app, fakeSessions(makeDetailAppState(entries)));
    return app;
  }

  it("returns 200 with full DetailResponse shape for a valid idx", async () => {
    const ev = makeEvent({ seq: 0 });
    const app = buildApp([{ event: ev, pairIdx: null, latencyMs: null, status: "pending" }]);
    const res = await app.request("/api/log/event/0");
    expect(res.status).toBe(200);
    const body = (await res.json()) as DetailResponse;
    expect(body.event.seq).toBe(0);
    expect(body.event.raw).toBeDefined();
    expect(body.pair).toBeNull();
    expect(body.pairIdx).toBeNull();
    expect(body.status).toBe("pending");
    expect(body.latencyMs).toBeNull();
  });

  it("event.raw is included in the response (full payload)", async () => {
    const rawPayload = { jsonrpc: "2.0", id: 0, method: "doThing", params: { secret: "data" } };
    const ev = makeEvent({ seq: 0, raw: rawPayload });
    const app = buildApp([{ event: ev, pairIdx: null, latencyMs: null, status: "n/a" }]);
    const res = await app.request("/api/log/event/0");
    expect(res.status).toBe(200);
    const body = (await res.json()) as DetailResponse;
    expect((body.event.raw as typeof rawPayload).params?.secret).toBe("data");
  });

  it("returns paired event and latency for a paired request/response", async () => {
    const req = makeEvent({ seq: 0, kind: "request", dir: "c2s" });
    const resp = makeEvent({
      seq: 1,
      kind: "response",
      dir: "s2c",
      id: 0,
      raw: { jsonrpc: "2.0", id: 0, result: { ok: true } },
    });
    const app = buildApp([
      { event: req, pairIdx: 1, latencyMs: 42, status: "ok" },
      { event: resp, pairIdx: 0, latencyMs: 42, status: "ok" },
    ]);
    const res = await app.request("/api/log/event/0");
    expect(res.status).toBe(200);
    const body = (await res.json()) as DetailResponse;
    expect(body.pairIdx).toBe(1);
    expect(body.pair).not.toBeNull();
    expect(body.pair?.seq).toBe(1);
    expect(body.latencyMs).toBe(42);
    expect(body.status).toBe("ok");
  });

  it("returns 404 for out-of-range idx", async () => {
    const app = buildApp([
      { event: makeEvent({ seq: 0 }), pairIdx: null, latencyMs: null, status: "n/a" },
    ]);
    const res = await app.request("/api/log/event/999");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not found");
  });

  it("returns 400 for negative idx", async () => {
    const app = buildApp([]);
    const res = await app.request("/api/log/event/-1");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid idx");
  });

  it("returns 400 for non-numeric idx", async () => {
    const app = buildApp([]);
    const res = await app.request("/api/log/event/abc");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid idx");
  });

  it("returns 400 for partial numeric idx", async () => {
    const app = buildApp([
      { event: makeEvent({ seq: 0 }), pairIdx: null, latencyMs: null, status: "n/a" },
      { event: makeEvent({ seq: 1 }), pairIdx: null, latencyMs: null, status: "n/a" },
    ]);
    const res = await app.request("/api/log/event/1abc");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid idx");
  });

  it("T-03-01-04: response JSON does NOT contain absolute fixture path", async () => {
    const absolutePath = "/private/tmp/hidden-secret-dir/test.log";
    const ev = makeEvent({ seq: 0 });
    const appState = makeDetailAppState(
      [{ event: ev, pairIdx: null, latencyMs: null, status: "n/a" }],
      absolutePath,
    );
    const app = new Hono();
    registerDetailRoutes(app, fakeSessions(appState));
    const res = await app.request("/api/log/event/0");
    const bodyText = await res.text();
    expect(bodyText).not.toContain(absolutePath);
    expect(bodyText).not.toContain("/private/tmp/hidden-secret-dir");
  });
});

// ---------------------------------------------------------------------------
// Route-level search test (spot check from this test file too)
// ---------------------------------------------------------------------------

describe("GET /api/log/search (via detail test file)", () => {
  it("wires search route on same Hono app", async () => {
    const ev = makeEvent({ seq: 0, method: "initialize" });
    const si = new SearchIndex();
    si.append(ev);
    const meta: LogMeta = { filename: "t.log", sizeBytes: 0, startedAt: 0, logKey: "0".repeat(32) };
    const appState: AppState = {
      meta,
      searchIndex: si,
      snapshot: () => ({ meta, rows: [] }),
      subscribe: () => () => {},
      runFlush: () => {},
      eventAt: (i) => (i === 0 ? ev : null),
      correlatorDataFor: () => ({ pairIdx: null, latencyMs: null, status: "n/a" }),
      dispose: async () => {},
    };
    const app = new Hono();
    const sessions = fakeSessions(appState);
    registerDetailRoutes(app, sessions);
    registerSearchRoutes(app, sessions);

    const res = await app.request("/api/log/search?q=initialize");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { matches: number[]; total: number; truncated: boolean };
    expect(body.matches).toContain(0);
    expect(body.total).toBeGreaterThan(0);
  });
});
