// search-routes.ts — GET /api/log/search?q=...
// Server-side substring search over the per-event haystack built by SearchIndex.
// T-03-01-01: no regex from user input; T-03-01-02: result count hard-capped.

import type { Hono } from "hono";
import { SearchIndexChangedError } from "./search-index.js";
import type { LogSessionManager } from "./session-manager.js";

const MAX_QUERY_LEN = 256;
const MAX_RESULTS = 5000;

export function registerSearchRoutes(app: Hono, sessions: LogSessionManager): void {
  app.get("/api/log/search", async (c) => {
    const a = sessions.current();
    if (!a) {
      return c.json({ code: "no-active-log" }, 409);
    }
    const rawQ = c.req.query("q") ?? "";
    // T-03-01-01: lowercase + slice to cap length before scan (no regex)
    const q = rawQ.toLowerCase().slice(0, MAX_QUERY_LEN);
    const rawLimit = parseInt(c.req.query("limit") ?? String(MAX_RESULTS), 10);
    // T-03-01-02: clamp limit to MAX_RESULTS regardless of client request
    const limit = Math.min(
      Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : MAX_RESULTS,
      MAX_RESULTS,
    );
    try {
      const { matches, truncated } = await a.appState.searchIndex.scanAsync(q, limit);
      return c.json({ matches, total: matches.length, truncated });
    } catch (error) {
      if (error instanceof SearchIndexChangedError) {
        return c.json({ code: "log-changed", message: "active log changed" }, 409);
      }
      throw error;
    }
  });
}
