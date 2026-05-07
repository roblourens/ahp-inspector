// Best-effort extractors for session / turn / tool-call ids from JSON-RPC
// `params`. Defensive against non-object payloads.
//
// TODO(Phase 2 / Pitfall 3): replace these heuristics with a per-method
// table keyed off `ICommandMap` so coverage of every AHP command is
// explicit and missing methods are caught at typecheck. For Phase 1 we lock
// in the most common shapes documented in 01-RESEARCH.md Pitfall 3.

function paramsObject(params: unknown): Record<string, unknown> | null {
  return typeof params === "object" && params !== null ? (params as Record<string, unknown>) : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function extractSessionId(_method: string | null, params: unknown): string | null {
  const p = paramsObject(params);
  if (!p) return null;
  const session = p.session;
  if (typeof session === "string") return session;
  if (typeof session === "object" && session !== null) {
    const uri = (session as Record<string, unknown>).uri;
    if (typeof uri === "string") return uri;
  }
  return asString(p.sessionId);
}

export function extractTurnId(_method: string | null, params: unknown): string | null {
  const p = paramsObject(params);
  if (!p) return null;
  const fromTop = asString(p.turnId);
  if (fromTop) return fromTop;
  const turn = p.turn;
  if (typeof turn === "object" && turn !== null) {
    const id = (turn as Record<string, unknown>).id;
    if (typeof id === "string") return id;
  }
  return null;
}

export function extractToolCallId(_method: string | null, params: unknown): string | null {
  const p = paramsObject(params);
  if (!p) return null;
  const direct = asString(p.toolCallId);
  if (direct) return direct;
  const toolCall = p.toolCall;
  if (typeof toolCall === "object" && toolCall !== null) {
    const id = (toolCall as Record<string, unknown>).id;
    if (typeof id === "string") return id;
  }
  const action = p.action;
  if (typeof action === "object" && action !== null) {
    const id = (action as Record<string, unknown>).toolCallId;
    if (typeof id === "string") return id;
  }
  return null;
}
