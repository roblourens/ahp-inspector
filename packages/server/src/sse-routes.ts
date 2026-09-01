// SSE routes for the open log:
//   - GET /api/log/meta    -> JSON LogMeta (basename only, T-02-03)
//                            204 No Content when no session is active.
//   - GET /api/log/stream  -> snapshot-begin -> snapshot-chunk* -> snapshot-end
//                            -> live append/patch/error -> ping every 20s -> bye
//                            409 {code:"no-active-log"} when no session.
//
// Snapshot writes are awaited so the transport applies backpressure directly.
// Live frames emitted while a write is blocked use a bounded per-client queue.

import { Buffer } from "node:buffer";
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { SsePayload } from "./app-state.js";
import type { ActiveSession, LogSessionManager } from "./session-manager.js";

const SNAPSHOT_CHUNK = 2000;
const PING_INTERVAL_MS = 20_000;

// Cap concurrent live-tail streams so a buggy or hostile client can't exhaust
// server resources by opening unbounded SSE connections.
export const MAX_SSE_CONNECTIONS = 8;

export interface SseBackpressureLimits {
  readonly maxBytes: number;
  readonly maxFrames: number;
  readonly maxRows: number;
}

export const DEFAULT_SSE_BACKPRESSURE_LIMITS: SseBackpressureLimits = {
  maxBytes: 4 * 1024 * 1024,
  maxFrames: 128,
  maxRows: 10_000,
};

interface QueuedFrame {
  readonly payload: SsePayload;
  readonly data: string;
  readonly byteLength: number;
  readonly rowCount: number;
  readonly coalesced: boolean;
}

type EndReason = "abort" | "overflow" | "reset";

export function registerLogRoutes(
  app: Hono,
  sessions: LogSessionManager,
  limits: SseBackpressureLimits = DEFAULT_SSE_BACKPRESSURE_LIMITS,
): void {
  let activeStreams = 0;

  app.get("/api/log/meta", (c) => {
    const a = sessions.current();
    if (!a) return c.body(null, 204);
    return c.json(a.appState.meta);
  });

  app.get("/api/log/stream", (c) => {
    const initial = sessions.current();
    if (!initial) {
      return c.json({ code: "no-active-log" }, 409);
    }
    if (activeStreams >= MAX_SSE_CONNECTIONS) {
      return c.json({ code: "too-many-streams" }, 503);
    }

    activeStreams++;
    return streamSSE(c, async (stream) => {
      const a: ActiveSession = initial;
      const queue: QueuedFrame[] = [];
      let pendingBytes = 0;
      let pendingFrames = 0;
      let pendingRows = 0;
      let heartbeatDue = false;
      let endReason: EndReason | null = null;
      let wake: (() => void) | undefined;
      let offAppState: (() => void) | undefined;
      let offSessionChange: (() => void) | undefined;
      let pinger: ReturnType<typeof setInterval> | undefined;

      const notify = (): void => {
        const resolve = wake;
        wake = undefined;
        resolve?.();
      };

      const clearQueuedFrames = (): void => {
        for (const frame of queue) {
          pendingBytes -= frame.byteLength;
          pendingFrames -= 1;
          pendingRows -= frame.rowCount;
        }
        queue.length = 0;
      };

      const detachAppState = (): void => {
        const off = offAppState;
        offAppState = undefined;
        off?.();
      };

      const requestEnd = (reason: EndReason): void => {
        if (endReason !== null) return;
        endReason = reason;
        clearQueuedFrames();
        detachAppState();
        notify();
      };

      const exceedsLimits = (bytes: number, frames: number, rows: number): boolean =>
        bytes > limits.maxBytes || frames > limits.maxFrames || rows > limits.maxRows;

      const enqueue = (payload: SsePayload): void => {
        if (endReason !== null) return;

        const last = queue.at(-1);
        const coalesced =
          last && canCoalesce(last, payload) ? coalescePayloads(last.payload, payload) : undefined;
        if (last && coalesced) {
          const replacement = makeQueuedFrame(coalesced, true);
          const nextBytes = pendingBytes - last.byteLength + replacement.byteLength;
          const nextRows = pendingRows - last.rowCount + replacement.rowCount;
          if (exceedsLimits(nextBytes, pendingFrames, nextRows)) {
            requestEnd("overflow");
            return;
          }
          queue[queue.length - 1] = replacement;
          pendingBytes = nextBytes;
          pendingRows = nextRows;
          notify();
          return;
        }

        const frame = makeQueuedFrame(payload);
        const nextBytes = pendingBytes + frame.byteLength;
        const nextFrames = pendingFrames + 1;
        const nextRows = pendingRows + frame.rowCount;
        if (exceedsLimits(nextBytes, nextFrames, nextRows)) {
          requestEnd("overflow");
          return;
        }

        queue.push(frame);
        pendingBytes = nextBytes;
        pendingFrames = nextFrames;
        pendingRows = nextRows;
        notify();
      };

      const writeFrame = async (frame: QueuedFrame): Promise<void> => {
        await stream.writeSSE({ event: frame.payload.kind, data: frame.data });
      };

      const drainQueue = async (): Promise<void> => {
        while (queue.length > 0 && endReason === null && !stream.aborted) {
          const frame = queue.shift();
          if (!frame) break;
          await writeFrame(frame);
          pendingBytes -= frame.byteLength;
          pendingFrames -= 1;
          pendingRows -= frame.rowCount;
        }
      };

      const waitForWork = async (): Promise<void> => {
        if (queue.length > 0 || heartbeatDue || endReason !== null || stream.aborted) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
          if (queue.length > 0 || heartbeatDue || endReason !== null || stream.aborted) {
            notify();
          }
        });
      };

      const writePayload = async (payload: SsePayload): Promise<void> => {
        await writeFrame(makeQueuedFrame(payload));
      };

      const writeTermination = async (): Promise<void> => {
        if (stream.aborted || endReason === "abort") return;
        if (endReason === "overflow") {
          await writePayload({
            kind: "error",
            code: "stream-overflow",
            message:
              "Live updates exceeded this client's bounded queue; reconnect to resynchronize.",
          });
        }
        await writePayload({ kind: "log-reset" });
        await writePayload({ kind: "bye" });
      };

      try {
        stream.onAbort(() => requestEnd("abort"));
        offSessionChange = sessions.onChange(() => requestEnd("reset"));
        offAppState = a.appState.subscribe(enqueue);
        if (endReason !== null) {
          detachAppState();
        }

        const snap = a.appState.snapshot();
        await writePayload({ kind: "snapshot-begin", meta: snap.meta, total: snap.rows.length });
        if (endReason !== null || stream.aborted) {
          await writeTermination();
          return;
        }

        for (let i = 0; i < snap.rows.length; i += SNAPSHOT_CHUNK) {
          await writePayload({
            kind: "snapshot-chunk",
            rows: snap.rows.slice(i, i + SNAPSHOT_CHUNK),
            from: i,
          });
          if (endReason !== null || stream.aborted) {
            await writeTermination();
            return;
          }
          // Yield so a huge baseline doesn't starve the event loop.
          await stream.sleep(0);
        }

        await writePayload({ kind: "snapshot-end" });
        if (snap.loadProgress.phase !== "idle") {
          await writePayload(snap.loadProgress);
        }
        if (endReason !== null || stream.aborted) {
          await writeTermination();
          return;
        }

        if (queue.length > 0) {
          await writePayload({
            kind: "stream-backlog",
            queuedFrames: queue.length,
            queuedRows: queue.reduce((total, frame) => total + frame.rowCount, 0),
          });
          await drainQueue();
          if (endReason !== null || stream.aborted) {
            await writeTermination();
            return;
          }
          await writePayload({ kind: "stream-backlog", queuedFrames: 0, queuedRows: 0 });
        }

        pinger = setInterval(() => {
          heartbeatDue = true;
          notify();
        }, PING_INTERVAL_MS);

        while (endReason === null && !stream.aborted) {
          await waitForWork();
          if (endReason !== null || stream.aborted) break;
          await drainQueue();
          if (heartbeatDue && endReason === null && !stream.aborted) {
            heartbeatDue = false;
            await writePayload({ kind: "ping" });
          }
        }

        await writeTermination();
      } finally {
        if (pinger) clearInterval(pinger);
        clearQueuedFrames();
        detachAppState();
        const off = offSessionChange;
        offSessionChange = undefined;
        off?.();
        activeStreams--;
      }
    });
  });
}

function makeQueuedFrame(payload: SsePayload, coalesced = false): QueuedFrame {
  const data = JSON.stringify(payload);
  return {
    payload,
    data,
    byteLength: Buffer.byteLength(`event: ${payload.kind}\ndata: ${data}\n\n`, "utf8"),
    rowCount: payloadRowCount(payload),
    coalesced,
  };
}

function payloadRowCount(payload: SsePayload): number {
  if (payload.kind === "append" || payload.kind === "snapshot-chunk") {
    return payload.rows.length;
  }
  if (payload.kind === "patch") {
    return payload.updates.length;
  }
  return 0;
}

function coalescePayloads(previous: SsePayload, next: SsePayload): SsePayload | undefined {
  if (
    previous.kind === "append" &&
    next.kind === "append" &&
    previous.from + previous.rows.length === next.from
  ) {
    return { kind: "append", from: previous.from, rows: [...previous.rows, ...next.rows] };
  }
  if (previous.kind === "patch" && next.kind === "patch") {
    return { kind: "patch", updates: [...previous.updates, ...next.updates] };
  }
  if (previous.kind === "load-progress" && next.kind === "load-progress") {
    return next;
  }
  if (previous.kind === "stream-backlog" && next.kind === "stream-backlog") {
    return next;
  }
  return undefined;
}

function canCoalesce(previous: QueuedFrame, next: SsePayload): boolean {
  if (previous.payload.kind === "load-progress" || previous.payload.kind === "stream-backlog") {
    return previous.payload.kind === next.kind;
  }
  // Limit growing array merges to pairs so a stalled client cannot turn a
  // long append/patch run into quadratic copying and serialization work.
  return !previous.coalesced;
}
