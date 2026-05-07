// Correlator — pairs request/response events using the bidirectional
// JSON-RPC-safe correlation key from @ahp-viewer/shared.
//
// 01-RESEARCH.md Pattern 4 (lines 277-319) + Pitfall 2 (lines 444-447).
// Threat: T-03-02 (mispairing across direction or id-type).
//
// Indexed by event idx (positions in the EventStore):
//   - pairIdx[i]   = the matched event idx, or -1 if none
//   - latencyMs[i] = response.ts - request.ts on a paired request, else -1
//   - status[i]    = 'ok' | 'error' | 'pending' | 'unmatched' | 'orphan' | 'n/a'
//
// Notifications, actions, protocol-notifications, parse-errors, and log lines
// MUST NOT touch the correlation map (status defaults to 'n/a').

import type { AhpEvent, CorrelationKey } from "@ahp-viewer/shared";
import { correlationKeyForRequest, correlationKeyForResponse } from "@ahp-viewer/shared";
import type { AppendRange, EventStore } from "./event-store.js";
import type { Status } from "./types.js";

export class Correlator {
  readonly #store: EventStore;
  readonly #pendingRequests = new Map<CorrelationKey, number>();
  readonly #pendingResponses = new Map<CorrelationKey, number>();
  readonly #unsubscribe: () => void;

  readonly pairIdx: number[] = [];
  readonly latencyMs: number[] = [];
  readonly status: Status[] = [];

  constructor(store: EventStore) {
    this.#store = store;
    this.#unsubscribe = store.subscribe((range) => this.#onAppend(range));
  }

  pairOf(idx: number): number | null {
    const v = this.pairIdx[idx];
    return v === undefined || v < 0 ? null : v;
  }

  latencyOf(idx: number): number | null {
    const v = this.latencyMs[idx];
    return v === undefined || v < 0 ? null : v;
  }

  statusOf(idx: number): Status {
    return this.status[idx] ?? "n/a";
  }

  /**
   * Advance time. Any request still pending older than `timeoutMs` becomes
   * 'unmatched'. Cheap O(pendingRequests).
   */
  flush(nowMs: number, timeoutMs = 30_000): void {
    for (const [key, idx] of this.#pendingRequests) {
      const ts = this.#store.ts[idx];
      if (ts !== undefined && nowMs - ts >= timeoutMs) {
        this.status[idx] = "unmatched";
        this.#pendingRequests.delete(key);
      }
    }
  }

  dispose(): void {
    this.#unsubscribe();
    this.#pendingRequests.clear();
    this.#pendingResponses.clear();
  }

  #onAppend(range: AppendRange): void {
    for (let i = range.from; i < range.to; i++) {
      const ev = this.#store.at(i);
      if (!ev) continue;
      // Default slot fills.
      this.pairIdx[i] = -1;
      this.latencyMs[i] = -1;
      this.status[i] = "n/a";

      if (ev.kind === "request") this.#onRequest(i, ev);
      else if (ev.kind === "response") this.#onResponse(i, ev);
      // All other kinds intentionally fall through with status 'n/a'.
    }
  }

  #onRequest(idx: number, ev: AhpEvent): void {
    const key = correlationKeyForRequest(ev);
    // If a response for this key arrived earlier, complete pairing now.
    const earlyResp = this.#pendingResponses.get(key);
    if (earlyResp !== undefined) {
      this.#pendingResponses.delete(key);
      this.#pair(idx, earlyResp);
      return;
    }
    // Otherwise park as pending. If there was already a pending request with
    // the same key (rare — same dir, same id, same session before any reply),
    // mark the displaced request orphaned before overwriting the map entry.
    const displaced = this.#pendingRequests.get(key);
    if (displaced !== undefined) {
      this.status[displaced] = "orphan";
    }
    this.#pendingRequests.set(key, idx);
    this.status[idx] = "pending";
  }

  #onResponse(idx: number, ev: AhpEvent): void {
    const key = correlationKeyForResponse(ev);
    const reqIdx = this.#pendingRequests.get(key);
    if (reqIdx !== undefined) {
      this.#pendingRequests.delete(key);
      this.#pair(reqIdx, idx);
      return;
    }
    // Out-of-order: park until the matching request shows up. If another early
    // response with the same key already exists, mark the displaced one orphaned.
    const displaced = this.#pendingResponses.get(key);
    if (displaced !== undefined) {
      this.status[displaced] = "orphan";
    }
    this.#pendingResponses.set(key, idx);
  }

  #pair(reqIdx: number, respIdx: number): void {
    const reqTs = this.#store.ts[reqIdx] ?? 0;
    const respTs = this.#store.ts[respIdx] ?? reqTs;
    const respEv = this.#store.at(respIdx);
    const isError = respEv && isErrorResponse(respEv);
    this.pairIdx[reqIdx] = respIdx;
    this.pairIdx[respIdx] = reqIdx;
    this.latencyMs[reqIdx] = respTs - reqTs;
    const s: Status = isError ? "error" : "ok";
    this.status[reqIdx] = s;
    this.status[respIdx] = s;
  }
}

function isErrorResponse(ev: AhpEvent): boolean {
  const r = ev.raw;
  return !!(r && typeof r === "object" && (r as { error?: unknown }).error !== undefined);
}
