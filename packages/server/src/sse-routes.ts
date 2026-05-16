// SSE routes for the open log:
//   - GET /api/log/meta    → JSON LogMeta (basename only, T-02-03)
//                            204 No Content when no session is active.
//   - GET /api/log/stream  → snapshot-begin → snapshot-chunk* → snapshot-end
//                            → live append/patch/error → ping every 20s → bye
//                            409 {code:"no-active-log"} when no session.
//
// 02-RESEARCH.md Pattern 2. Snapshot is chunked at SNAPSHOT_CHUNK rows so
// large baselines don't block the event loop. Subscriber is unwired on
// stream abort so dropped clients do not leak listeners (T-02-04d).
//
// 04-03 additions: subscribe to sessions.onChange and emit `log-reset` on
// any active-session transition (open/close/switch) so the UI can re-fetch
// state cleanly. The stream then says bye and closes (T-04-03-05).

import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { SsePayload } from "./app-state.js";
import type { ActiveSession, LogSessionManager } from "./session-manager.js";

const SNAPSHOT_CHUNK = 2000;
const PING_INTERVAL_MS = 20_000;

export function registerLogRoutes(app: Hono, sessions: LogSessionManager): void {
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
    return streamSSE(c, async (stream) => {
      const a: ActiveSession = initial;

      const queue: SsePayload[] = [];
      let queueStart = 0;
      let pumping = false;
      let snapshotStreaming = true;
      const queuedFrameCount = (): number => queue.length - queueStart;
      const pump = async (): Promise<void> => {
        if (pumping || snapshotStreaming) return;
        pumping = true;
        try {
          while (queuedFrameCount() > 0 && !stream.aborted && !stream.closed) {
            const msg = queue[queueStart++];
            if (!msg) break;
            try {
              await stream.writeSSE({ event: msg.kind, data: JSON.stringify(msg) });
            } catch {
              return;
            }
          }
        } finally {
          if (queueStart === queue.length) {
            queue.length = 0;
            queueStart = 0;
          }
          pumping = false;
        }
      };
      const off = a.appState.subscribe((msg: SsePayload) => {
        queue.push(msg);
        void pump();
      });

      // 1. Snapshot.
      const snap = a.appState.snapshot();
      await stream.writeSSE({
        event: "snapshot-begin",
        data: JSON.stringify({ meta: snap.meta, total: snap.rows.length }),
      });
      for (let i = 0; i < snap.rows.length; i += SNAPSHOT_CHUNK) {
        if (stream.aborted || stream.closed) {
          off();
          return;
        }
        const chunk = snap.rows.slice(i, i + SNAPSHOT_CHUNK);
        await stream.writeSSE({
          event: "snapshot-chunk",
          data: JSON.stringify({ rows: chunk, from: i }),
        });
        // Yield so a huge baseline doesn't starve the event loop.
        await stream.sleep(0);
      }
      if (stream.aborted || stream.closed) {
        off();
        return;
      }
      await stream.writeSSE({ event: "snapshot-end", data: "{}" });
      if (snap.loadProgress.phase !== "idle") {
        await stream.writeSSE({
          event: snap.loadProgress.kind,
          data: JSON.stringify(snap.loadProgress),
        });
      }
      snapshotStreaming = false;
      if (queuedFrameCount() > 0) {
        const queuedRows = queue
          .slice(queueStart)
          .reduce((total, msg) => total + (msg.kind === "append" ? msg.rows.length : 0), 0);
        const backlog: SsePayload = {
          kind: "stream-backlog",
          queuedFrames: queuedFrameCount(),
          queuedRows,
        };
        await stream.writeSSE({ event: backlog.kind, data: JSON.stringify(backlog) });
        await pump();
        const clearedBacklog: SsePayload = {
          kind: "stream-backlog",
          queuedFrames: 0,
          queuedRows: 0,
        };
        await stream.writeSSE({
          event: clearedBacklog.kind,
          data: JSON.stringify(clearedBacklog),
        });
      } else {
        await pump();
      }

      // 2. Live frames — AppState payloads continue through the same queue.

      // 2b. Watch session transitions. On any onChange, emit log-reset and end.
      let endRequested = false;
      const offChange = sessions.onChange(async () => {
        if (endRequested) return;
        endRequested = true;
        try {
          await stream.writeSSE({ event: "log-reset", data: "{}" });
        } catch {
          /* aborted */
        }
      });

      // 3. Heartbeat.
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
        // Also resolve when log-reset has been emitted so we close cleanly.
        const tick = setInterval(() => {
          if (endRequested) {
            clearInterval(tick);
            resolveWait();
          }
        }, 50);
      });

      clearInterval(pinger);
      try {
        off();
      } catch {
        /* ignore */
      }
      try {
        offChange();
      } catch {
        /* ignore */
      }
      // Best-effort goodbye. May silently fail if the client already left.
      try {
        await stream.writeSSE({ event: "bye", data: "{}" });
      } catch {
        /* ignore */
      }
    });
  });
}
