/**
 * http-client.ts — browser-only transport for the detail API (Plan 03-04).
 *
 * MUST NOT import node:, fs, path, hono, or @ahp-viewer/server.
 * boundary.test.ts enforces this at CI time.
 *
 * Security:
 *   T-03-04-04: AbortController per idx — previous controller aborted on
 *   new selectedIdx change in DetailPanel's useEffect cleanup.
 */
import type { AhpEvent } from "@ahp-viewer/shared";
import type { Status } from "@ahp-viewer/core";

export type { AhpEvent };

export interface DetailResponse {
  event: AhpEvent;
  pair: AhpEvent | null;
  latencyMs: number | null;
  status: Status;
  pairIdx: number | null;
}

// Simple LRU-16 cache keyed by event idx.
const MAX_CACHE = 16;
const cache = new Map<number, DetailResponse>();
const cacheOrder: number[] = [];

function cacheGet(idx: number): DetailResponse | undefined {
  return cache.get(idx);
}

function cacheSet(idx: number, data: DetailResponse): void {
  if (cache.has(idx)) {
    cacheOrder.splice(cacheOrder.indexOf(idx), 1);
    cacheOrder.push(idx);
    cache.set(idx, data);
    return;
  }
  if (cacheOrder.length >= MAX_CACHE) {
    const evict = cacheOrder.shift()!;
    cache.delete(evict);
  }
  cacheOrder.push(idx);
  cache.set(idx, data);
}

/**
 * Fetch event details from GET /api/log/event/:idx.
 * Returns null on 404, throws on other HTTP errors.
 * Caches last 16 responses by idx.
 */
export async function fetchEvent(
  idx: number,
  signal?: AbortSignal,
): Promise<DetailResponse | null> {
  const cached = cacheGet(idx);
  if (cached) return cached;
  const init: RequestInit = signal !== undefined ? { signal } : {};
  const resp = await fetch(`/api/log/event/${idx}`, init);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Failed to load event: ${resp.status}`);
  const data: DetailResponse = await resp.json() as DetailResponse;
  cacheSet(idx, data);
  return data;
}
