// AppState — owns one open log and bridges host ingestion to a Projector
// that emits EventRow snapshot/append/patch frames to subscribers.
//
// Phase 2 plan 02-01. RESEARCH Pattern 1 (row projection), Pattern 3
// (AppState boundary), Pitfall 2 (correlator key types). Threat T-02-03
// (no absolute paths leak — only basename crosses any boundary).

import { Buffer } from "node:buffer";
import { basename } from "node:path";
import {
  bandFor,
  Correlator,
  type EventRow,
  type EventRowExtras,
  EventStore,
  type LatencyBand,
  projectRow,
  type Status,
} from "@ahp-inspector/core";
import { extractWireMeta, LineSplitter, normalize, parseLine } from "@ahp-inspector/parser";
import {
  type Direction,
  type HostAdapter,
  type LogHandle,
  makeParseErrorEvent,
} from "@ahp-inspector/shared";
import { computeLogKey } from "./log-key.js";
import { SearchIndex } from "./search-index.js";
import { StateReplayIndex, type StateReplayIndexResult } from "./state-replay-index.js";

/** Server-side log metadata. NEVER carries absolute paths (T-02-03). */
export interface LogMeta {
  /** basename only — never absolute path */
  readonly filename: string;
  readonly sizeBytes: number;
  readonly startedAt: number;
  /**
   * Stable, opaque identifier for this log (D-16). 32-char lowercase hex
   * derived from sha256(absPath + initial mtimeMs). Used by the UI to scope
   * per-log persistence; never reveals the underlying path.
   */
  readonly logKey: string;
}

/** Discriminated union of every payload AppState emits to subscribers. */
export type SsePayload =
  | { kind: "snapshot-begin"; meta: LogMeta; total: number }
  | { kind: "snapshot-chunk"; rows: EventRow[]; from: number }
  | { kind: "snapshot-end" }
  | { kind: "append"; rows: EventRow[]; from: number }
  | {
      kind: "load-progress";
      phase: "idle" | "loading" | "complete";
      loadedRows: number;
      loadedBytes: number;
      totalBytes?: number;
      percent?: number;
    }
  | { kind: "stream-backlog"; queuedFrames: number; queuedRows: number }
  | {
      kind: "patch";
      updates: Array<{
        idx: number;
        status: Status;
        latencyMs: number | null;
        latencyBand: LatencyBand | null;
        summary?: string;
        pairIdx: number | null;
      }>;
    }
  | { kind: "ping" }
  | { kind: "bye" }
  | { kind: "error"; code: string; message: string }
  | { kind: "rotation"; newSize: number; reason: "shrink" | "rename" }
  | { kind: "watch-error"; code: "read-error" | "watch-fatal"; message: string }
  | { kind: "log-reset" };

type PatchUpdate = Extract<SsePayload, { kind: "patch" }>["updates"][number];
type LoadProgressPayload = Extract<SsePayload, { kind: "load-progress" }>;

export type Listener = (payload: SsePayload) => void;

/** Optional NodeLogHandle-like shape — `path`/`size` consumed for meta. */
interface MaybeNodeLogHandle extends LogHandle {
  readonly path?: string;
  readonly size?: number;
}

export interface AppStateOptions {
  readonly host: HostAdapter;
  readonly file: string;
  /** CLI (plan 02-05) injects real direction inference; default = c2s. */
  readonly directionInference?: (raw: unknown) => Direction;
  /** Default 1000ms. Pass 0 to disable the auto-flush ticker (tests). */
  readonly flushIntervalMs?: number;
  /** Default 30_000ms. Used by Correlator.flush. */
  readonly unmatchedTimeoutMs?: number;
  /**
   * Optional pre-computed logKey (Phase 4 D-16). When omitted, AppState falls
   * back to `computeLogKey(handlePath, Date.now())` so existing CLI/tests keep
   * working; Wave 2's session manager will inject a stable mtime-derived key.
   */
  readonly logKey?: string;
  /**
   * Optional file mtimeMs captured by the session manager at open time
   * (Phase 4 D-16). Used to derive a stable logKey when `logKey` is not
   * pre-supplied. When both are absent, AppState falls back to Date.now().
   */
  readonly initialMtimeMs?: number;
}

export interface AppState {
  readonly meta: LogMeta;
  readonly searchIndex: SearchIndex;
  snapshot(): { meta: LogMeta; rows: EventRow[]; loadProgress: LoadProgressPayload };
  subscribe(listener: Listener): () => void;
  /**
   * Manually drive the unmatched-timeout flush. Used by tests when
   * flushIntervalMs is 0; production callers should rely on the ticker.
   */
  runFlush(nowMs?: number): void;
  /** Returns the raw AhpEvent at the given store index, or null if out of range. */
  eventAt(idx: number): import("@ahp-inspector/shared").AhpEvent | null;
  /**
   * Returns correlator metadata for the event at the given index.
   * Used by detail-routes to build the DetailResponse shape.
   */
  correlatorDataFor(idx: number): {
    pairIdx: number | null;
    latencyMs: number | null;
    status: Status;
  };
  stateAtIndex(targetIndex: number): AppStateStateAtResult;
  dispose(): Promise<void>;
}

export interface AppStateStateAtResult extends StateReplayIndexResult {
  readonly totalEvents: number;
}

export async function createAppState(opts: AppStateOptions): Promise<AppState> {
  const handle = (await opts.host.openLog(opts.file)) as MaybeNodeLogHandle;
  const store = new EventStore();
  const stateReplay = new StateReplayIndex(store, 25);
  const correlator = new Correlator(store);
  const splitter = new LineSplitter();
  const decoder = new TextDecoder("utf-8");
  const inferDir: (raw: unknown) => Direction = opts.directionInference ?? (() => "c2s");

  const handlePath = handle.path ?? handle.id;
  const initialMtimeMs = opts.initialMtimeMs ?? Date.now();
  const meta: LogMeta = {
    filename: basename(handlePath),
    sizeBytes: handle.size ?? 0,
    startedAt: Date.now(),
    logKey: opts.logKey ?? computeLogKey(handlePath, initialMtimeMs),
  };

  const rows: EventRow[] = [];
  const listeners = new Set<Listener>();
  const unmatchedTimeoutMs = opts.unmatchedTimeoutMs ?? 30_000;
  const searchIdx = new SearchIndex();

  let seq = 0;
  let byteOffset = 0;
  let initialReadLoadedBytes = 0;
  let initialReadTotalBytes: number | undefined;
  let initialReadPhase: LoadProgressPayload["phase"] = "idle";

  function emit(payload: SsePayload): void {
    for (const l of listeners) {
      try {
        l(payload);
      } catch {
        /* never let a bad listener block ingest */
      }
    }
  }

  function currentLoadProgress(phase = initialReadPhase): LoadProgressPayload {
    const totalBytes = initialReadTotalBytes;
    const percent =
      totalBytes !== undefined && totalBytes > 0
        ? Math.min(100, Math.round((initialReadLoadedBytes / totalBytes) * 100))
        : undefined;
    return {
      kind: "load-progress",
      phase,
      loadedRows: rows.length,
      loadedBytes: initialReadLoadedBytes,
      ...(totalBytes !== undefined ? { totalBytes } : {}),
      ...(percent !== undefined ? { percent } : {}),
    };
  }

  function emitLoadProgress(phase: LoadProgressPayload["phase"]): void {
    initialReadPhase = phase;
    emit(currentLoadProgress());
  }

  let lastSeenServerSeq: number | null = null;

  function buildRow(idx: number): EventRow {
    const ev = store.at(idx);
    if (!ev) throw new Error(`AppState.buildRow: missing event at idx=${idx}`);
    const status = correlator.statusOf(idx);
    const latency = correlator.latencyOf(idx);

    const evSeq = store.serverSeq[idx] ?? null;
    const previousServerSeq = lastSeenServerSeq;
    const gapBefore = evSeq != null && previousServerSeq != null && evSeq > previousServerSeq + 1;
    if (evSeq != null && (lastSeenServerSeq === null || evSeq > lastSeenServerSeq)) {
      lastSeenServerSeq = evSeq;
    }

    const rawRec =
      ev.raw != null && typeof ev.raw === "object" ? (ev.raw as Record<string, unknown>) : null;
    const errRec =
      rawRec?.error != null && typeof rawRec.error === "object"
        ? (rawRec.error as Record<string, unknown>)
        : null;
    const errorCode = typeof errRec?.code === "number" ? (errRec.code as number) : null;
    const pairIdx = correlator.pairOf(idx);
    const pairEvent = pairIdx !== null ? store.at(pairIdx) : null;
    const pairMethod = pairEvent?.method ?? null;
    const isAuthFailure =
      (ev.kind === "response" && errorCode === -32007) ||
      ((ev.kind === "protocol-notification" || ev.kind === "server-notification") &&
        ev.actionType === "notify/authRequired");

    const extras: EventRowExtras = {
      errorCode,
      serverSeq: evSeq,
      previousServerSeq,
      gapBefore,
      isAuthFailure,
      pairIdx,
    };

    return projectRow(ev, idx, status, latency, extras, pairMethod);
  }

  function buildPatchUpdates(indexes: Iterable<number>): PatchUpdate[] {
    const updates: PatchUpdate[] = [];
    for (const idx of indexes) {
      const prev = rows[idx];
      if (!prev) continue;
      const status = correlator.statusOf(idx);
      const latencyMs = correlator.latencyOf(idx);
      const pairIdx = correlator.pairOf(idx);
      if (prev.status === status && prev.latencyMs === latencyMs && prev.pairIdx === pairIdx) {
        continue;
      }
      const latencyBand = bandFor(latencyMs);
      rows[idx] = { ...prev, status, latencyMs, latencyBand, pairIdx };
      updates.push({
        idx,
        status,
        latencyMs,
        latencyBand,
        ...(prev.summary !== undefined ? { summary: prev.summary } : {}),
        pairIdx,
      });
    }
    return updates;
  }

  // Subscribe AFTER the Correlator so the correlator updates first and our
  // status/latency reads reflect the just-paired state.
  const offStore = store.subscribe((range) => {
    // 1. Capture rows for newly appended events.
    const newRows: EventRow[] = [];
    for (let i = range.from; i < range.to; i++) {
      const row = buildRow(i);
      rows[i] = row;
      newRows.push(row);
      // Haystack stays in sync with store — append once per new event.
      if (i >= searchIdx.size) {
        const ev = store.at(i);
        if (ev) searchIdx.append(ev);
      }
    }
    // 2. Retroactive patches are limited to pre-existing rows. New append rows
    //    were already built from the correlator's latest metadata above.
    const changedIndexes = correlator
      .drainChangedIndexes()
      .filter((idx) => idx < range.from);
    const updates = buildPatchUpdates(changedIndexes);
    if (newRows.length > 0) emit({ kind: "append", rows: newRows, from: range.from });
    if (updates.length > 0) emit({ kind: "patch", updates });
  });

  // Ingest loop.
  const watcher = opts.host.watchLog(handle, {
    onInitialReadStart(info) {
      initialReadLoadedBytes = 0;
      initialReadTotalBytes = info.totalBytes;
      emitLoadProgress("loading");
    },
    onInitialReadProgress(info) {
      initialReadLoadedBytes = info.loadedBytes;
      initialReadTotalBytes = info.totalBytes;
      emitLoadProgress("loading");
    },
    onInitialReadComplete(info) {
      initialReadLoadedBytes = info.loadedBytes;
      initialReadTotalBytes = info.totalBytes;
      emitLoadProgress("complete");
    },
    onChunk(chunk: Uint8Array, _byteOffset: number) {
      const text = decoder.decode(chunk, { stream: true });
      // Detect CRLF vs LF so byteOffset stays byte-accurate for Windows logs.
      // The LineSplitter strips the '\r', so we add the extra byte here if needed.
      const newlineSize = text.includes("\r\n") ? 2 : 1;
      let lines: string[];
      try {
        lines = splitter.push(text);
      } catch (err) {
        emit({
          kind: "error",
          code: "parse-overflow",
          message: (err as Error).message,
        });
        return;
      }
      for (const line of lines) {
        const byteLength = Buffer.byteLength(line, "utf8");
        const parsed = parseLine(line, byteOffset, byteLength);
        const wire = parsed.error ? null : extractWireMeta(parsed.raw);
        const ingestNow = Date.now();
        const ts = wire?.ts ?? ingestNow;
        const tsRaw = wire?.tsRaw ?? String(ingestNow);
        const dir: Direction = parsed.error ? "c2s" : (wire?.dir ?? inferDir(parsed.raw));
        const m = { seq, ts, tsRaw, dir, byteOffset, byteLength };
        const ev = parsed.error
          ? makeParseErrorEvent(m, parsed.error.reason, parsed.text)
          : normalize(parsed.raw, m);
        store.append(ev);
        seq += 1;
        byteOffset += byteLength + newlineSize; // +1 LF or +2 CRLF
      }
    },
    onReset(info) {
      // Rotation is a full logical log reset: clear all server-side row/detail/
      // search/correlation indexes before TailReader reads the replacement file.
      // This guarantees post-rotation append frames start at from: 0, while seq
      // is intentionally NOT reset (T-04-02-04 accepted).
      try {
        splitter.reset();
      } catch {
        /* defensive */
      }
      byteOffset = 0;
      store.reset();
      stateReplay.reset();
      correlator.reset();
      rows.length = 0;
      searchIdx.reset();
      lastSeenServerSeq = null;
      initialReadLoadedBytes = 0;
      initialReadTotalBytes = undefined;
      emitLoadProgress("idle");
      emit({ kind: "rotation", newSize: info.newSize, reason: info.reason });
    },
    onError(err, fatal) {
      emit({
        kind: "watch-error",
        code: fatal ? "watch-fatal" : "read-error",
        message: err.message,
      });
    },
  });

  function runFlush(nowMs?: number): void {
    const now = nowMs ?? Date.now();
    correlator.flush(now, unmatchedTimeoutMs);
    const updates = buildPatchUpdates(correlator.drainChangedIndexes());
    if (updates.length > 0) emit({ kind: "patch", updates });
  }

  const flushIntervalMs = opts.flushIntervalMs ?? 1000;
  const flushTimer: NodeJS.Timeout | null =
    flushIntervalMs > 0 ? setInterval(() => runFlush(), flushIntervalMs) : null;

  let disposed = false;
  return {
    meta,
    searchIndex: searchIdx,
    snapshot() {
      return { meta, rows: rows.slice(), loadProgress: currentLoadProgress() };
    },
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    runFlush,
    eventAt(idx: number) {
      return store.at(idx) ?? null;
    },
    correlatorDataFor(idx: number) {
      return {
        pairIdx: correlator.pairOf(idx),
        latencyMs: correlator.latencyOf(idx),
        status: correlator.statusOf(idx),
      };
    },
    stateAtIndex(targetIndex: number) {
      return { ...stateReplay.stateAtIndex(targetIndex), totalEvents: store.size() };
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      stateReplay.reset();
      if (flushTimer) clearInterval(flushTimer);
      try {
        watcher.dispose();
      } catch {
        /* ignore */
      }
      try {
        offStore();
      } catch {
        /* ignore */
      }
      try {
        correlator.dispose();
      } catch {
        /* ignore */
      }
      try {
        await opts.host.close(handle);
      } catch {
        /* ignore */
      }
      listeners.clear();
    },
  };
}
