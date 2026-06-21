// sse-cap.test.ts — GET /api/log/stream concurrency cap (Plan 32-01).
//
// Opening MAX_SSE_CONNECTIONS live-tail streams succeeds; the next one is
// rejected with 503 {code:"too-many-streams"}. Closing a stream frees a slot.

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AppState, LogMeta } from "./app-state.js";
import { SearchIndex } from "./search-index.js";
import type { ActiveSession, LogSessionManager } from "./session-manager.js";
import { MAX_SSE_CONNECTIONS, registerLogRoutes } from "./sse-routes.js";

function makeEmptyAppState(): AppState {
  const meta: LogMeta = {
    filename: "test.jsonl",
    sizeBytes: 0,
    startedAt: 0,
    logKey: "0".repeat(32),
  };
  return {
    meta,
    searchIndex: new SearchIndex(),
    snapshot: () => ({
      meta,
      rows: [],
      loadProgress: { kind: "load-progress", phase: "idle", loadedRows: 0, loadedBytes: 0 },
    }),
    subscribe: () => () => {},
    runFlush: () => {},
    eventAt: () => null,
    correlatorDataFor: () => ({ pairIdx: null, latencyMs: null, status: "n/a" }),
    stateAtIndex: (targetIndex: number) => ({
      totalEvents: 0,
      result: { targetIndex, resources: [], intents: [], diagnostics: [] },
      cache: { hit: false, size: 0, maxEntries: 25 },
    }),
    dispose: async () => {},
  };
}

function fakeSessions(appState: AppState): LogSessionManager {
  const active: ActiveSession = { logKey: appState.meta.logKey, appState };
  return {
    current: () => active,
    discover: async () => ({ candidates: [], truncated: false }),
    open: async () => active,
    close: async () => {},
    onChange: () => () => {},
    dispose: async () => {},
  };
}

function makeApp() {
  const app = new Hono();
  registerLogRoutes(app, fakeSessions(makeEmptyAppState()));
  return app;
}

function openStream(app: Hono): Promise<Response> {
  return Promise.resolve(app.fetch(new Request("http://localhost/api/log/stream")));
}

describe("GET /api/log/stream connection cap", () => {
  it("accepts up to MAX_SSE_CONNECTIONS then returns 503, recovering after a close", async () => {
    const app = makeApp();
    const open: Response[] = [];
    for (let i = 0; i < MAX_SSE_CONNECTIONS; i++) {
      const res = await openStream(app);
      expect(res.status).toBe(200);
      open.push(res);
    }

    // One past the cap is rejected.
    const overflow = await openStream(app);
    expect(overflow.status).toBe(503);
    expect(((await overflow.json()) as { code: string }).code).toBe("too-many-streams");

    // Close one stream; its slot should free up and a new stream can connect.
    await open[0]?.body?.cancel();
    await vi.waitFor(
      async () => {
        const retry = await openStream(app);
        expect(retry.status).toBe(200);
        open.push(retry);
      },
      { timeout: 2000, interval: 25 },
    );

    // Tear down the remaining open streams.
    for (const res of open.slice(1)) {
      await res.body?.cancel().catch(() => {});
    }
  });
});
