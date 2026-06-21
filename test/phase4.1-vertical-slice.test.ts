import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DiscoveryResult, Disposable, HostAdapter, LogHandle } from "@ahp-inspector/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AppState,
  createAppState,
  type SsePayload,
} from "../packages/server/src/app-state.js";

const SAFE_FIXTURE = resolve("test/fixtures/phase4.1-real-shapes.safe.jsonl");

interface FakeLogHandle extends LogHandle {
  readonly path: string;
  readonly size: number;
}

interface FakeHost extends HostAdapter {
  push(text: string): void;
}

type WatchSinkObj = {
  onChunk(bytes: Uint8Array, byteOffset: number): void;
  onReset(info: { newSize: number; reason: "shrink" | "rename" }): void;
  onError(err: Error, fatal: boolean): void;
};

function makeHost(path: string): FakeHost {
  let sink: WatchSinkObj | null = null;
  let offset = 0;
  const encoder = new TextEncoder();
  const handle: FakeLogHandle = { id: path, path, size: 0 };
  return {
    discoverLogs: async (): Promise<DiscoveryResult> => ({ candidates: [], truncated: false }),
    openLog: async (): Promise<LogHandle> => handle,
    watchLog: (_h: LogHandle, sinkOrChunk): Disposable => {
      if (typeof sinkOrChunk === "function") {
        const fn = sinkOrChunk;
        sink = { onChunk: (bytes) => fn(bytes), onReset: () => {}, onError: () => {} };
      } else {
        sink = sinkOrChunk as WatchSinkObj;
      }
      return {
        dispose: () => {
          sink = null;
        },
      };
    },
    close: async () => {},
    push(text: string): void {
      if (!sink) throw new Error("watchLog not subscribed");
      const bytes = encoder.encode(text);
      sink.onChunk(bytes, offset);
      offset += bytes.byteLength;
    },
  };
}

function inferDirection(raw: unknown): "c2s" | "s2c" {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if ("result" in rec || "error" in rec) return "s2c";
  if (rec.method === "action" || rec.method === "notification") return "s2c";
  return "c2s";
}

function assertSafePayload(value: string): void {
  expect(value).not.toMatch(/\/Users\//);
  expect(value).not.toMatch(/\/home\//);
  expect(value).not.toMatch(/[A-Za-z]:\\/);
  expect(value).not.toMatch(/Authorization|Bearer|token|secret|cookie/i);
}

describe("Phase 04.1 vertical slice — safe real-shaped row polish fixture", () => {
  let state: AppState | undefined;

  afterEach(async () => {
    if (state) {
      await state.dispose();
      state = undefined;
    }
  });

  it("loads the safe fixture with summaries, session/turn values, pair metadata, details, and append patches", async () => {
    const host = makeHost(SAFE_FIXTURE);
    state = await createAppState({
      host,
      file: SAFE_FIXTURE,
      flushIntervalMs: 0,
      directionInference: inferDirection,
    });
    const captured: SsePayload[] = [];
    state.subscribe((payload) => captured.push(payload));

    const body = await readFile(SAFE_FIXTURE, "utf8");
    assertSafePayload(body);
    host.push(body.endsWith("\n") ? body : `${body}\n`);

    const rows = state.snapshot().rows;
    expect(rows.length).toBeGreaterThanOrEqual(10);

    const request = rows.find((row) => row.method === "resourceList");
    expect(request).toBeTruthy();
    if (!request) return;
    expect(request.keyId).toBe("1001");
    expect(request.sessionShort).toBeNull();
    expect(request.turnShort).toBeNull();
    expect(request.summary).toBe("uri=safe-resource.md");
    expect(request.pairIdx).not.toBeNull();

    const response = request.pairIdx !== null ? rows[request.pairIdx] : undefined;
    expect(response?.kind).toBe("response");
    expect(response?.pairIdx).toBe(request.idx);
    expect(response?.summary).toContain("resourceList result");

    const sessionRow = rows.find((row) => row.sessionId === "safe-session-gamma");
    expect(sessionRow?.sessionShort).toBe("safe-session-gamma");
    // turnShort now preserves the clean turn id (no naive trailing slice).
    expect(sessionRow?.turnShort).toBe("gamma-000003");

    expect(rows.some((row) => row.summary === "error -32001: safe synthetic failure")).toBe(true);
    expect(rows.some((row) => row.summary.startsWith('"Synthetic assistant delta'))).toBe(true);
    expect(rows.some((row) => row.summary.startsWith("tool call readFile"))).toBe(true);
    expect(rows.some((row) => row.summary.startsWith("tool result readFile"))).toBe(true);
    expect(
      rows.some(
        (row) =>
          row.summary.startsWith("notification progress") || row.summary.startsWith("status "),
      ),
    ).toBe(true);
    expect(
      rows.some((row) => row.kind === "parse-error" && row.summary.startsWith("parse error line")),
    ).toBe(true);

    const hiddenVisibleIdxs = new Set(
      rows.filter((row) => row.idx !== request.pairIdx).map((row) => row.idx),
    );
    expect(request.pairIdx !== null && !hiddenVisibleIdxs.has(request.pairIdx)).toBe(true);

    const detailEvent = state.eventAt(request.idx);
    expect(detailEvent?.raw).toBeTruthy();
    expect(state.correlatorDataFor(request.idx).pairIdx).toBe(request.pairIdx);

    const beforeAppendCount = rows.length;
    host.push(
      `${JSON.stringify({
        jsonrpc: "2.0",
        method: "action",
        params: {
          serverSeq: 99,
          action: {
            type: "delta",
            sessionId: "safe-session-append",
            turnId: "turn-append-000006",
            delta: "Safe appended event",
          },
        },
      })}\n`,
    );
    const append = captured.find(
      (payload) =>
        payload.kind === "append" &&
        payload.from === beforeAppendCount &&
        payload.rows.some((row) => row.summary === '"Safe appended event"'),
    );
    expect(append).toBeTruthy();
  });
});
