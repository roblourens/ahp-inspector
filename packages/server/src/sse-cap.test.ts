// sse-cap.test.ts — GET /api/log/stream concurrency cap (Plan 32-01).
//
// Opening MAX_SSE_CONNECTIONS live-tail streams succeeds; the next one is
// rejected with 503 {code:"too-many-streams"}. Closing a stream frees a slot.

import type { EventRow } from "@ahp-inspector/core";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AppState, LogMeta, SsePayload } from "./app-state.js";
import { SearchIndex } from "./search-index.js";
import type { ActiveSession, LogSessionManager } from "./session-manager.js";
import {
  MAX_SSE_CONNECTIONS,
  registerLogRoutes,
  type SseBackpressureLimits,
} from "./sse-routes.js";

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

function makeRow(idx: number): EventRow {
  return {
    idx,
    seq: idx,
    ts: idx,
    tsFmt: "00:00:00.000",
    dir: "s2c",
    dirGlyph: "←",
    kind: "server-notification",
    kindTag: "NTF",
    method: "test",
    actionType: null,
    actionFamily: null,
    sessionId: null,
    sessionShort: null,
    turnId: null,
    turnShort: null,
    keyId: null,
    status: "n/a",
    latencyMs: null,
    latencyBand: null,
    payloadPreview: "",
    parseErrorReason: null,
    lineIndex: idx + 1,
    errorCode: null,
    serverSeq: null,
    previousServerSeq: null,
    gapBefore: false,
    isAuthFailure: false,
  };
}

function makeControlledApp(limits: SseBackpressureLimits) {
  const appState = makeEmptyAppState();
  let streamListener: ((payload: SsePayload) => void) | undefined;
  let sessionListener: ((active: ActiveSession | null) => void) | undefined;
  let streamUnsubscribes = 0;
  let sessionUnsubscribes = 0;
  const controlledState: AppState = {
    ...appState,
    subscribe: (listener) => {
      streamListener = listener;
      return () => {
        streamListener = undefined;
        streamUnsubscribes++;
      };
    },
  };
  const active: ActiveSession = { logKey: controlledState.meta.logKey, appState: controlledState };
  const sessions: LogSessionManager = {
    ...fakeSessions(controlledState),
    current: () => active,
    onChange: (listener) => {
      sessionListener = listener;
      return () => {
        sessionListener = undefined;
        sessionUnsubscribes++;
      };
    },
  };
  const app = new Hono();
  registerLogRoutes(app, sessions, limits);
  return {
    app,
    emit(payload: SsePayload) {
      expect(streamListener).toBeDefined();
      streamListener?.(payload);
    },
    reset() {
      sessionListener?.(null);
    },
    cleanupCounts() {
      return { streamUnsubscribes, sessionUnsubscribes };
    },
  };
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

describe("GET /api/log/stream backpressure", () => {
  it.each([
    {
      name: "frames",
      limits: { maxBytes: 10_000, maxFrames: 2, maxRows: 100 },
      emit: (harness: ReturnType<typeof makeControlledApp>) => {
        for (let i = 0; i < 3; i++) {
          harness.emit({ kind: "watch-error", code: "read-error", message: `failure-${i}` });
        }
      },
    },
    {
      name: "bytes",
      limits: { maxBytes: 100, maxFrames: 10, maxRows: 100 },
      emit: (harness: ReturnType<typeof makeControlledApp>) => {
        harness.emit({ kind: "watch-error", code: "read-error", message: "x".repeat(200) });
      },
    },
    {
      name: "rows",
      limits: { maxBytes: 10_000, maxFrames: 10, maxRows: 1 },
      emit: (harness: ReturnType<typeof makeControlledApp>) => {
        harness.emit({
          kind: "patch",
          updates: [0, 1].map((idx) => ({
            idx,
            status: "n/a",
            latencyMs: null,
            latencyBand: null,
            pairIdx: null,
          })),
        });
      },
    },
  ])("disconnects a slow client with an explicit resync when the $name cap is exceeded", async ({
    limits,
    emit,
  }) => {
    const harness = makeControlledApp(limits);
    const response = await openStream(harness.app);

    // Do not consume the body yet: snapshot-begin remains backpressured while
    // live frames accumulate in this client's bounded queue.
    emit(harness);

    const body = await response.text();
    expect(body).toContain("event: error");
    expect(body).toContain('"code":"stream-overflow"');
    expect(body).toContain("event: log-reset");
    expect(body).toContain("event: bye");
    expect(harness.cleanupCounts()).toEqual({
      streamUnsubscribes: 1,
      sessionUnsubscribes: 1,
    });
  });

  it("coalesces contiguous appends without changing snapshot/live ordering", async () => {
    const harness = makeControlledApp({ maxBytes: 10_000, maxFrames: 1, maxRows: 10 });
    const response = await openStream(harness.app);
    harness.emit({ kind: "append", from: 0, rows: [makeRow(0)] });
    harness.emit({ kind: "append", from: 1, rows: [makeRow(1)] });

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const decoder = new TextDecoder();
    let body = "";
    while (!body.includes("event: append")) {
      const chunk = await reader?.read();
      expect(chunk?.done).toBe(false);
      if (chunk?.value) body += decoder.decode(chunk.value, { stream: true });
    }

    expect(body.indexOf("event: snapshot-end")).toBeLessThan(body.indexOf("event: append"));
    expect(body.match(/event: append/g)).toHaveLength(1);
    const appendData = body.match(/event: append\ndata: (.+)\n\n/)?.[1];
    expect(appendData).toBeDefined();
    expect(JSON.parse(appendData ?? "{}") as { from: number; rows: EventRow[] }).toMatchObject({
      from: 0,
      rows: [{ idx: 0 }, { idx: 1 }],
    });

    await reader?.cancel();
    await vi.waitFor(() => {
      expect(harness.cleanupCounts()).toEqual({
        streamUnsubscribes: 1,
        sessionUnsubscribes: 1,
      });
    });
  });

  it("cleans up and resynchronizes if the active session changes during the snapshot", async () => {
    const harness = makeControlledApp({ maxBytes: 10_000, maxFrames: 10, maxRows: 10 });
    const response = await openStream(harness.app);

    // Keep snapshot-begin blocked, then replace the active session.
    harness.reset();

    const body = await response.text();
    expect(body).toContain("event: snapshot-begin");
    expect(body).not.toContain("event: snapshot-end");
    expect(body).toContain("event: log-reset");
    expect(body).toContain("event: bye");
    expect(harness.cleanupCounts()).toEqual({
      streamUnsubscribes: 1,
      sessionUnsubscribes: 1,
    });
  });
});
