// SSE routes for the open log:
//   - GET /api/log/meta    → JSON LogMeta (basename only, T-02-03)
//   - GET /api/log/stream  → snapshot-begin → snapshot-chunk* → snapshot-end
//                            → live append/patch/error → ping every 20s → bye
//
// 02-RESEARCH.md Pattern 2. Snapshot is chunked at SNAPSHOT_CHUNK rows so
// large baselines don't block the event loop. Subscriber is unwired on
// stream abort so dropped clients do not leak listeners (T-02-04d).

import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppState, SsePayload } from "./app-state.js";

const SNAPSHOT_CHUNK = 2000;
const PING_INTERVAL_MS = 20_000;

export function registerLogRoutes(app: Hono, appState: AppState): void {
  app.get("/api/log/meta", (c) => c.json(appState.meta));

  app.get("/api/log/stream", (c) =>
    streamSSE(c, async (stream) => {
      // 1. Snapshot.
      const snap = appState.snapshot();
      await stream.writeSSE({
        event: "snapshot-begin",
        data: JSON.stringify({ meta: snap.meta, total: snap.rows.length }),
      });
      for (let i = 0; i < snap.rows.length; i += SNAPSHOT_CHUNK) {
        if (stream.aborted || stream.closed) return;
        const chunk = snap.rows.slice(i, i + SNAPSHOT_CHUNK);
        await stream.writeSSE({
          event: "snapshot-chunk",
          data: JSON.stringify({ rows: chunk, from: i }),
        });
        // Yield so a huge baseline doesn't starve the event loop.
        await stream.sleep(0);
      }
      if (stream.aborted || stream.closed) return;
      await stream.writeSSE({ event: "snapshot-end", data: "{}" });

      // 2. Live frames — fan out AppState payloads as SSE events.
      const queue: SsePayload[] = [];
      let pumping = false;
      const pump = async (): Promise<void> => {
        if (pumping) return;
        pumping = true;
        try {
          while (queue.length > 0 && !stream.aborted && !stream.closed) {
            const msg = queue.shift();
            if (!msg) break;
            try {
              await stream.writeSSE({ event: msg.kind, data: JSON.stringify(msg) });
            } catch {
              return;
            }
          }
        } finally {
          pumping = false;
        }
      };
      const off = appState.subscribe((msg: SsePayload) => {
        queue.push(msg);
        void pump();
      });

      // 3. Heartbeat. Wait for the abort signal; the interval keeps the
      //    connection alive while the AppState subscriber drives data frames.
      const pinger = setInterval(() => {
        if (stream.aborted || stream.closed) return;
        stream.writeSSE({ event: "ping", data: "{}" }).catch(() => {
          /* aborted between checks */
        });
      }, PING_INTERVAL_MS);

      await new Promise<void>((resolveWait) => {
        if (stream.aborted || stream.closed) {
          resolveWait();
          return;
        }
        stream.onAbort(() => resolveWait());
      });

      clearInterval(pinger);
      try {
        off();
      } catch {
        /* ignore */
      }
      // Best-effort goodbye. May silently fail if the client already left.
      try {
        await stream.writeSSE({ event: "bye", data: "{}" });
      } catch {
        /* ignore */
      }
    }),
  );
}
