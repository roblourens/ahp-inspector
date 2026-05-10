// findLatestAhpLog — picks the newest non-empty AHP-shape JSONL log under the
// standard VS Code log roots. Used by `npx ahp-inspector` (no path arg) per the
// locked Phase 13 selection rule (CONTEXT D-3).
//
// The walker mirrors discoverVsCodeLogs's bounded depth/time/stat caps so the
// CLI never stalls more than ~2s on a clean profile. Candidates are sorted
// newest-mtime-first, and the first one whose first non-empty line normalizes
// to a non-parse-error AhpEvent wins.

import { open as fsOpen, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { normalize, parseLine } from "@ahp-inspector/parser";
import {
  defaultRoots,
  FILENAME_RE_AHP_JSONL,
  FILENAME_RE_AHP_NAMED_JSONL,
  type Root,
} from "./discovery.js";

export type { Root } from "./discovery.js";

const DEFAULT_TIME_BUDGET_MS = 1500;
const DEFAULT_MAX_STATS = 5000;
const MAX_DEPTH_BELOW_ROOT = 5;
const MAX_PROBE_CANDIDATES = 10;
const PROBE_READ_BYTES = 64 * 1024;

export interface FindLatestAhpLogOptions {
  /** Test seam — override the default VS Code log roots. */
  rootsOverride?: readonly Root[];
}

interface PathCandidate {
  absPath: string;
  mtimeMs: number;
  sizeBytes: number;
}

/**
 * Returns the absolute path of the newest non-empty AHP-shape log, or null if
 * none qualify. Bounded by time, stat count, and a max-probe cap so it cannot
 * block CLI startup for more than ~2s on a populated profile.
 */
export async function findLatestAhpLog(opts: FindLatestAhpLogOptions = {}): Promise<string | null> {
  const roots = opts.rootsOverride ?? defaultRoots();
  const startedAt = Date.now();
  let stats = 0;

  const overBudget = (): boolean =>
    stats >= DEFAULT_MAX_STATS || Date.now() - startedAt >= DEFAULT_TIME_BUDGET_MS;

  const collected: PathCandidate[] = [];

  for (const root of roots) {
    if (overBudget()) break;
    await walk(root.dir, MAX_DEPTH_BELOW_ROOT, collected, () => {
      stats++;
      return overBudget();
    });
  }

  const ranked = collected
    .filter((c) => c.sizeBytes > 0)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MAX_PROBE_CANDIDATES);

  for (const c of ranked) {
    if (await probeAhpShape(c.absPath)) return c.absPath;
  }
  return null;
}

async function walk(
  absDir: string,
  depthLeft: number,
  sink: PathCandidate[],
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
    if (tickAndCheck()) return;
    const abs = join(absDir, name);
    let st: Awaited<ReturnType<typeof stat>>;
    try {
      st = await stat(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      await walk(abs, depthLeft - 1, sink, tickAndCheck);
      continue;
    }
    if (!st.isFile()) continue;
    if (!(FILENAME_RE_AHP_JSONL.test(name) || FILENAME_RE_AHP_NAMED_JSONL.test(name))) {
      continue;
    }
    sink.push({ absPath: abs, mtimeMs: st.mtimeMs, sizeBytes: st.size });
  }
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
