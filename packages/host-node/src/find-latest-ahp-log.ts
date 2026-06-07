// findLatestAhpLog — picks the newest non-empty AHP-shape JSONL log under the
// standard VS Code log roots. Used by `npx ahp-inspector` (no path arg) per the
// locked Phase 13 selection rule (CONTEXT D-3).
//
// Candidates gathered within each root's independent scan bounds are sorted
// newest-mtime-first, and the first one whose first non-empty line normalizes
// to a non-parse-error AhpEvent wins.

import { open as fsOpen } from "node:fs/promises";
import { normalize, parseLine } from "@ahp-inspector/parser";
import { scanConfiguredRoots } from "./bounded-log-discovery.js";
import {
  defaultRoots,
  FILENAME_RE_AHP_JSONL,
  FILENAME_RE_AHP_NAMED_JSONL,
  type Root,
} from "./discovery.js";

export type { Root } from "./discovery.js";

const DEFAULT_TIME_BUDGET_MS = 1500;
const DEFAULT_MAX_STATS = 5000;
const DEFAULT_MAX_IMMEDIATE_ENTRIES = 5000;
const DEFAULT_TOP_LAUNCH_DIRS = 10;
const MAX_DEPTH_BELOW_LAUNCH = 4;
const PROBE_READ_BYTES = 64 * 1024;

export interface FindLatestAhpLogOptions {
  /** Test seam — override the default VS Code log roots. */
  rootsOverride?: readonly Root[];
}

/**
 * Returns the absolute path of the newest non-empty AHP-shape log, or null if
 * none qualify. Gathering is independently bounded per configured root; shape
 * probing consumes that complete bounded set in global newest-first order.
 */
export async function findLatestAhpLog(opts: FindLatestAhpLogOptions = {}): Promise<string | null> {
  const roots = opts.rootsOverride ?? defaultRoots();
  const scan = await scanConfiguredRoots({
    roots,
    matchesFilename: matchesAhpFilename,
    timeBudgetMs: DEFAULT_TIME_BUDGET_MS,
    maxStats: DEFAULT_MAX_STATS,
    maxImmediateEntries: DEFAULT_MAX_IMMEDIATE_ENTRIES,
    topLaunchDirs: DEFAULT_TOP_LAUNCH_DIRS,
    maxDepthBelowLaunch: MAX_DEPTH_BELOW_LAUNCH,
  });
  const ranked = scan.roots
    .flatMap((root) => root.files)
    .filter((candidate) => candidate.sizeBytes > 0)
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  for (const candidate of ranked) {
    if (await probeAhpShape(candidate.absPath)) return candidate.absPath;
  }
  return null;
}

function matchesAhpFilename(name: string): boolean {
  return FILENAME_RE_AHP_JSONL.test(name) || FILENAME_RE_AHP_NAMED_JSONL.test(name);
}

async function probeAhpShape(absPath: string): Promise<boolean> {
  let fh: Awaited<ReturnType<typeof fsOpen>> | undefined;
  try {
    fh = await fsOpen(absPath, "r");
    const buf = Buffer.alloc(PROBE_READ_BYTES);
    const { bytesRead } = await fh.read(buf, 0, PROBE_READ_BYTES, 0);
    if (bytesRead === 0) return false;
    const text = buf.subarray(0, bytesRead).toString("utf8");
    const newlineIdx = text.indexOf("\n");
    // Need a complete line to probe — partial trailing line is unreliable.
    const firstLine = newlineIdx >= 0 ? text.slice(0, newlineIdx) : text;
    // Strip a leading BOM and trailing CR.
    const stripped = firstLine
      .replace(/^\uFEFF/, "")
      .replace(/\r$/, "")
      .trim();
    if (stripped.length === 0) return false;
    const parsed = parseLine(stripped, 0, Buffer.byteLength(stripped));
    if (parsed.error) return false;
    const event = normalize(parsed.raw, {
      seq: 0,
      dir: "s2c",
      ts: 0,
      tsRaw: "",
      byteOffset: 0,
      byteLength: Buffer.byteLength(stripped),
    });
    return event.kind !== "parse-error";
  } catch {
    return false;
  } finally {
    if (fh) {
      try {
        await fh.close();
      } catch {
        /* ignore */
      }
    }
  }
}
