// Discovery — finds candidate AHP log files for the picker UI.
// Phase 4 plan 04-01: real implementation per CONTEXT D-02/D-03/D-05 and
// RESEARCH §1. Walks VS Code log roots with bounded depth + time + stat caps.

import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, sep } from "node:path";
import type { DiscoveryResult, LogCandidate } from "@ahp-inspector/shared";

const DEFAULT_TIME_BUDGET_MS = 1500;
const DEFAULT_MAX_STATS = 5000;
const DEFAULT_TOP_LAUNCH_DIRS = 10;
const MAX_LAUNCH_LIST = 50;
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
  // Strip everything up through the launch dir, then split.
  const idx = absPath.indexOf(launchDir);
  if (idx < 0) return "";
  const tail = absPath.slice(idx).split(sep).filter(Boolean);
  // Drop the basename — context is the *containing* breadcrumb.
  tail.pop();
  return tail.join(" / ");
}

export interface DiscoverOptions {
  roots?: readonly Root[];
  timeBudgetMs?: number;
  maxStats?: number;
  topLaunchDirs?: number;
  /** Test seam — override Date.now for time-budget tests. */
  now?: () => number;
}

// Module-private map populated on every successful discoverVsCodeLogs call.
// Wave 2 session routes consult this when the user clicks an opaque id.
const idToPath = new Map<string, string>();

export function resolveCandidateId(id: string): string | null {
  return idToPath.get(id) ?? null;
}

export async function discoverVsCodeLogs(opts: DiscoverOptions = {}): Promise<DiscoveryResult> {
  const roots = opts.roots ?? defaultRoots();
  const timeBudget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const maxStats = opts.maxStats ?? DEFAULT_MAX_STATS;
  const topLaunch = opts.topLaunchDirs ?? DEFAULT_TOP_LAUNCH_DIRS;
  const now = opts.now ?? Date.now;
  const startedAt = now();

  let stats = 0;
  let truncated = false;
  const collected: LogCandidate[] = [];
  idToPath.clear();

  const overBudget = (): boolean => stats >= maxStats || now() - startedAt >= timeBudget;

  for (const root of roots) {
    if (overBudget()) {
      truncated = true;
      break;
    }
    const launchEntries: { name: string; mtimeMs: number }[] = [];
    try {
      const names = await readdir(root.dir);
      const limited = names.slice(0, MAX_LAUNCH_LIST);
      for (const name of limited) {
        if (overBudget()) {
          truncated = true;
          break;
        }
        try {
          const st = await stat(join(root.dir, name));
          stats++;
          if (st.isDirectory()) launchEntries.push({ name, mtimeMs: st.mtimeMs });
        } catch {
          /* skip */
        }
      }
    } catch {
      continue; // root doesn't exist on this machine
    }
    launchEntries.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const topEntries = launchEntries.slice(0, topLaunch);

    for (const launch of topEntries) {
      if (overBudget()) {
        truncated = true;
        break;
      }
      const launchDir = join(root.dir, launch.name);
      await walkBounded(
        launchDir,
        launchDir,
        MAX_DEPTH_BELOW_LAUNCH,
        root.origin,
        collected,
        () => {
          stats++;
          return overBudget();
        },
      );
    }
  }

  // Build SafeCandidates with confidence + contextLabel + opaque id.
  const out: LogCandidate[] = collected
    .map((c) => c)
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 } as const;
      const av = order[a.confidence];
      const bv = order[b.confidence];
      if (av !== bv) return av - bv;
      return b.mtimeMs - a.mtimeMs;
    })
    .slice(0, MAX_RESULTS);

  return { candidates: out, truncated };

  async function walkBounded(
    absDir: string,
    launchDir: string,
    depthLeft: number,
    origin: Origin,
    sink: LogCandidate[],
    tickAndCheck: () => boolean,
  ): Promise<void> {
    if (depthLeft < 0) return;
    let names: string[];
    try {
      names = await readdir(absDir);
    } catch {
      return;
    }
    for (const name of names) {
      if (tickAndCheck()) {
        truncated = true;
        return;
      }
      const abs = join(absDir, name);
      let st: Awaited<ReturnType<typeof stat>>;
      try {
        st = await stat(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        await walkBounded(abs, launchDir, depthLeft - 1, origin, sink, tickAndCheck);
        continue;
      }
      if (!st.isFile()) continue;
      const ok = FILENAME_RE_AHP_JSONL.test(name) || FILENAME_RE_AHP_NAMED_JSONL.test(name);
      if (!ok) continue;
      const sc = score(name, st.mtimeMs, st.size, absDir);
      const id = makeId(abs);
      idToPath.set(id, abs);
      const confidence = tier(sc);
      sink.push({
        id,
        label: basename(abs),
        mtimeMs: st.mtimeMs,
        sizeBytes: st.size,
        origin,
        confidence,
        contextLabel: makeContextLabel(abs, launchDir),
      });
      if (sink.length >= MAX_RESULTS * 4) {
        // Soft early stop — we'll re-sort and slice anyway, no need to keep walking.
        truncated = true;
        return;
      }
    }
  }
}
