import type { AhpEvent, Direction, IdType } from "./event.js";

/**
 * Opaque correlation key shape: `${session}::${requestDir}::${idType}::${id}`.
 *
 * Request/response helpers deliberately use a null session because JSON-RPC
 * responses cannot reproduce a session id extracted from request params.
 *
 * Notifications and actions are NEVER correlated by this key — JSON-RPC
 * notifications carry no `id`. Use this only for request/response pairing.
 */
export type CorrelationKey = string;

const NULL_SESSION = "\u2205"; // ∅

/**
 * Build the canonical correlation key. Both sides of a request/response pair
 * share the same key only when their supplied session, the **request** wire
 * direction, the original id type, and the stringified id all match.
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
 * Session is intentionally excluded because JSON-RPC responses do not carry
 * request params and therefore cannot reproduce a session extracted from them.
 *
 * Notifications and actions MUST NOT be passed here; they have no id.
 */
export function correlationKeyForRequest(ev: AhpEvent): CorrelationKey {
  return makeCorrelationKey(null, ev.dir, ev.idType, ev.id);
}

/**
 * Correlation key for a response event — INVERTS the wire direction so it
 * matches the originating request's key (Pitfall 2). Session is intentionally
 * excluded for the same reason as {@link correlationKeyForRequest}.
 *
 * Notifications and actions MUST NOT be passed here; they have no id.
 */
export function correlationKeyForResponse(ev: AhpEvent): CorrelationKey {
  const requestDir: Direction = ev.dir === "c2s" ? "s2c" : "c2s";
  return makeCorrelationKey(null, requestDir, ev.idType, ev.id);
}
