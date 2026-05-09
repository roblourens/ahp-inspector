import type {
  ActionEnvelope,
  RootAction,
  RootState,
  SessionAction,
  SessionState,
  Snapshot,
  StateAction,
  TerminalAction,
  TerminalState,
} from "@ahp-inspector/protocol";
import { rootReducer, sessionReducer, terminalReducer } from "@ahp-inspector/protocol";
import type { AhpEvent, CorrelationKey } from "@ahp-inspector/shared";
import { correlationKeyForRequest, correlationKeyForResponse } from "@ahp-inspector/shared";

const ROOT_RESOURCE = "agenthost:/root";

export type ReplayResourceKind = "root" | "session" | "terminal" | "unknown";
export type ReplayConfidence = "complete" | "partial" | "unknown";

export type ReplayDiagnosticCode =
  | "invalid-target-index"
  | "missing-baseline"
  | "parse-error"
  | "unknown-snapshot"
  | "unknown-action"
  | "malformed-envelope"
  | "server-seq-gap"
  | "server-seq-duplicate"
  | "server-seq-out-of-order"
  | "ignored-client-intent"
  | "reconnect-missing-resource"
  | "date-now-restore-failed"
  | "scope-creep-blocked";

export interface ReplayDiagnostic {
  readonly code: ReplayDiagnosticCode;
  readonly severity: "info" | "warning" | "error";
  readonly eventIdx: number;
  readonly message: string;
  readonly details?: unknown;
}

export interface ReplayResourceKey {
  readonly kind: ReplayResourceKind;
  readonly uri: string;
}

export interface ReplayResourceState {
  readonly key: ReplayResourceKey;
  readonly state: RootState | SessionState | TerminalState | unknown;
  readonly baselineEventIdx: number;
  readonly lastAppliedEventIdx: number;
  readonly baselineFromSeq: number | null;
  readonly lastServerSeq: number | null;
  readonly confidence: ReplayConfidence;
  readonly diagnostics: readonly ReplayDiagnostic[];
}

export interface ReplayClientIntent {
  readonly eventIdx: number;
  readonly ts: number;
  readonly clientSeq: number | null;
  readonly actionType: string | null;
  readonly resource: ReplayResourceKey | null;
  readonly acceptedByServerSeq?: number;
  readonly ignored: true;
}

export interface ReplayResult {
  readonly targetIndex: number;
  readonly resources: readonly ReplayResourceState[];
  readonly intents: readonly ReplayClientIntent[];
  readonly diagnostics: readonly ReplayDiagnostic[];
}

interface MutableReplayResourceState {
  key: ReplayResourceKey;
  state: RootState | SessionState | TerminalState | unknown;
  baselineEventIdx: number;
  lastAppliedEventIdx: number;
  baselineFromSeq: number | null;
  lastServerSeq: number | null;
  confidence: ReplayConfidence;
  diagnostics: ReplayDiagnostic[];
}

interface RequestContext {
  method: string | null;
  params: unknown;
  eventIdx: number;
}

interface ReplayContext {
  resources: Map<string, MutableReplayResourceState>;
  requests: Map<CorrelationKey, RequestContext>;
  intents: ReplayClientIntent[];
  diagnostics: ReplayDiagnostic[];
}

type KnownReplayResourceKind = "root" | "session" | "terminal";

export function replayToIndex(events: readonly AhpEvent[], targetIndex: number): ReplayResult {
  const ctx: ReplayContext = {
    resources: new Map(),
    requests: new Map(),
    intents: [],
    diagnostics: [],
  };

  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= events.length) {
    addDiagnostic(ctx, {
      code: "invalid-target-index",
      severity: "warning",
      eventIdx: Math.max(0, targetIndex),
      message: `Target index ${targetIndex} is outside 0..${Math.max(0, events.length - 1)}`,
    });
  }

  const end = Math.min(Math.max(targetIndex, -1), events.length - 1);
  for (let eventIdx = 0; eventIdx <= end; eventIdx++) {
    const event = events[eventIdx];
    if (!event) {
      continue;
    }
    processEvent(ctx, event, eventIdx);
  }

  return {
    targetIndex,
    resources: [...ctx.resources.values()].map(freezeResource),
    intents: ctx.intents.map((intent) => ({ ...intent })),
    diagnostics: ctx.diagnostics,
  };
}

function processEvent(ctx: ReplayContext, event: AhpEvent, eventIdx: number): void {
  if (event.parse === "error" || event.kind === "parse-error") {
    addDiagnostic(ctx, {
      code: "parse-error",
      severity: "warning",
      eventIdx,
      message: event.parseError?.reason ?? "Parse error event encountered during replay",
      details: event.parseError,
    });
    return;
  }

  if (event.kind === "request") {
    ctx.requests.set(correlationKeyForRequest(event), {
      method: event.method,
      params: isRecord(event.raw) ? event.raw.params : undefined,
      eventIdx,
    });
    return;
  }

  if (event.kind === "response") {
    processResponse(ctx, event, eventIdx);
    return;
  }

  if (event.dir === "c2s" && event.method === "dispatchAction") {
    recordClientIntent(ctx, event, eventIdx);
    return;
  }

  if (event.kind === "action") {
    const envelope = readActionEnvelope(isRecord(event.raw) ? event.raw.params : undefined);
    if (!envelope) {
      addDiagnostic(ctx, malformedEnvelope(eventIdx, "Server action event has malformed params"));
      return;
    }
    applyEnvelope(ctx, envelope, eventIdx, event.ts);
  }
}

function processResponse(ctx: ReplayContext, event: AhpEvent, eventIdx: number): void {
  const request = ctx.requests.get(correlationKeyForResponse(event));
  if (!request || !isRecord(event.raw) || !("result" in event.raw)) {
    return;
  }

  const result = event.raw.result;
  if (request.method === "initialize") {
    if (!isRecord(result) || !Array.isArray(result.snapshots)) {
      addDiagnostic(
        ctx,
        malformedEnvelope(eventIdx, "Initialize response has malformed snapshots"),
      );
      return;
    }
    installSnapshots(ctx, result.snapshots, eventIdx);
  } else if (request.method === "subscribe") {
    if (!isRecord(result) || !("snapshot" in result)) {
      addDiagnostic(ctx, malformedEnvelope(eventIdx, "Subscribe response has malformed snapshot"));
      return;
    }
    installSnapshot(ctx, result.snapshot, eventIdx);
  } else if (request.method === "reconnect") {
    processReconnectResult(ctx, result, eventIdx, event.ts);
  }
}

function processReconnectResult(
  ctx: ReplayContext,
  result: unknown,
  eventIdx: number,
  eventTs: number,
): void {
  if (!isRecord(result) || typeof result.type !== "string") {
    addDiagnostic(ctx, malformedEnvelope(eventIdx, "Reconnect response has malformed result"));
    return;
  }

  if (result.type === "snapshot") {
    if (!Array.isArray(result.snapshots)) {
      addDiagnostic(
        ctx,
        malformedEnvelope(eventIdx, "Reconnect snapshot response has malformed snapshots"),
      );
      return;
    }
    installSnapshots(ctx, result.snapshots, eventIdx);
    return;
  }

  if (result.type !== "replay") {
    addDiagnostic(ctx, malformedEnvelope(eventIdx, "Reconnect response has unknown result type"));
    return;
  }

  if (Array.isArray(result.missing)) {
    for (const missing of result.missing) {
      addDiagnostic(ctx, {
        code: "reconnect-missing-resource",
        severity: "warning",
        eventIdx,
        message: `Reconnect could not resume resource ${String(missing)}`,
        details: missing,
      });
    }
  }

  if (!Array.isArray(result.actions)) {
    addDiagnostic(
      ctx,
      malformedEnvelope(eventIdx, "Reconnect replay response has malformed actions"),
    );
    return;
  }

  for (const entry of result.actions) {
    const envelope = readActionEnvelope(entry);
    if (!envelope) {
      addDiagnostic(
        ctx,
        malformedEnvelope(eventIdx, "Reconnect replay contains malformed action envelope"),
      );
      continue;
    }
    applyEnvelope(ctx, envelope, eventIdx, eventTs);
  }
}

function installSnapshots(
  ctx: ReplayContext,
  snapshots: readonly unknown[],
  eventIdx: number,
): void {
  for (const snapshot of snapshots) {
    installSnapshot(ctx, snapshot, eventIdx);
  }
}

function installSnapshot(ctx: ReplayContext, value: unknown, eventIdx: number): void {
  const snapshot = readSnapshot(value);
  if (!snapshot) {
    addDiagnostic(ctx, malformedEnvelope(eventIdx, "Malformed snapshot"));
    return;
  }

  const kind = inferSnapshotKind(snapshot);
  if (kind === "unknown") {
    addDiagnostic(ctx, {
      code: "unknown-snapshot",
      severity: "warning",
      eventIdx,
      message: `Snapshot resource ${snapshot.resource} has unknown state shape`,
      details: { resource: snapshot.resource },
    });
    return;
  }

  const key: ReplayResourceKey = { kind, uri: snapshot.resource };
  ctx.resources.set(resourceMapKey(key), {
    key,
    state: snapshot.state,
    baselineEventIdx: eventIdx,
    lastAppliedEventIdx: eventIdx,
    baselineFromSeq: snapshot.fromSeq,
    lastServerSeq: snapshot.fromSeq,
    confidence: "complete",
    diagnostics: [],
  });
}

function applyEnvelope(
  ctx: ReplayContext,
  envelope: ActionEnvelope,
  eventIdx: number,
  eventTs: number,
): void {
  const target = inferActionTarget(envelope.action);
  if (!target) {
    addDiagnostic(ctx, {
      code: "unknown-action",
      severity: "warning",
      eventIdx,
      message: `Unknown action target for ${actionTypeOf(envelope.action) ?? "unknown action"}`,
      details: envelope.action,
    });
    return;
  }

  const resource = ctx.resources.get(resourceMapKey(target));
  if (!resource) {
    addDiagnostic(ctx, {
      code: "missing-baseline",
      severity: "warning",
      eventIdx,
      message: `No ${target.kind} baseline for ${target.uri}`,
      details: { target, actionType: actionTypeOf(envelope.action) },
    });
    return;
  }

  if (envelope.rejectionReason) {
    const diagnostic = malformedEnvelope(eventIdx, "Rejected action envelope is non-mutating", {
      rejectionReason: envelope.rejectionReason,
      actionType: actionTypeOf(envelope.action),
    });
    addResourceDiagnostic(ctx, resource, diagnostic);
    return;
  }

  if (!shouldApplyServerSeq(ctx, resource, envelope.serverSeq, eventIdx)) {
    return;
  }

  const reducerDiagnostics: ReplayDiagnostic[] = [];
  const log = (message: string) => {
    reducerDiagnostics.push({
      code: "unknown-action",
      severity: "warning",
      eventIdx,
      message,
      details: { actionType: actionTypeOf(envelope.action) },
    });
  };

  resource.state = withEventTime(eventTs, () => {
    if (target.kind === "root") {
      return rootReducer(resource.state as RootState, envelope.action as RootAction, log);
    }
    if (target.kind === "session") {
      return sessionReducer(resource.state as SessionState, envelope.action as SessionAction, log);
    }
    return terminalReducer(resource.state as TerminalState, envelope.action as TerminalAction, log);
  });
  resource.lastAppliedEventIdx = eventIdx;
  resource.lastServerSeq = envelope.serverSeq;

  linkAcceptedIntent(ctx, envelope);
  for (const diagnostic of reducerDiagnostics) {
    addResourceDiagnostic(ctx, resource, diagnostic);
  }
}

function shouldApplyServerSeq(
  ctx: ReplayContext,
  resource: MutableReplayResourceState,
  serverSeq: number,
  eventIdx: number,
): boolean {
  const last = resource.lastServerSeq;
  if (last === null) {
    return true;
  }

  if (serverSeq === last + 1) {
    return true;
  }

  if (serverSeq > last + 1) {
    addResourceDiagnostic(ctx, resource, {
      code: "server-seq-gap",
      severity: "warning",
      eventIdx,
      message: `Server sequence gap for ${resource.key.uri}: expected ${last + 1}, saw ${serverSeq}`,
      details: { expected: last + 1, actual: serverSeq },
    });
    return true;
  }

  addResourceDiagnostic(ctx, resource, {
    code: serverSeq === last ? "server-seq-duplicate" : "server-seq-out-of-order",
    severity: "warning",
    eventIdx,
    message:
      serverSeq === last
        ? `Duplicate server sequence ${serverSeq} for ${resource.key.uri}`
        : `Out-of-order server sequence ${serverSeq} after ${last} for ${resource.key.uri}`,
    details: { last, actual: serverSeq },
  });
  return false;
}

function recordClientIntent(ctx: ReplayContext, event: AhpEvent, eventIdx: number): void {
  const params = isRecord(event.raw) ? event.raw.params : undefined;
  const action =
    isRecord(params) && isRecord(params.action) ? (params.action as unknown as StateAction) : null;
  const clientSeq =
    isRecord(params) && typeof params.clientSeq === "number" ? params.clientSeq : null;
  const actionType = actionTypeOf(action);
  const resource = action ? inferActionTarget(action) : null;

  const intent: ReplayClientIntent = {
    eventIdx,
    ts: event.ts,
    clientSeq,
    actionType,
    resource,
    ignored: true,
  };
  ctx.intents.push(intent);
  addDiagnostic(ctx, {
    code: "ignored-client-intent",
    severity: "info",
    eventIdx,
    message: "Client dispatchAction intent is visible but non-mutating",
    details: { clientSeq, actionType, resource },
  });
}

function linkAcceptedIntent(ctx: ReplayContext, envelope: ActionEnvelope): void {
  const clientSeq = envelope.origin?.clientSeq;
  if (typeof clientSeq !== "number") {
    return;
  }
  const idx = ctx.intents.findIndex(
    (intent) => intent.clientSeq === clientSeq && intent.acceptedByServerSeq === undefined,
  );
  if (idx < 0) {
    return;
  }
  const intent = ctx.intents[idx];
  if (!intent) {
    return;
  }
  ctx.intents[idx] = { ...intent, acceptedByServerSeq: envelope.serverSeq };
}

function withEventTime<T>(eventTs: number, fn: () => T): T {
  const original = Date.now;
  Date.now = () => eventTs;
  try {
    return fn();
  } finally {
    Date.now = original;
  }
}

function readSnapshot(value: unknown): Snapshot | null {
  if (!isRecord(value) || typeof value.resource !== "string" || typeof value.fromSeq !== "number") {
    return null;
  }
  if (!isRecord(value.state)) {
    return null;
  }
  return {
    resource: value.resource,
    state: value.state as unknown as Snapshot["state"],
    fromSeq: value.fromSeq,
  };
}

function readActionEnvelope(value: unknown): ActionEnvelope | null {
  if (!isRecord(value) || typeof value.serverSeq !== "number" || !isRecord(value.action)) {
    return null;
  }
  if (typeof value.action.type !== "string") {
    return null;
  }
  const origin =
    isRecord(value.origin) &&
    typeof value.origin.clientId === "string" &&
    typeof value.origin.clientSeq === "number"
      ? { clientId: value.origin.clientId, clientSeq: value.origin.clientSeq }
      : undefined;
  return {
    action: value.action as unknown as StateAction,
    serverSeq: value.serverSeq,
    origin,
    ...(typeof value.rejectionReason === "string"
      ? { rejectionReason: value.rejectionReason }
      : {}),
  };
}

function inferSnapshotKind(snapshot: Snapshot): KnownReplayResourceKind | "unknown" {
  if (snapshot.resource === ROOT_RESOURCE) {
    return "root";
  }
  if (isRootState(snapshot.state)) {
    return "root";
  }
  if (isSessionState(snapshot.state)) {
    return "session";
  }
  if (isTerminalState(snapshot.state)) {
    return "terminal";
  }
  return "unknown";
}

function inferActionTarget(action: StateAction): ReplayResourceKey | null {
  const type = actionTypeOf(action);
  if (!type) {
    return null;
  }
  if (type.startsWith("root/")) {
    return { kind: "root", uri: ROOT_RESOURCE };
  }
  if (type.startsWith("session/")) {
    const session = isRecord(action) && typeof action.session === "string" ? action.session : null;
    return session ? { kind: "session", uri: session } : null;
  }
  if (type.startsWith("terminal/")) {
    const terminal =
      isRecord(action) && typeof action.terminal === "string" ? action.terminal : null;
    return terminal ? { kind: "terminal", uri: terminal } : null;
  }
  return null;
}

function actionTypeOf(action: unknown): string | null {
  return isRecord(action) && typeof action.type === "string" ? action.type : null;
}

function isRootState(value: unknown): value is RootState {
  return isRecord(value) && Array.isArray(value.agents);
}

function isSessionState(value: unknown): value is SessionState {
  return (
    isRecord(value) &&
    isRecord(value.summary) &&
    typeof value.lifecycle === "string" &&
    Array.isArray(value.turns)
  );
}

function isTerminalState(value: unknown): value is TerminalState {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    Array.isArray(value.content) &&
    isRecord(value.claim)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resourceMapKey(key: ReplayResourceKey): string {
  return `${key.kind}:${key.uri}`;
}

function freezeResource(resource: MutableReplayResourceState): ReplayResourceState {
  return {
    key: { ...resource.key },
    state: resource.state,
    baselineEventIdx: resource.baselineEventIdx,
    lastAppliedEventIdx: resource.lastAppliedEventIdx,
    baselineFromSeq: resource.baselineFromSeq,
    lastServerSeq: resource.lastServerSeq,
    confidence: resource.confidence,
    diagnostics: resource.diagnostics,
  };
}

function malformedEnvelope(eventIdx: number, message: string, details?: unknown): ReplayDiagnostic {
  return {
    code: "malformed-envelope",
    severity: "warning",
    eventIdx,
    message,
    ...(details !== undefined ? { details } : {}),
  };
}

function addResourceDiagnostic(
  ctx: ReplayContext,
  resource: MutableReplayResourceState,
  diagnostic: ReplayDiagnostic,
): void {
  resource.diagnostics.push(diagnostic);
  if (diagnostic.severity !== "info") {
    resource.confidence = "partial";
  }
  addDiagnostic(ctx, diagnostic);
}

function addDiagnostic(ctx: ReplayContext, diagnostic: ReplayDiagnostic): void {
  ctx.diagnostics.push(diagnostic);
}
