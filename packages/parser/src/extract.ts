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

function objectChild(
  parent: Record<string, unknown>,
  key: "action" | "notification",
): Record<string, unknown> | null {
  const child = parent[key];
  return typeof child === "object" && child !== null ? (child as Record<string, unknown>) : null;
}

function candidateObjects(p: Record<string, unknown>): Record<string, unknown>[] {
  // `dispatchAction` batches actions in an array payload; each element is an
  // action object that carries its own channel (e.g. `{ session, type }`).
  if (Array.isArray(p)) {
    const items: Record<string, unknown>[] = [];
    for (const item of p) {
      if (typeof item === "object" && item !== null) items.push(item as Record<string, unknown>);
    }
    return items;
  }
  const out = [p];
  const action = objectChild(p, "action");
  if (action) out.push(action);
  const notification = objectChild(p, "notification");
  if (notification) out.push(notification);
  return out;
}

function sessionFromObject(p: Record<string, unknown>): string | null {
  const session = p.session;
  if (typeof session === "string") return session;
  if (typeof session === "object" && session !== null) {
    const uri = (session as Record<string, unknown>).uri;
    if (typeof uri === "string") return uri;
  }
  const sessionId = asString(p.sessionId);
  if (sessionId) return sessionId;
  // Terminal actions (`terminal/*`) are scoped to a terminal resource rather
  // than a session; surface it as the channel.
  const terminal = asString(p.terminal);
  if (terminal) return terminal;
  // Some notifications carry the channel as a generic `resource`.
  const resource = asString(p.resource);
  if (resource) return resource;
  // Resource descriptors (e.g. `subscribe`/`unsubscribe` targets) look like
  // `{ $mid, scheme, path, external? }`. Prefer the fully-qualified `external`
  // URI, falling back to `scheme:path`.
  const external = asString(p.external);
  if (external) return external;
  const scheme = asString(p.scheme);
  const path = asString(p.path);
  if (scheme && path) return `${scheme}:${path}`;
  // `notify/sessionAdded` nests the session resource under `summary.resource`.
  const summary = p.summary;
  if (typeof summary === "object" && summary !== null) {
    const summaryResource = asString((summary as Record<string, unknown>).resource);
    if (summaryResource) return summaryResource;
  }
  return null;
}

function turnFromObject(p: Record<string, unknown>): string | null {
  const fromTop = asString(p.turnId);
  if (fromTop) return fromTop;
  const turn = p.turn;
  if (typeof turn === "object" && turn !== null) {
    const id = (turn as Record<string, unknown>).id;
    if (typeof id === "string") return id;
  }
  return null;
}

export function extractSessionId(_method: string | null, params: unknown): string | null {
  const p = paramsObject(params);
  if (!p) return null;
  for (const candidate of candidateObjects(p)) {
    const session = sessionFromObject(candidate);
    if (session) return session;
  }
  return null;
}

export function extractTurnId(_method: string | null, params: unknown): string | null {
  const p = paramsObject(params);
  if (!p) return null;
  for (const candidate of candidateObjects(p)) {
    const turn = turnFromObject(candidate);
    if (turn) return turn;
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
    const actionRec = action as Record<string, unknown>;
    const id = actionRec.toolCallId;
    if (typeof id === "string") return id;
    const nested = actionRec.toolCall;
    if (typeof nested === "object" && nested !== null) {
      const nestedId = (nested as Record<string, unknown>).id;
      if (typeof nestedId === "string") return nestedId;
    }
  }
  return null;
}
