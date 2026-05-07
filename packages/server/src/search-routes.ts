// search-routes.ts — GET /api/log/search?q=...
// Server-side substring search over the per-event haystack built by SearchIndex.
// T-03-01-01: no regex from user input; T-03-01-02: result count hard-capped.

import type { Hono } from "hono";
import type { AppState } from "./app-state.js";

const MAX_QUERY_LEN = 256;
const MAX_RESULTS = 5000;

export function registerSearchRoutes(app: Hono, appState: AppState): void {
  app.get("/api/log/search", (c) => {
    const rawQ = c.req.query("q") ?? "";
    // T-03-01-01: lowercase + slice to cap length before scan (no regex)
    const q = rawQ.toLowerCase().slice(0, MAX_QUERY_LEN);
    const rawLimit = parseInt(c.req.query("limit") ?? String(MAX_RESULTS), 10);
    // T-03-01-02: clamp limit to MAX_RESULTS regardless of client request
    const limit = Math.min(
      Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : MAX_RESULTS,
      MAX_RESULTS,
    );
    const { matches, truncated } = appState.searchIndex.scan(q, limit);
    return c.json({ matches, total: matches.length, truncated });
  });
}
