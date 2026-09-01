/**
 * http-client.ts — browser-only transport for the detail API (Plan 03-04).
 *
 * MUST NOT import node:, fs, path, hono, or @ahp-inspector/server.
 * boundary.test.ts enforces this at CI time.
 *
 * Security:
 *   T-03-04-04: AbortController per idx — previous controller aborted on
 *   new selectedIdx change in DetailPanel's useEffect cleanup.
 */

import type { Status } from "@ahp-inspector/core";
import type { AhpEvent } from "@ahp-inspector/shared";
import { apiUrl } from "./api-base.js";

export type { AhpEvent };

export interface DetailResponse {
  event: AhpEvent;
  pair: AhpEvent | null;
  latencyMs: number | null;
  status: Status;
  pairIdx: number | null;
}

// Simple LRU-16 cache keyed by active log + event idx.
const MAX_CACHE = 16;
type EventCacheKey = string;
const cache = new Map<EventCacheKey, DetailResponse>();
const cacheOrder: EventCacheKey[] = [];

function cacheKey(logKey: string | null | undefined, idx: number): EventCacheKey {
  return JSON.stringify([logKey ?? null, idx]);
}

function cacheGet(key: EventCacheKey): DetailResponse | undefined {
  const cached = cache.get(key);
  if (cached !== undefined) {
    const existing = cacheOrder.indexOf(key);
    if (existing !== -1) {
      cacheOrder.splice(existing, 1);
      cacheOrder.push(key);
    }
  }
  return cached;
}

function cacheSet(key: EventCacheKey, data: DetailResponse): void {
  if (cache.has(key)) {
    cacheOrder.splice(cacheOrder.indexOf(key), 1);
    cacheOrder.push(key);
    cache.set(key, data);
    return;
  }
  if (cacheOrder.length >= MAX_CACHE) {
    const evict = cacheOrder.shift();
    if (evict !== undefined) cache.delete(evict);
  }
  cacheOrder.push(key);
  cache.set(key, data);
}

/**
 * Fetch event details from GET /api/log/event/:idx.
 * Returns null on 404, throws on other HTTP errors.
 * Caches last 16 responses by active log key + idx.
 */
export async function fetchEvent(
  idx: number,
  signal?: AbortSignal,
  logKey?: string | null,
): Promise<DetailResponse | null> {
  const key = cacheKey(logKey, idx);
  const cached = cacheGet(key);
  if (cached) return cached;
  const init: RequestInit = signal !== undefined ? { signal } : {};
  const resp = await fetch(apiUrl(`/api/log/event/${idx}`), init);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Failed to load event: ${resp.status}`);
  const data: DetailResponse = (await resp.json()) as DetailResponse;
  cacheSet(key, data);
  return data;
}

export function clearEventCacheForTests(): void {
  cache.clear();
  cacheOrder.length = 0;
}
