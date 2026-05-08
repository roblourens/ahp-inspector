import type { ReplayConfidence } from "../../transport/state-client.js";
import type { PinnedStatePoint } from "./state-pins.js";

export const MAX_CHANGED_TOP_LEVEL_PATHS = 25;

export interface StateComparisonResult {
  readonly from: PinnedStatePoint;
  readonly to: PinnedStatePoint;
  readonly changedPaths: readonly string[];
  readonly overflowCount: number;
  readonly same: boolean;
  readonly confidence: ReplayConfidence;
}

export function comparePinnedStatePoints(
  from: PinnedStatePoint,
  to: PinnedStatePoint,
): StateComparisonResult {
  const allChangedPaths = getChangedTopLevelPaths(from.state, to.state);
  const changedPaths = allChangedPaths.slice(0, MAX_CHANGED_TOP_LEVEL_PATHS);

  return {
    from,
    to,
    changedPaths,
    overflowCount: Math.max(0, allChangedPaths.length - changedPaths.length),
    same: allChangedPaths.length === 0,
    confidence: compareConfidence(from.confidence, to.confidence),
  };
}

function getChangedTopLevelPaths(from: unknown, to: unknown): string[] {
  if (isPlainComparableObject(from) && isPlainComparableObject(to)) {
    return Array.from(new Set([...Object.keys(from), ...Object.keys(to)])).filter(
      (key) => stableStringify(from[key]) !== stableStringify(to[key]),
    );
  }

  if (Array.isArray(from) && Array.isArray(to)) {
    if (from.length !== to.length) {
      return ["length"];
    }

    return from
      .map((value, index) => ({ index, value }))
      .filter(({ index, value }) => stableStringify(value) !== stableStringify(to[index]))
      .map(({ index }) => `[${index}]`);
  }

  return stableStringify(from) === stableStringify(to) ? [] : ["(root)"];
}

function isPlainComparableObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? "[Circular or non-serializable value]" : serialized;
  } catch {
    return "[Circular or non-serializable value]";
  }
}

function compareConfidence(from: ReplayConfidence, to: ReplayConfidence): ReplayConfidence {
  if (from === "complete" && to === "complete") {
    return "complete";
  }
  if (from === "partial" || to === "partial") {
    return "partial";
  }
  return "unknown";
}
