// Discovery — finds candidate AHP log files for the picker UI.
// Phase 4 plan 04-01: real implementation per CONTEXT D-02/D-03/D-05 and
// RESEARCH §1. Walks VS Code log roots with bounded depth + time + stat caps.

import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import type { DiscoveryResult, LogCandidate } from "@ahp-inspector/shared";
import { scanConfiguredRoots, type ScannedLogFile } from "./bounded-log-discovery.js";

const DEFAULT_TIME_BUDGET_MS = 1500;
const DEFAULT_MAX_STATS = 5000;
const DEFAULT_MAX_IMMEDIATE_ENTRIES = 5000;
const DEFAULT_TOP_LAUNCH_DIRS = 10;
const MAX_RESULTS = 200;
const MAX_DEPTH_BELOW_LAUNCH = 3;

type Origin = "vscode" | "vscode-insiders" | "vscode-oss-dev";

export interface Root {
  readonly origin: Origin;
  readonly dir: string;
}

export function defaultRoots(): readonly Root[] {
  const home = homedir();
  const platform = process.platform;
  // OSS dev builds (Code OSS run from sources) write to either
  // ~/.vscode-oss-dev or ~/.vscode-oss-agents-dev depending on the launch
  // user-data-dir flag. Scan both so AHP logs from regular and agents-enabled
  // OSS dev sessions both surface in the picker.
  const ossDevRoots: Root[] = [
    { origin: "vscode-oss-dev", dir: join(home, ".vscode-oss-dev", "logs") },
    { origin: "vscode-oss-dev", dir: join(home, ".vscode-oss-agents-dev", "logs") },
  ];
  if (platform === "darwin") {
    return [
      { origin: "vscode", dir: join(home, "Library", "Application Support", "Code", "logs") },
      {
        origin: "vscode-insiders",
        dir: join(home, "Library", "Application Support", "Code - Insiders", "logs"),
      },
      ...ossDevRoots,
    ];
  }
  if (platform === "win32") {
    const appData = process.env.APPDATA ?? join(home, "AppData", "Roaming");
    return [
      { origin: "vscode", dir: join(appData, "Code", "logs") },
      { origin: "vscode-insiders", dir: join(appData, "Code - Insiders", "logs") },
      ...ossDevRoots,
    ];
  }
  // linux + other unix
  return [
    { origin: "vscode", dir: join(home, ".config", "Code", "logs") },
    { origin: "vscode-insiders", dir: join(home, ".config", "Code - Insiders", "logs") },
    ...ossDevRoots,
  ];
}

export const FILENAME_RE_AHP_JSONL = /^(agenthost|agent-host|ahp).*\.jsonl$/i;
export const FILENAME_RE_AHP_NAMED_JSONL = /(agent-host|agenthost|ahp|copilot-chat).*\.jsonl$/i;

function score(name: string, mtimeMs: number, sizeBytes: number, parentPath: string): number {
  let s = 0;
  if (FILENAME_RE_AHP_JSONL.test(name)) s += 50;
  else if (FILENAME_RE_AHP_NAMED_JSONL.test(name)) s += 30;
  if (/copilot/i.test(parentPath)) s += 20;
  const ageMs = Date.now() - mtimeMs;
  if (ageMs <= 60 * 60 * 1000) s += 15;
  else if (ageMs <= 24 * 60 * 60 * 1000) s += 5;
  if (sizeBytes > 0) s += 5;
  if (sizeBytes > 500 * 1024 * 1024) s -= 10;
  return s;
}

function tier(s: number): "high" | "medium" | "low" {
  if (s >= 50) return "high";
  if (s >= 20) return "medium";
  return "low";
}

function makeId(absPath: string): string {
  return createHash("sha256").update(absPath).digest("hex").slice(0, 32);
}

function makeContextLabel(absPath: string, launchDir: string): string {
  const relativeParent = relative(launchDir, dirname(absPath));
  if (relativeParent === "" || relativeParent === ".") return "";
  if (isAbsolute(relativeParent) || relativeParent === ".." || relativeParent.startsWith(`..${sep}`)) return "";
  return [basename(launchDir), ...relativeParent.split(sep).filter(Boolean)].join(" / ");
}

export interface DiscoverOptions {
  roots?: readonly Root[];
  /** Per configured root; aggregate opportunity is roots.length * timeBudgetMs, excluding in-flight calls. */
  timeBudgetMs?: number;
  /** Per configured root; aggregate stat ceiling is roots.length * maxStats. */
  maxStats?: number;
  /** Per configured root; aggregate immediate-entry ceiling is roots.length * maxImmediateEntries. */
  maxImmediateEntries?: number;
  topLaunchDirs?: number;
  /** Test seam — override Date.now for time-budget tests. */
  now?: () => number;
}

// Module-private map populated on every successful discoverVsCodeLogs call.
// Wave 2 session routes consult this when the user clicks an opaque id.
const idToPath = new Map<string, string>();
let discoveryGeneration = 0;

export function resolveCandidateId(id: string): string | null {
  return idToPath.get(id) ?? null;
}

export async function discoverVsCodeLogs(opts: DiscoverOptions = {}): Promise<DiscoveryResult> {
  const roots = opts.roots ?? defaultRoots();
  const generation = ++discoveryGeneration;
  idToPath.clear();
  const scan = await scanConfiguredRoots({
    roots,
    matchesFilename: matchesAhpFilename,
    timeBudgetMs: opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS,
    maxStats: opts.maxStats ?? DEFAULT_MAX_STATS,
    maxImmediateEntries: opts.maxImmediateEntries ?? DEFAULT_MAX_IMMEDIATE_ENTRIES,
    topLaunchDirs: opts.topLaunchDirs ?? DEFAULT_TOP_LAUNCH_DIRS,
    maxDepthBelowLaunch: MAX_DEPTH_BELOW_LAUNCH,
    now: opts.now ?? Date.now,
  });

  const populatedRoots = scan.roots
    .map((scannedRoot) => {
      const root = roots[scannedRoot.rootIndex];
      if (!root) return [];
      return scannedRoot.files.map((file) => toPickerCandidate(file, root.origin)).sort(comparePickerCandidates);
    })
    .filter((candidates) => candidates.length > 0);
  const effectiveResultCap = Math.max(MAX_RESULTS, populatedRoots.length);
  const retained: PickerCandidate[] = [];
  const retainedPaths = new Set<string>();
  for (const candidates of populatedRoots) {
    const candidate = candidates[0];
    if (!candidate || retainedPaths.has(candidate.absPath)) continue;
    retained.push(candidate);
    retainedPaths.add(candidate.absPath);
  }
  const remainingCapacity = effectiveResultCap - retained.length;
  const extraQuota = populatedRoots.length > 0 ? Math.floor(remainingCapacity / populatedRoots.length) : 0;

  for (const candidates of populatedRoots) {
    for (const candidate of candidates.slice(1, 1 + extraQuota)) {
      if (retainedPaths.has(candidate.absPath)) continue;
      retained.push(candidate);
      retainedPaths.add(candidate.absPath);
    }
  }

  const fillCandidates = populatedRoots
    .flat()
    .filter((candidate) => !retainedPaths.has(candidate.absPath))
    .sort(comparePickerCandidates);
  for (const candidate of fillCandidates) {
    if (retained.length >= effectiveResultCap) break;
    if (retainedPaths.has(candidate.absPath)) continue;
    retained.push(candidate);
    retainedPaths.add(candidate.absPath);
  }

  retained.sort(comparePickerCandidates);
  if (generation === discoveryGeneration) {
    idToPath.clear();
    for (const candidate of retained) idToPath.set(candidate.safe.id, candidate.absPath);
  }
  const totalCandidateCount = new Set(populatedRoots.flat().map((candidate) => candidate.absPath)).size;
  return {
    candidates: retained.map((candidate) => candidate.safe),
    truncated: scan.truncated || retained.length < totalCandidateCount,
  };
}

interface PickerCandidate {
  readonly absPath: string;
  readonly safe: LogCandidate;
}

function toPickerCandidate(file: ScannedLogFile, origin: Origin): PickerCandidate {
  const confidence = tier(score(file.name, file.mtimeMs, file.sizeBytes, file.parentDir));
  return {
    absPath: file.absPath,
    safe: {
      id: makeId(file.absPath),
      label: file.name,
      mtimeMs: file.mtimeMs,
      sizeBytes: file.sizeBytes,
      origin,
      confidence,
      contextLabel: makeContextLabel(file.absPath, file.launchDir),
    },
  };
}

function comparePickerCandidates(left: PickerCandidate, right: PickerCandidate): number {
  const order = { high: 0, medium: 1, low: 2 } as const;
  const confidenceDifference = order[left.safe.confidence] - order[right.safe.confidence];
  return confidenceDifference || right.safe.mtimeMs - left.safe.mtimeMs;
}

function matchesAhpFilename(name: string): boolean {
  return FILENAME_RE_AHP_JSONL.test(name) || FILENAME_RE_AHP_NAMED_JSONL.test(name);
}
