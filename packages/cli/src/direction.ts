// classifyDirection — infer wire direction from a JSON-RPC envelope when the
// log was captured on the CLIENT side of an AHP transport (e.g. VS Code's
// Copilot AHP log). Server-side logs would invert this; a future flag will
// inject a different inference function. Plan 02-05 Task 1.
//
// Rules (in order):
//   1. Non-object → 'c2s' (defensive default)
//   2. method === 'action' or 'notification' → 's2c' (server-originated)
//   3. has 'result' or 'error' (no method) → 's2c' (incoming response)
//   4. has 'method' (request or client notification) → 'c2s'
//   5. fallback → 'c2s'

import type { Direction } from "@ahp-inspector/shared";

export function classifyDirection(raw: unknown): Direction {
  if (raw === null || typeof raw !== "object") return "c2s";
  const r = raw as {
    method?: unknown;
    id?: unknown;
    result?: unknown;
    error?: unknown;
  };
  if (r.method === "action" || r.method === "notification") return "s2c";
  if ("result" in r || "error" in r) return "s2c";
  if (typeof r.method === "string") return "c2s";
  return "c2s";
}
