// session-routes.ts — Phase 04-03 Task 2.
//
// REST endpoints for the active log session lifecycle:
//   GET  /api/sessions/discover  → DiscoveryResult (candidates + truncated)
//   POST /api/sessions/open      body {id} | {path} → {active:{logKey,meta}}
//   POST /api/sessions/close     → {active:null}
//   GET  /api/sessions/active    → {active:{logKey,meta}|null}
//
// T-04-03-02: error responses NEVER echo the user-typed path; we send only
// {code, message:code}. T-04-03-07: bad JSON bodies return 400 bad-request.

import { discoverVsCodeLogs } from "@ahp-viewer/host-node";
import type { Hono } from "hono";
import type { LogSessionManager } from "./session-manager.js";

export function registerSessionRoutes(app: Hono, sessions: LogSessionManager): void {
  app.get("/api/sessions/discover", async (c) => {
    const r = await discoverVsCodeLogs();
    return c.json({ candidates: r.candidates, truncated: r.truncated });
  });

  app.post("/api/sessions/open", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ code: "bad-request", message: "invalid JSON" }, 400);
    }
    if (!body || typeof body !== "object") {
      return c.json({ code: "bad-request", message: "expected {id} or {path}" }, 400);
    }
    const b = body as { id?: unknown; path?: unknown };
    try {
      let active;
      if (typeof b.path === "string") {
        active = await sessions.open({ path: b.path });
      } else if (typeof b.id === "string") {
        active = await sessions.open({ id: b.id });
      } else {
        return c.json({ code: "bad-request", message: "expected {id} or {path}" }, 400);
      }
      return c.json({ active: { logKey: active.logKey, meta: active.appState.meta } });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const code = typeof e.code === "string" ? e.code : "not-found";
      const status =
        code === "path-too-long" ||
        code === "bad-request" ||
        code === "not-a-file" ||
        code === "not-readable"
          ? 400
          : 404;
      // T-04-03-02: never include the original path in the response body.
      return c.json({ code, message: code }, status);
    }
  });

  app.post("/api/sessions/close", async (c) => {
    await sessions.close();
    return c.json({ active: null });
  });

  app.get("/api/sessions/active", (c) => {
    const a = sessions.current();
    if (!a) return c.json({ active: null });
    return c.json({ active: { logKey: a.logKey, meta: a.appState.meta } });
  });
}
