import type { StateAtSelectedResource } from "../../transport/state-client.js";

export const MAX_PINNED_STATE_POINTS = 2;

export interface PinnedStatePoint {
  readonly id: string;
  readonly logKey: string;
  readonly targetIndex: number;
  readonly eventLabel: string;
  readonly eventTimestamp: number;
  readonly resourceKind: StateAtSelectedResource["kind"];
  readonly resourceUri: string;
  readonly confidence: StateAtSelectedResource["confidence"];
  readonly diagnosticCount: number;
  readonly baselineEventIdx: number;
  readonly lastAppliedEventIdx: number;
  readonly baselineFromSeq: number | null;
  readonly lastServerSeq: number | null;
  readonly state: unknown;
}

interface CreatePinnedStatePointArgs {
  readonly logKey: string;
  readonly targetIndex: number;
  readonly eventLabel: string;
  readonly eventTimestamp: number;
  readonly resource: StateAtSelectedResource;
}

export function createPinnedStatePoint({
  logKey,
  targetIndex,
  eventLabel,
  eventTimestamp,
  resource,
}: CreatePinnedStatePointArgs): PinnedStatePoint {
  return {
    id: `${logKey}:${targetIndex}:${resource.kind}:${resource.uri}`,
    logKey,
    targetIndex,
    eventLabel,
    eventTimestamp,
    resourceKind: resource.kind,
    resourceUri: resource.uri,
    confidence: resource.confidence,
    diagnosticCount: resource.diagnosticCount,
    baselineEventIdx: resource.baselineEventIdx,
    lastAppliedEventIdx: resource.lastAppliedEventIdx,
    baselineFromSeq: resource.baselineFromSeq,
    lastServerSeq: resource.lastServerSeq,
    state: resource.state,
  };
}

export function upsertPinnedStatePoint(
  existing: readonly PinnedStatePoint[],
  next: PinnedStatePoint,
): readonly PinnedStatePoint[] {
  const duplicateIndex = existing.findIndex((point) => point.id === next.id);
  if (duplicateIndex >= 0) {
    return existing.map((point, index) => (index === duplicateIndex ? next : point));
  }

  return [...existing, next].slice(-MAX_PINNED_STATE_POINTS);
}

export function removePinnedStatePoint(
  existing: readonly PinnedStatePoint[],
  id: string,
): readonly PinnedStatePoint[] {
  return existing.filter((point) => point.id !== id);
}

export function clearPinnedStatePoints(): readonly PinnedStatePoint[] {
  return [];
}
