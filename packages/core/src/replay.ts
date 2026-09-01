import type {
  ActionOrigin,
  AnnotationsAction,
  AnnotationsState,
  AutomationAction,
  AutomationCatalogState,
  AutomationRunAction,
  AutomationRunState,
  ChangesetAction,
  ChangesetState,
  ChatAction,
  ChatState,
  ResourceWatchAction,
  ResourceWatchState,
  RootAction,
  RootState,
  SessionAction,
  SessionState,
  StateAction,
  TerminalAction,
  TerminalState,
} from "@ahp-inspector/protocol";
import {
  ACTION_INTRODUCED_IN,
  annotationsReducer,
  automationReducer,
  automationRunReducer,
  changesetReducer,
  chatReducer,
  resourceWatchReducer,
  rootReducer,
  sessionReducer,
  terminalReducer,
} from "@ahp-inspector/protocol";
import type { AhpEvent, CorrelationKey } from "@ahp-inspector/shared";
import { correlationKeyForRequest, correlationKeyForResponse } from "@ahp-inspector/shared";

const ROOT_RESOURCE = "agenthost:/root";

export type ReplayResourceKind =
  | "root"
  | "session"
  | "chat"
  | "terminal"
  | "changeset"
  | "annotations"
  | "resource-watch"
  | "automation"
  | "automation-run"
  | "unknown";
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

interface DecodedSnapshot {
  readonly resource: string;
  readonly state: Record<string, unknown>;
  readonly fromSeq: number;
}

interface DecodedActionEnvelope {
  readonly channel: string;
  readonly action: Record<string, unknown>;
  readonly serverSeq: number;
  readonly origin: ActionOrigin | undefined;
  readonly rejectionReason?: string;
}

interface LegacySessionSummary extends Record<string, unknown> {
  readonly title: string;
  readonly status: number;
  readonly modifiedAt: string | number;
}

interface LegacySessionState extends Record<string, unknown> {
  readonly summary: LegacySessionSummary;
  readonly lifecycle: string;
  readonly turns: readonly unknown[];
}

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
  const key: ReplayResourceKey = { kind, uri: snapshot.resource };
  if (kind === "unknown") {
    const diagnostic: ReplayDiagnostic = {
      code: "unknown-snapshot",
      severity: "warning",
      eventIdx,
      message: `Snapshot resource ${snapshot.resource} has unknown state shape`,
      details: { resource: snapshot.resource },
    };
    addDiagnostic(ctx, diagnostic);
    ctx.resources.set(resourceMapKey(key), {
      key,
      state: snapshot.state,
      baselineEventIdx: eventIdx,
      lastAppliedEventIdx: eventIdx,
      baselineFromSeq: snapshot.fromSeq,
      lastServerSeq: snapshot.fromSeq,
      confidence: "unknown",
      diagnostics: [diagnostic],
    });
    return;
  }

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
  envelope: DecodedActionEnvelope,
  eventIdx: number,
  eventTs: number,
): void {
  const action = readKnownAction(envelope.action);
  const inferredTarget = action
    ? inferKnownActionTarget(action, envelope.channel)
    : { kind: "unknown" as const, uri: envelope.channel };
  const resource =
    ctx.resources.get(resourceMapKey(inferredTarget)) ??
    [...ctx.resources.values()].find((candidate) => candidate.key.uri === envelope.channel);
  if (!resource) {
    addDiagnostic(ctx, {
      code: "missing-baseline",
      severity: "warning",
      eventIdx,
      message: `No ${inferredTarget.kind} baseline for ${inferredTarget.uri}`,
      details: { target: inferredTarget, actionType: actionTypeOf(envelope.action) },
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

  linkAcceptedIntent(ctx, envelope);

  if (!action || inferredTarget.kind === "unknown") {
    addResourceDiagnostic(ctx, resource, {
      code: "unknown-action",
      severity: "warning",
      eventIdx,
      message: `Cannot apply unsupported action ${actionTypeOf(envelope.action) ?? "(missing type)"}`,
      details: envelope.action,
    });
    resource.lastServerSeq = envelope.serverSeq;
    resource.confidence = "unknown";
    return;
  }

  if (resource.key.kind !== inferredTarget.kind) {
    addResourceDiagnostic(ctx, resource, {
      code: "scope-creep-blocked",
      severity: "warning",
      eventIdx,
      message: `Refusing to apply ${action.type} to ${resource.key.kind} state`,
      details: { expected: inferredTarget.kind, actual: resource.key.kind },
    });
    resource.lastServerSeq = envelope.serverSeq;
    resource.confidence = "unknown";
    return;
  }

  const reducerDiagnostics: ReplayDiagnostic[] = [];
  const log = (message: string) => {
    reducerDiagnostics.push({
      code: "unknown-action",
      severity: "warning",
      eventIdx,
      message,
      details: { actionType: action.type },
    });
  };

  resource.state = (() => {
    if (resource.key.kind === "root") {
      return rootReducer(resource.state as RootState, action as RootAction, log);
    }
    if (resource.key.kind === "session") {
      if (isLegacySessionState(resource.state)) {
        const legacyState = applyLegacySessionAction(resource.state, envelope.action, eventTs);
        if (legacyState) {
          return legacyState;
        }
        log(`Unsupported historical session action: ${action.type}`);
        return resource.state;
      }
      return sessionReducer(resource.state as SessionState, action as SessionAction, log);
    }
    if (resource.key.kind === "chat") {
      return chatReducer(resource.state as ChatState, action as ChatAction, log);
    }
    if (resource.key.kind === "terminal") {
      return terminalReducer(resource.state as TerminalState, action as TerminalAction, log);
    }
    if (resource.key.kind === "changeset") {
      return changesetReducer(resource.state as ChangesetState, action as ChangesetAction, log);
    }
    if (resource.key.kind === "annotations") {
      return annotationsReducer(
        resource.state as AnnotationsState,
        action as AnnotationsAction,
        log,
      );
    }
    if (resource.key.kind === "resource-watch") {
      return resourceWatchReducer(
        resource.state as ResourceWatchState,
        action as ResourceWatchAction,
        log,
      );
    }
    if (resource.key.kind === "automation") {
      return automationReducer(
        resource.state as AutomationCatalogState,
        action as AutomationAction,
        log,
      );
    }
    if (resource.key.kind === "automation-run") {
      return automationRunReducer(
        resource.state as AutomationRunState,
        action as AutomationRunAction,
        log,
      );
    }
    return resource.state;
  })();
  resource.lastAppliedEventIdx = eventIdx;
  resource.lastServerSeq = envelope.serverSeq;

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
  const action = isRecord(params) && isRecord(params.action) ? params.action : null;
  const clientSeq =
    isRecord(params) && typeof params.clientSeq === "number" ? params.clientSeq : null;
  const actionType = actionTypeOf(action);
  const channel =
    isRecord(params) && typeof params.channel === "string" ? params.channel : undefined;
  const knownAction = action ? readKnownAction(action) : null;
  const resource =
    action && channel
      ? knownAction
        ? inferKnownActionTarget(knownAction, channel)
        : { kind: "unknown" as const, uri: channel }
      : null;

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

function linkAcceptedIntent(ctx: ReplayContext, envelope: DecodedActionEnvelope): void {
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

function readSnapshot(value: unknown): DecodedSnapshot | null {
  if (!isRecord(value) || typeof value.resource !== "string" || typeof value.fromSeq !== "number") {
    return null;
  }
  if (!isRecord(value.state)) {
    return null;
  }
  return {
    resource: value.resource,
    state: value.state,
    fromSeq: value.fromSeq,
  };
}

function readActionEnvelope(value: unknown): DecodedActionEnvelope | null {
  if (
    !isRecord(value) ||
    typeof value.channel !== "string" ||
    typeof value.serverSeq !== "number" ||
    !isRecord(value.action)
  ) {
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
    channel: value.channel,
    action: value.action,
    serverSeq: value.serverSeq,
    origin,
    ...(typeof value.rejectionReason === "string"
      ? { rejectionReason: value.rejectionReason }
      : {}),
  };
}

function inferSnapshotKind(snapshot: DecodedSnapshot): ReplayResourceKind {
  if (snapshot.resource === ROOT_RESOURCE) {
    return "root";
  }
  if (isRootState(snapshot.state)) {
    return "root";
  }
  if (isSessionState(snapshot.state) || isLegacySessionState(snapshot.state)) {
    return "session";
  }
  if (isChatState(snapshot.state)) {
    return "chat";
  }
  if (isTerminalState(snapshot.state)) {
    return "terminal";
  }
  if (isChangesetState(snapshot.state)) {
    return "changeset";
  }
  if (isAnnotationsState(snapshot.state)) {
    return "annotations";
  }
  if (isResourceWatchState(snapshot.state)) {
    return "resource-watch";
  }
  if (isAutomationCatalogState(snapshot.state)) {
    return "automation";
  }
  if (isAutomationRunState(snapshot.state)) {
    return "automation-run";
  }
  return "unknown";
}

function inferKnownActionTarget(action: StateAction, channel: string): ReplayResourceKey {
  const type = action.type;
  if (type.startsWith("root/")) {
    return { kind: "root", uri: channel };
  }
  if (type.startsWith("session/")) {
    return { kind: "session", uri: channel };
  }
  if (type.startsWith("chat/")) {
    return { kind: "chat", uri: channel };
  }
  if (type.startsWith("terminal/")) {
    return { kind: "terminal", uri: channel };
  }
  if (type.startsWith("changeset/")) {
    return { kind: "changeset", uri: channel };
  }
  if (type.startsWith("annotations/")) {
    return { kind: "annotations", uri: channel };
  }
  if (type.startsWith("resourceWatch/")) {
    return { kind: "resource-watch", uri: channel };
  }
  if (type.startsWith("automationRun/")) {
    return { kind: "automation-run", uri: channel };
  }
  if (type.startsWith("automation/")) {
    return { kind: "automation", uri: channel };
  }
  return { kind: "unknown", uri: channel };
}

function actionTypeOf(action: unknown): string | null {
  return isRecord(action) && typeof action.type === "string" ? action.type : null;
}

function readKnownAction(action: Record<string, unknown>): StateAction | null {
  const type = actionTypeOf(action);
  if (!type || !Object.hasOwn(ACTION_INTRODUCED_IN, type)) {
    return null;
  }
  return action as unknown as StateAction;
}

function isRootState(value: unknown): value is RootState {
  return isRecord(value) && Array.isArray(value.agents);
}

function isSessionState(value: unknown): value is SessionState {
  return (
    isRecord(value) &&
    typeof value.lifecycle === "string" &&
    Array.isArray(value.activeClients) &&
    Array.isArray(value.chats)
  );
}

function isLegacySessionState(value: unknown): value is LegacySessionState {
  if (!isRecord(value) || !isRecord(value.summary)) {
    return false;
  }
  return (
    typeof value.summary.title === "string" &&
    typeof value.summary.status === "number" &&
    (typeof value.summary.modifiedAt === "string" ||
      typeof value.summary.modifiedAt === "number") &&
    typeof value.lifecycle === "string" &&
    Array.isArray(value.turns)
  );
}

function applyLegacySessionAction(
  state: LegacySessionState,
  action: Record<string, unknown>,
  eventTs: number,
): LegacySessionState | null {
  switch (action.type) {
    case "session/ready":
      return {
        ...state,
        lifecycle: "ready",
        summary: { ...state.summary, status: 1 },
      };
    case "session/creationFailed":
      return {
        ...state,
        lifecycle: "creationFailed",
        creationError: action.error,
      };
    case "session/titleChanged":
      return typeof action.title === "string"
        ? {
            ...state,
            summary: { ...state.summary, title: action.title, modifiedAt: eventTs },
          }
        : null;
    case "session/isReadChanged":
      return typeof action.isRead === "boolean"
        ? {
            ...state,
            summary: {
              ...state.summary,
              status: withLegacyStatusFlag(state.summary.status, 1 << 5, action.isRead),
            },
          }
        : null;
    case "session/isArchivedChanged":
      return typeof action.isArchived === "boolean"
        ? {
            ...state,
            summary: {
              ...state.summary,
              status: withLegacyStatusFlag(state.summary.status, 1 << 6, action.isArchived),
            },
          }
        : null;
    case "session/activityChanged":
      return action.activity === undefined || typeof action.activity === "string"
        ? {
            ...state,
            summary: { ...state.summary, activity: action.activity },
          }
        : null;
    case "session/serverToolsChanged":
      return Array.isArray(action.tools) ? { ...state, serverTools: action.tools } : null;
    case "session/customizationsChanged":
      return Array.isArray(action.customizations)
        ? { ...state, customizations: action.customizations }
        : null;
    case "session/changesetsChanged":
      return action.changesets === undefined || Array.isArray(action.changesets)
        ? {
            ...state,
            summary: { ...state.summary, changesets: action.changesets },
          }
        : null;
    case "session/metaChanged":
      return action._meta === undefined || isRecord(action._meta)
        ? { ...state, _meta: action._meta }
        : null;
    default:
      return null;
  }
}

function withLegacyStatusFlag(status: number, flag: number, set: boolean): number {
  return set ? status | flag : status & ~flag;
}

function isChatState(value: unknown): value is ChatState {
  return (
    isRecord(value) &&
    typeof value.resource === "string" &&
    typeof value.title === "string" &&
    typeof value.status === "number" &&
    typeof value.modifiedAt === "string" &&
    Array.isArray(value.turns)
  );
}

function isTerminalState(value: unknown): value is TerminalState {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    Array.isArray(value.content) &&
    isRecord(value.claim) &&
    isRecord(value.lifecycle)
  );
}

function isChangesetState(value: unknown): value is ChangesetState {
  return isRecord(value) && typeof value.status === "string" && Array.isArray(value.files);
}

function isAnnotationsState(value: unknown): value is AnnotationsState {
  return isRecord(value) && Array.isArray(value.annotations);
}

function isResourceWatchState(value: unknown): value is ResourceWatchState {
  return isRecord(value) && typeof value.root === "string" && typeof value.recursive === "boolean";
}

function isAutomationCatalogState(value: unknown): value is AutomationCatalogState {
  return isRecord(value) && Array.isArray(value.automations);
}

function isAutomationRunState(value: unknown): value is AutomationRunState {
  return (
    isRecord(value) &&
    typeof value.resource === "string" &&
    typeof value.automation === "string" &&
    isRecord(value.origin) &&
    isRecord(value.lifecycle) &&
    Array.isArray(value.sessions)
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
