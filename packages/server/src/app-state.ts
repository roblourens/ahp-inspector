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
} from "@ahp-viewer/core";
import { LineSplitter, normalize, parseLine } from "@ahp-viewer/parser";
import {
  type Direction,
  type HostAdapter,
  type LogHandle,
  makeParseErrorEvent,
} from "@ahp-viewer/shared";
import { SearchIndex } from "./search-index.js";

/** Server-side log metadata. NEVER carries absolute paths (T-02-03). */
export interface LogMeta {
  /** basename only — never absolute path */
  readonly filename: string;
  readonly sizeBytes: number;
  readonly startedAt: number;
}

/** Discriminated union of every payload AppState emits to subscribers. */
export type SsePayload =
  | { kind: "snapshot-begin"; meta: LogMeta; total: number }
  | { kind: "snapshot-chunk"; rows: EventRow[]; from: number }
  | { kind: "snapshot-end" }
  | { kind: "append"; rows: EventRow[]; from: number }
  | {
      kind: "patch";
      updates: Array<{
        idx: number;
        status: Status;
        latencyMs: number | null;
        latencyBand: LatencyBand | null;
      }>;
    }
  | { kind: "ping" }
  | { kind: "bye" }
  | { kind: "error"; code: string; message: string };

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
}

export interface AppState {
  readonly meta: LogMeta;
  readonly searchIndex: SearchIndex;
  snapshot(): { meta: LogMeta; rows: EventRow[] };
  subscribe(listener: Listener): () => void;
  /**
   * Manually drive the unmatched-timeout flush. Used by tests when
   * flushIntervalMs is 0; production callers should rely on the ticker.
   */
  runFlush(nowMs?: number): void;
  /** Returns the raw AhpEvent at the given store index, or null if out of range. */
  eventAt(idx: number): import("@ahp-viewer/shared").AhpEvent | null;
  /**
   * Returns correlator metadata for the event at the given index.
   * Used by detail-routes to build the DetailResponse shape.
   */
  correlatorDataFor(idx: number): {
    pairIdx: number | null;
    latencyMs: number | null;
    status: Status;
  };
  dispose(): Promise<void>;
}

export async function createAppState(opts: AppStateOptions): Promise<AppState> {
  const handle = (await opts.host.openLog(opts.file)) as MaybeNodeLogHandle;
  const store = new EventStore();
  const correlator = new Correlator(store);
  const splitter = new LineSplitter();
  const decoder = new TextDecoder("utf-8");
  const inferDir: (raw: unknown) => Direction = opts.directionInference ?? (() => "c2s");

  const handlePath = handle.path ?? handle.id;
  const meta: LogMeta = {
    filename: basename(handlePath),
    sizeBytes: handle.size ?? 0,
    startedAt: Date.now(),
  };

  const rows: EventRow[] = [];
  const listeners = new Set<Listener>();
  const unmatchedTimeoutMs = opts.unmatchedTimeoutMs ?? 30_000;
  const searchIdx = new SearchIndex();

  let seq = 0;
  let byteOffset = 0;

  function emit(payload: SsePayload): void {
    for (const l of listeners) {
      try {
        l(payload);
      } catch {
        /* never let a bad listener block ingest */
      }
    }
  }

  const lastSeenServerSeq = new Map<string | null, number>();

  function buildRow(idx: number): EventRow {
    const ev = store.at(idx);
    if (!ev) throw new Error(`AppState.buildRow: missing event at idx=${idx}`);
    const status = correlator.statusOf(idx);
    const latency = correlator.latencyOf(idx);

    const evSeq = store.serverSeq[idx] ?? null;
    const sessionKey = ev.sessionId ?? null;
    const prevSeq = lastSeenServerSeq.get(sessionKey);
    const gapBefore = evSeq != null && prevSeq != null && evSeq !== prevSeq + 1;
    if (evSeq != null) lastSeenServerSeq.set(sessionKey, evSeq);

    const rawRec =
      ev.raw != null && typeof ev.raw === "object" ? (ev.raw as Record<string, unknown>) : null;
    const errRec =
      rawRec?.error != null && typeof rawRec.error === "object"
        ? (rawRec.error as Record<string, unknown>)
        : null;
    const errorCode = typeof errRec?.code === "number" ? (errRec.code as number) : null;
    const isAuthFailure =
      (ev.kind === "response" && errorCode === -32007) ||
      ((ev.kind === "protocol-notification" || ev.kind === "server-notification") &&
        ev.actionType === "notify/authRequired");

    const extras: EventRowExtras = {
      errorCode,
      serverSeq: evSeq,
      gapBefore,
      isAuthFailure,
    };

    return projectRow(ev, idx, status, latency, extras);
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
    // 2. Detect retroactive patches: any earlier row whose status/latency
    //    changed (e.g. pending → ok when a response paired the request).
    const updates: Array<{
      idx: number;
      status: Status;
      latencyMs: number | null;
      latencyBand: LatencyBand | null;
    }> = [];
    for (let i = 0; i < range.from; i++) {
      const prev = rows[i];
      if (!prev) continue;
      const status = correlator.statusOf(i);
      const latencyMs = correlator.latencyOf(i);
      if (prev.status !== status || prev.latencyMs !== latencyMs) {
        const latencyBand = bandFor(latencyMs);
        rows[i] = { ...prev, status, latencyMs, latencyBand };
        updates.push({ idx: i, status, latencyMs, latencyBand });
      }
    }
    if (newRows.length > 0) emit({ kind: "append", rows: newRows, from: range.from });
    if (updates.length > 0) emit({ kind: "patch", updates });
  });

  // Ingest loop.
  const watcher = opts.host.watchLog(handle, (chunk: Uint8Array) => {
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
      const ts = Date.now();
      const parsed = parseLine(line, byteOffset, byteLength);
      const dir: Direction = parsed.error ? "c2s" : inferDir(parsed.raw);
      const m = { seq, ts, tsRaw: String(ts), dir, byteOffset, byteLength };
      const ev = parsed.error
        ? makeParseErrorEvent(m, parsed.error.reason, parsed.text)
        : normalize(parsed.raw, m);
      store.append(ev);
      seq += 1;
      byteOffset += byteLength + newlineSize; // +1 LF or +2 CRLF
    }
  });

  function runFlush(nowMs?: number): void {
    const now = nowMs ?? Date.now();
    correlator.flush(now, unmatchedTimeoutMs);
    const updates: Array<{
      idx: number;
      status: Status;
      latencyMs: number | null;
      latencyBand: LatencyBand | null;
    }> = [];
    for (let i = 0; i < store.size(); i++) {
      const prev = rows[i];
      if (!prev) continue;
      const status = correlator.statusOf(i);
      const latencyMs = correlator.latencyOf(i);
      if (prev.status !== status || prev.latencyMs !== latencyMs) {
        const latencyBand = bandFor(latencyMs);
        rows[i] = { ...prev, status, latencyMs, latencyBand };
        updates.push({ idx: i, status, latencyMs, latencyBand });
      }
    }
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
      return { meta, rows: rows.slice() };
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
    async dispose() {
      if (disposed) return;
      disposed = true;
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
