import type { AhpEvent, Direction, IdType } from "./event.js";

/**
 * Opaque correlation key shape: `${session}::${requestDir}::${idType}::${id}`.
 *
 * `session` is normalised to `'∅'` when null so that distinct null-session
 * streams remain disjoint from each other only when explicit sessions exist.
 *
 * Notifications and actions are NEVER correlated by this key — JSON-RPC
 * notifications carry no `id`. Use this only for request/response pairing.
 */
export type CorrelationKey = string;

const NULL_SESSION = "\u2205"; // ∅

/**
 * Build the canonical correlation key. Both sides of a request/response pair
 * share the same key only when their session, the **request** wire direction,
 * the original id type, and the stringified id all match.
 *
 * Notifications and actions MUST NOT be passed here.
 */
export function makeCorrelationKey(
  session: string | null,
  requestDir: Direction,
  idType: IdType,
  id: number | string | null,
): CorrelationKey {
  const sess = session ?? NULL_SESSION;
  return `${sess}::${requestDir}::${idType}::${String(id)}`;
}

/**
 * Correlation key for a request event — uses the request's own wire direction.
 *
 * Notifications and actions MUST NOT be passed here; they have no id.
 */
export function correlationKeyForRequest(ev: AhpEvent): CorrelationKey {
  return makeCorrelationKey(ev.sessionId, ev.dir, ev.idType, ev.id);
}

/**
 * Correlation key for a response event — INVERTS the wire direction so it
 * matches the originating request's key (Pitfall 2).
 *
 * Notifications and actions MUST NOT be passed here; they have no id.
 */
export function correlationKeyForResponse(ev: AhpEvent): CorrelationKey {
  const requestDir: Direction = ev.dir === "c2s" ? "s2c" : "c2s";
  return makeCorrelationKey(ev.sessionId, requestDir, ev.idType, ev.id);
}
