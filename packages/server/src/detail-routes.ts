// detail-routes.ts — GET /api/log/event/:idx
// Returns the full AhpEvent envelope (including raw payload) plus correlator
// metadata for the UI detail panel (DETAIL-02, DETAIL-04).
// T-03-01-03: idx validated; T-03-01-04: no absolute file paths in response.

import type { Status } from "@ahp-viewer/core";
import type { AhpEvent } from "@ahp-viewer/shared";
import type { Hono } from "hono";
import type { AppState } from "./app-state.js";

export type DetailResponse = {
  event: AhpEvent;
  pair: AhpEvent | null;
  latencyMs: number | null;
  status: Status;
  pairIdx: number | null;
};

export function registerDetailRoutes(app: Hono, appState: AppState): void {
  app.get("/api/log/event/:idx", (c) => {
    const raw = c.req.param("idx");
    const idx = Number(raw);
    // T-03-01-03: validate idx before any store access
    if (!Number.isInteger(idx) || idx < 0) {
      return c.json({ error: "invalid idx" }, 400);
    }
    const event = appState.eventAt(idx);
    if (!event) {
      return c.json({ error: "not found" }, 404);
    }
    const correlatorData = appState.correlatorDataFor(idx);
    const pairIdx = correlatorData.pairIdx;
    const pair = pairIdx !== null ? (appState.eventAt(pairIdx) ?? null) : null;
    const response: DetailResponse = {
      event,
      pair,
      latencyMs: correlatorData.latencyMs,
      status: correlatorData.status,
      pairIdx,
    };
    return c.json(response, 200);
  });
}
