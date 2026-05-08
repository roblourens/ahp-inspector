import type {
  ReplayClientIntent,
  ReplayConfidence,
  ReplayDiagnostic,
  ReplayResourceKind,
  ReplayResourceState,
} from "@ahp-viewer/core";
import type { Hono } from "hono";
import type { LogSessionManager } from "./session-manager.js";
import type { StateReplayCacheInfo } from "./state-replay-index.js";

export type StateResourceKind = "root" | "session" | "terminal" | "unknown";

export type StateAtErrorResponse =
  | { code: "no-active-log"; message: string }
  | { code: "bad-request"; message: string }
  | { code: "not-found"; message: string; totalEvents?: number }
  | { code: "log-mismatch"; message: string };

export interface StateAtResourceMetadata {
  readonly kind: StateResourceKind;
  readonly uri: string;
  readonly confidence: ReplayConfidence;
  readonly baselineEventIdx: number;
  readonly lastAppliedEventIdx: number;
  readonly baselineFromSeq: number | null;
  readonly lastServerSeq: number | null;
  readonly diagnosticCount: number;
}

export interface StateAtSelectedResource extends StateAtResourceMetadata {
  readonly diagnostics: readonly ReplayDiagnostic[];
  readonly state: unknown;
}

export type StateAtSuccessResponse = {
  readonly logKey: string;
  readonly targetIndex: number;
  readonly totalEvents: number;
  readonly confidence: ReplayConfidence;
  readonly diagnostics: readonly ReplayDiagnostic[];
  readonly resources: readonly StateAtResourceMetadata[];
  readonly selectedResource: StateAtSelectedResource | null;
  readonly intents: readonly ReplayClientIntent[];
  readonly cache: StateReplayCacheInfo;
};

export type StateAtResponse = StateAtSuccessResponse | StateAtErrorResponse;

const IDX_RE = /^(0|[1-9]\d*)$/;
const SELECTABLE_RESOURCE_KINDS = new Set<ReplayResourceKind>(["root", "session", "terminal"]);

export function registerStateRoutes(app: Hono, sessions: LogSessionManager): void {
  app.get("/api/state-at", (c) => {
    const a = sessions.current();
    if (!a) {
      return c.json({ code: "no-active-log", message: "no active log" }, 409);
    }

    const rawIdx = c.req.query("idx");
    if (rawIdx === undefined) {
      return c.json({ code: "bad-request", message: "missing idx" }, 400);
    }
    if (!IDX_RE.test(rawIdx)) {
      return c.json({ code: "bad-request", message: "invalid idx" }, 400);
    }

    const logKey = c.req.query("logKey");
    if (logKey !== undefined && logKey !== a.logKey) {
      return c.json({ code: "log-mismatch", message: "active log changed" }, 409);
    }

    const resourceKind = c.req.query("resourceKind");
    const resourceUri = c.req.query("resourceUri");
    if ((resourceKind === undefined) !== (resourceUri === undefined)) {
      return c.json(
        {
          code: "bad-request",
          message: "resourceKind and resourceUri must be provided together",
        },
        400,
      );
    }
    if (resourceKind !== undefined && !isSelectableResourceKind(resourceKind)) {
      return c.json({ code: "bad-request", message: "invalid resourceKind" }, 400);
    }
    if (resourceUri !== undefined && resourceUri.trim() === "") {
      return c.json({ code: "bad-request", message: "invalid resourceUri" }, 400);
    }

    const idx = Number(rawIdx);
    const stateAt = a.appState.stateAtIndex(idx);
    if (idx >= stateAt.totalEvents) {
      return c.json(
        {
          code: "not-found",
          message: "event index not found",
          totalEvents: stateAt.totalEvents,
        },
        404,
      );
    }

    return c.json(
      projectStateAtResponse(
        a.logKey,
        stateAt.result.targetIndex,
        stateAt.totalEvents,
        stateAt.result.resources,
        stateAt.result.diagnostics,
        stateAt.result.intents,
        stateAt.cache,
        resourceKind,
        resourceUri,
      ),
      200,
    );
  });
}

function isSelectableResourceKind(value: string): value is "root" | "session" | "terminal" {
  return SELECTABLE_RESOURCE_KINDS.has(value as ReplayResourceKind);
}

function projectStateAtResponse(
  logKey: string,
  targetIndex: number,
  totalEvents: number,
  resources: readonly ReplayResourceState[],
  diagnostics: readonly ReplayDiagnostic[],
  intents: readonly ReplayClientIntent[],
  cache: StateReplayCacheInfo,
  selectedKind: "root" | "session" | "terminal" | undefined,
  selectedUri: string | undefined,
): StateAtSuccessResponse {
  const selected =
    selectedKind && selectedUri
      ? resources.find(
          (resource) => resource.key.kind === selectedKind && resource.key.uri === selectedUri,
        )
      : undefined;
  return {
    logKey,
    targetIndex,
    totalEvents,
    confidence: aggregateConfidence(resources, selected, selectedKind !== undefined),
    diagnostics,
    resources: resources.map(resourceMetadata),
    selectedResource: selected ? selectedResource(selected) : null,
    intents,
    cache,
  };
}

function resourceMetadata(resource: ReplayResourceState): StateAtResourceMetadata {
  return {
    kind: resource.key.kind,
    uri: resource.key.uri,
    confidence: resource.confidence,
    baselineEventIdx: resource.baselineEventIdx,
    lastAppliedEventIdx: resource.lastAppliedEventIdx,
    baselineFromSeq: resource.baselineFromSeq,
    lastServerSeq: resource.lastServerSeq,
    diagnosticCount: resource.diagnostics.length,
  };
}

function selectedResource(resource: ReplayResourceState): StateAtSelectedResource {
  return {
    ...resourceMetadata(resource),
    diagnostics: resource.diagnostics,
    state: resource.state,
  };
}

function aggregateConfidence(
  resources: readonly ReplayResourceState[],
  selected: ReplayResourceState | undefined,
  hadSelection: boolean,
): ReplayConfidence {
  if (selected) {
    return selected.confidence;
  }
  if (hadSelection || resources.length === 0) {
    return "unknown";
  }
  return resources.some((resource) => resource.confidence === "partial") ? "partial" : "complete";
}
