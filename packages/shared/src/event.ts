// Canonical event envelope. LOCKED — every Phase 2+ consumer imports this.
// EVENT-01 / EVENT-02. Source: 01-RESEARCH.md Pattern 1.
//
// Wire direction: c2s = client (e.g. VS Code) → server (agent host).
//                 s2c = server → client.
export type Direction = "c2s" | "s2c";

// EventKind discriminant. Per locked normalizer policy:
//  - `action`                  collapses the s2c `method:"action"` envelope.
//  - `protocol-notification`   collapses the s2c `method:"notification"` envelope.
//  - `log`                     reserved for transport-level log lines (Plan 03+).
//  - `parse-error`             tolerant fallback emitted instead of throwing.
export type EventKind =
  | "request"
  | "response"
  | "client-notification"
  | "server-notification"
  | "action"
  | "protocol-notification"
  | "log"
  | "parse-error";

export type ParseStatus = "ok" | "error";

// JSON-RPC 2.0 §4 permits id ∈ string | number | null. AHP `IJsonRpcRequest.id`
// narrows to `number`, but real logs may carry any of the three (Pitfall 1) so
// the parser MUST accept all and tag the original type.
export type IdType = "number" | "string" | "null";

/**
 * AhpEvent — the single canonical envelope produced by the parser.
 *
 * One AhpEvent per JSONL line. Fields are `readonly` so downstream code cannot
 * mutate the model in place; reducers / projections must produce new objects.
 */
export interface AhpEvent {
  /** Monotonic per-stream sequence number assigned by the caller. */
  readonly seq: number;
  /** Epoch milliseconds. Falls back to `Date.now()` if no timestamp on the wire. */
  readonly ts: number;
  /** Original timestamp string as written, preserved for fidelity. */
  readonly tsRaw: string;
  /** Wire direction at the time the event was emitted. */
  readonly dir: Direction;
  /** Discriminant. */
  readonly kind: EventKind;
  /** JSON-RPC method (or null for responses / parse-errors). */
  readonly method: string | null;
  /** For action / protocol-notification: the inner action or notification `type`. */
  readonly actionType: string | null;
  /** JSON-RPC id, preserving wire type (1 ≠ "1"). */
  readonly id: number | string | null;
  /** Tag of the original id type — needed by the correlator (Pitfall 2). */
  readonly idType: IdType;
  /** Best-effort session URI/id extracted from params. */
  readonly sessionId: string | null;
  /** Best-effort turn id. */
  readonly turnId: string | null;
  /** Best-effort tool-call id. */
  readonly toolCallId: string | null;
  /** Server-assigned ordering for action envelopes; null otherwise. */
  readonly serverSeq: number | null;
  /** Byte offset of the source line within the source stream. */
  readonly byteOffset: number;
  /** Byte length of the source line (without trailing newline). */
  readonly byteLength: number;
  /** Parsed JSON payload, or undefined for parse-errors. */
  readonly raw: unknown;
  /** Parse status — `'ok'` for normal events, `'error'` for tolerant fallbacks. */
  readonly parse: ParseStatus;
  /** Set iff parse === 'error'. */
  readonly parseError?: { reason: string; rawText: string };
}

/**
 * Metadata supplied by the caller (LineSplitter / legacy adapter) when invoking
 * the normalizer. The normalizer never invents these — they come from the
 * source byte stream.
 */
export interface NormalizeMeta {
  readonly seq: number;
  readonly dir: Direction;
  readonly ts: number;
  readonly tsRaw: string;
  readonly byteOffset: number;
  readonly byteLength: number;
}
