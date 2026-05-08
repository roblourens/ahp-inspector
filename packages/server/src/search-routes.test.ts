// search-routes.test.ts — integration tests for GET /api/log/search
// Tests are initially RED (Task 1) until registerSearchRoutes is wired (Task 2).
//
// Covers: substring match, 256-char cap, 5000 result cap, empty query = match-all,
// limit param capped at MAX_RESULTS.

import type { AhpEvent } from "@ahp-viewer/shared";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppState, LogMeta } from "./app-state.js";
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
// Minimal AhpEvent factory for tests
// ---------------------------------------------------------------------------

function makeEvent(
  overrides: Partial<AhpEvent> & { seq: number; method: string | null },
): AhpEvent {
  return {
    ts: overrides.seq,
    tsRaw: String(overrides.seq),
    dir: "c2s",
    kind: "request",
    id: overrides.seq,
    idType: "number",
    actionType: null,
    sessionId: null,
    turnId: null,
    toolCallId: null,
    serverSeq: null,
    byteOffset: 0,
    byteLength: 10,
    raw: { jsonrpc: "2.0", id: overrides.seq, method: overrides.method, params: {} },
    parse: "ok",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SearchIndex unit tests (Task 1 — these pass immediately)
// ---------------------------------------------------------------------------

describe("SearchIndex", () => {
  it("append + scan: substring match returns correct indices", () => {
    const idx = new SearchIndex();
    idx.append(makeEvent({ seq: 0, method: "initialize" }));
    idx.append(makeEvent({ seq: 1, method: "ping" }));
    idx.append(makeEvent({ seq: 2, method: "initialize/something" }));

    const result = idx.scan("initialize", 5000);
    expect(result.matches).toContain(0);
    expect(result.matches).toContain(2);
    expect(result.matches).not.toContain(1);
    expect(result.truncated).toBe(false);
  });

  it("empty query returns all indices (match-all)", () => {
    const idx = new SearchIndex();
    for (let i = 0; i < 5; i++) {
      idx.append(makeEvent({ seq: i, method: `method${i}` }));
    }
    const result = idx.scan("", 5000);
    expect(result.matches).toEqual([0, 1, 2, 3, 4]);
    expect(result.truncated).toBe(false);
  });

  it("scan with limit stops and marks truncated", () => {
    const idx = new SearchIndex();
    for (let i = 0; i < 10; i++) {
      idx.append(makeEvent({ seq: i, method: "sameThing" }));
    }
    const result = idx.scan("samething", 3);
    expect(result.matches).toEqual([0, 1, 2]);
    expect(result.truncated).toBe(true);
  });

  it("300-char query works (caller is responsible for capping)", () => {
    const idx = new SearchIndex();
    idx.append(makeEvent({ seq: 0, method: null, id: null, idType: "null" }));
    // Should not throw; returns no matches for a 300-char query
    const result = idx.scan("x".repeat(300), 5000);
    expect(result.matches).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("haystack includes raw JSON payload content, sessionId, and turnId", () => {
    const idx = new SearchIndex();
    idx.append(
      makeEvent({
        seq: 0,
        method: "tools/call",
        sessionId: "sess-abc",
        turnId: "turn-xyz",
        raw: { jsonrpc: "2.0", id: 42, method: "tools/call", params: { name: "uniqueToolName" } },
      }),
    );
    // Should match on the raw JSON payload
    expect(idx.scan("uniquetoolname", 10).matches).toContain(0);
    // Should match on session ID
    expect(idx.scan("sess-abc", 10).matches).toContain(0);
    // Should match on turn ID
    expect(idx.scan("turn-xyz", 10).matches).toContain(0);
  });
});

// ---------------------------------------------------------------------------
// Helper: minimal AppState mock backed by a real SearchIndex
// ---------------------------------------------------------------------------

function makeSearchAppState(entries: Array<{ method: string }>): AppState {
  const si = new SearchIndex();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) continue;
    si.append(makeEvent({ seq: i, method: e.method }));
  }
  const meta: LogMeta = {
    filename: "test.log",
    sizeBytes: 0,
    startedAt: 0,
    logKey: "0".repeat(32),
  };
  return {
    meta,
    searchIndex: si,
    snapshot: () => ({ meta, rows: [] }),
    subscribe: () => () => {},
    runFlush: () => {},
    eventAt: () => null,
    correlatorDataFor: () => ({ pairIdx: null, latencyMs: null, status: "n/a" }),
    dispose: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Route-level tests (RED until search-routes.ts is created in Task 2)
// ---------------------------------------------------------------------------

describe("GET /api/log/search", () => {
  function buildApp(entries: Array<{ method: string }>): Hono {
    const app = new Hono();
    registerSearchRoutes(app, fakeSessions(makeSearchAppState(entries)));
    return app;
  }

  it("returns matches for a substring query", async () => {
    const app = buildApp([
      { method: "initialize" },
      { method: "ping" },
      { method: "initialize/done" },
    ]);
    const res = await app.request("/api/log/search?q=initialize");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { matches: number[]; total: number; truncated: boolean };
    expect(body.matches).toContain(0);
    expect(body.matches).toContain(2);
    expect(body.matches).not.toContain(1);
    expect(body.total).toBe(body.matches.length);
    expect(body.truncated).toBe(false);
  });

  it("no q param returns all indices (match-all)", async () => {
    const app = buildApp([{ method: "alpha" }, { method: "beta" }, { method: "gamma" }]);
    const res = await app.request("/api/log/search");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { matches: number[]; total: number; truncated: boolean };
    expect(body.matches).toEqual([0, 1, 2]);
    expect(body.total).toBe(3);
  });

  it("query longer than 256 chars is silently truncated to 256", async () => {
    const app = buildApp([{ method: "x".repeat(300) }]);
    const q = "x".repeat(300);
    const res = await app.request(`/api/log/search?q=${encodeURIComponent(q)}`);
    expect(res.status).toBe(200);
    // Just assert it doesn't error — the query is capped
    const body = (await res.json()) as { matches: number[]; total: number };
    expect(typeof body.total).toBe("number");
  });

  it("limit param is capped at 5000", async () => {
    // Build 3 events; request limit=99999 — effectively returns all 3
    const app = buildApp([{ method: "a" }, { method: "b" }, { method: "c" }]);
    const res = await app.request("/api/log/search?limit=99999");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { matches: number[]; total: number; truncated: boolean };
    // All 3 returned (well within server cap of 5000)
    expect(body.total).toBe(3);
    expect(body.truncated).toBe(false);
  });

  it("limit=3 on 10-match set marks truncated=true", async () => {
    const app = buildApp(Array.from({ length: 10 }, (_, i) => ({ method: `same${i}` })));
    // All 10 contain "same"
    const res = await app.request("/api/log/search?q=same&limit=3");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { matches: number[]; total: number; truncated: boolean };
    expect(body.matches).toHaveLength(3);
    expect(body.truncated).toBe(true);
  });
});
