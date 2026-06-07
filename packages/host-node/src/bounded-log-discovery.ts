import type { Stats } from "node:fs";
import { opendir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export interface ScanRoot {
  readonly dir: string;
}

export interface ScannedLogFile {
  readonly absPath: string;
  readonly name: string;
  readonly parentDir: string;
  readonly launchDir: string;
  readonly mtimeMs: number;
  readonly sizeBytes: number;
}

export interface ScannedRoot {
  readonly rootIndex: number;
  readonly files: readonly ScannedLogFile[];
  readonly truncated: boolean;
  readonly statsAttempted: number;
  readonly immediateEntriesExamined: number;
}

export interface ScanConfiguredRootsResult {
  readonly roots: readonly ScannedRoot[];
  readonly truncated: boolean;
}

export interface ScanConfiguredRootsOptions {
  readonly roots: readonly ScanRoot[];
  readonly matchesFilename: (name: string) => boolean;
  readonly timeBudgetMs: number;
  readonly maxStats: number;
  readonly maxImmediateEntries: number;
  readonly topLaunchDirs: number;
  readonly maxDepthBelowLaunch?: number;
  readonly now?: () => number;
}

interface LaunchEntry {
  readonly absPath: string;
  readonly mtimeMs: number;
}

interface RootScanState {
  stats: number;
  immediateEntries: number;
  truncated: boolean;
  readonly startedAt: number;
  readonly files: ScannedLogFile[];
}

export async function scanConfiguredRoots(
  options: ScanConfiguredRootsOptions,
): Promise<ScanConfiguredRootsResult> {
  const now = options.now ?? Date.now;
  const maxDepthBelowLaunch = options.maxDepthBelowLaunch ?? 3;
  const rootResults: ScannedRoot[] = [];

  for (const [rootIndex, root] of options.roots.entries()) {
    const state: RootScanState = {
      stats: 0,
      immediateEntries: 0,
      truncated: false,
      startedAt: now(),
      files: [],
    };
    const launchEntries: LaunchEntry[] = [];
    let rootDirectory: Awaited<ReturnType<typeof opendir>> | undefined;

    try {
      rootDirectory = await opendir(root.dir);
      while (true) {
        if (rootScanOverBudget(state, options, now, true)) break;
        const entry = await rootDirectory.read();
        if (!entry) break;
        state.immediateEntries++;

        const absPath = join(root.dir, entry.name);
        const entryStat = await boundedStat(absPath, state, options, now);
        if (!entryStat) continue;
        if (entryStat.isDirectory()) {
          launchEntries.push({ absPath, mtimeMs: entryStat.mtimeMs });
        } else if (entryStat.isFile() && options.matchesFilename(entry.name)) {
          state.files.push(toScannedFile(absPath, root.dir, entryStat.mtimeMs, entryStat.size));
        }
      }
    } catch {
      // Missing, unreadable, or concurrently removed roots do not block later roots.
    } finally {
      await rootDirectory?.close().catch(() => {});
    }

    launchEntries.sort((left, right) => right.mtimeMs - left.mtimeMs);
    if (launchEntries.length > options.topLaunchDirs) state.truncated = true;
    for (const launch of launchEntries.slice(0, options.topLaunchDirs)) {
      if (rootScanOverBudget(state, options, now, false)) break;
      await walkLaunchDirectory(launch.absPath, launch.absPath, maxDepthBelowLaunch, state, options, now);
    }

    rootResults.push({
      rootIndex,
      files: state.files,
      truncated: state.truncated,
      statsAttempted: state.stats,
      immediateEntriesExamined: state.immediateEntries,
    });
  }

  return { roots: rootResults, truncated: rootResults.some((root) => root.truncated) };
}

async function walkLaunchDirectory(
  absDir: string,
  launchDir: string,
  depthLeft: number,
  state: RootScanState,
  options: ScanConfiguredRootsOptions,
  now: () => number,
): Promise<void> {
  if (depthLeft < 0 || rootScanOverBudget(state, options, now, false)) return;
  let directory: Awaited<ReturnType<typeof opendir>> | undefined;
  try {
    directory = await opendir(absDir);
    while (true) {
      if (rootScanOverBudget(state, options, now, false)) return;
      const entry = await directory.read();
      if (!entry) return;
      const absPath = join(absDir, entry.name);
      const entryStat = await boundedStat(absPath, state, options, now);
      if (!entryStat) continue;
      if (entryStat.isDirectory()) {
        if (depthLeft === 0) {
          state.truncated = true;
        } else {
          await walkLaunchDirectory(absPath, launchDir, depthLeft - 1, state, options, now);
        }
      } else if (entryStat.isFile() && options.matchesFilename(entry.name)) {
        state.files.push(toScannedFile(absPath, launchDir, entryStat.mtimeMs, entryStat.size));
      }
    }
  } catch {
    // Entries may disappear or become unreadable while discovery is running.
  } finally {
    await directory?.close().catch(() => {});
  }
}

async function boundedStat(
  absPath: string,
  state: RootScanState,
  options: ScanConfiguredRootsOptions,
  now: () => number,
): Promise<Stats | undefined> {
  if (rootScanOverBudget(state, options, now, false)) return undefined;
  state.stats++;
  try {
    return await stat(absPath);
  } catch {
    return undefined;
  }
}

function rootScanOverBudget(
  state: RootScanState,
  options: ScanConfiguredRootsOptions,
  now: () => number,
  includeImmediateEntries: boolean,
): boolean {
  const overBudget =
    state.stats >= options.maxStats ||
    now() - state.startedAt >= options.timeBudgetMs ||
    (includeImmediateEntries && state.immediateEntries >= options.maxImmediateEntries);
  if (overBudget) state.truncated = true;
  return overBudget;
}

function toScannedFile(absPath: string, launchDir: string, mtimeMs: number, sizeBytes: number): ScannedLogFile {
  return {
    absPath,
    name: basename(absPath),
    parentDir: dirname(absPath),
    launchDir,
    mtimeMs,
    sizeBytes,
  };
}