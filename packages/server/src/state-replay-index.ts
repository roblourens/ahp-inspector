import type { EventStore, ReplayResult } from "@ahp-inspector/core";
import { replayToIndex } from "@ahp-inspector/core";
import type { AhpEvent } from "@ahp-inspector/shared";

export interface StateReplayCacheInfo {
  readonly hit: boolean;
  readonly size: number;
  readonly maxEntries: number;
}

export interface StateReplayIndexResult {
  readonly result: ReplayResult;
  readonly cache: StateReplayCacheInfo;
}

interface CachedReplay {
  readonly result: ReplayResult;
  readonly costBytes: number;
  readonly targetEvent: AhpEvent;
}

export const DEFAULT_MAX_REPLAY_CACHE_BYTES = 8 * 1024 * 1024;

export class StateReplayIndex {
  readonly #store: EventStore;
  readonly #maxEntries: number;
  readonly #maxCostBytes: number;
  readonly #cache = new Map<number, CachedReplay>();
  #cacheCostBytes = 0;
  #observedStoreSize = 0;
  #observedStoreTail: AhpEvent | undefined;

  constructor(store: EventStore, maxEntries = 25, maxCostBytes = DEFAULT_MAX_REPLAY_CACHE_BYTES) {
    this.#store = store;
    this.#maxEntries = Math.max(0, Math.floor(maxEntries));
    this.#maxCostBytes = Math.max(0, Math.floor(maxCostBytes));
    this.#recordStoreState();
  }

  reset(): void {
    this.#clearCache();
    this.#recordStoreState();
  }

  stateAtIndex(targetIndex: number): StateReplayIndexResult {
    this.#invalidateIfStorePrefixChanged();
    if (!this.#isCacheable(targetIndex)) {
      return {
        result: replayToIndex(this.#store.events, targetIndex),
        cache: this.#cacheInfo(false),
      };
    }

    const cached = this.#cache.get(targetIndex);
    if (cached && cached.targetEvent === this.#store.at(targetIndex)) {
      this.#cache.delete(targetIndex);
      this.#cache.set(targetIndex, cached);
      return { result: cached.result, cache: this.#cacheInfo(true) };
    }
    if (cached) {
      this.#deleteCached(targetIndex, cached);
    }

    const result = replayToIndex(this.#store.events, targetIndex);
    const costBytes = estimateReplayResultBytes(result, this.#maxCostBytes);
    const targetEvent = this.#store.at(targetIndex);
    if (targetEvent && this.#maxEntries > 0 && costBytes <= this.#maxCostBytes) {
      this.#cache.set(targetIndex, { result, costBytes, targetEvent });
      this.#cacheCostBytes += costBytes;
      this.#evictToBounds();
    }

    return { result, cache: this.#cacheInfo(false) };
  }

  #isCacheable(targetIndex: number): boolean {
    return Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < this.#store.size();
  }

  #invalidateIfStorePrefixChanged(): void {
    const currentSize = this.#store.size();
    const priorTailPreserved =
      this.#observedStoreSize === 0 ||
      (currentSize >= this.#observedStoreSize &&
        this.#store.at(this.#observedStoreSize - 1) === this.#observedStoreTail);
    if (!priorTailPreserved) {
      this.#clearCache();
    }
    this.#recordStoreState();
  }

  #recordStoreState(): void {
    this.#observedStoreSize = this.#store.size();
    this.#observedStoreTail =
      this.#observedStoreSize > 0 ? this.#store.at(this.#observedStoreSize - 1) : undefined;
  }

  #evictToBounds(): void {
    while (this.#cache.size > this.#maxEntries || this.#cacheCostBytes > this.#maxCostBytes) {
      const oldest = this.#cache.entries().next().value;
      if (!oldest) break;
      this.#deleteCached(oldest[0], oldest[1]);
    }
  }

  #deleteCached(targetIndex: number, cached: CachedReplay): void {
    if (this.#cache.delete(targetIndex)) {
      this.#cacheCostBytes -= cached.costBytes;
    }
  }

  #clearCache(): void {
    this.#cache.clear();
    this.#cacheCostBytes = 0;
  }

  #cacheInfo(hit: boolean): StateReplayCacheInfo {
    return {
      hit,
      size: this.#cache.size,
      maxEntries: this.#maxEntries,
    };
  }
}

/**
 * Estimates retained replay graph size without serializing or traversing past
 * the supplied bound. The estimate is intentionally conservative and stable:
 * UTF-16 strings count two bytes per code unit, references/primitives eight,
 * and containers include fixed bookkeeping overhead.
 */
export function estimateReplayResultBytes(result: ReplayResult, stopAfterBytes: number): number {
  const seen = new WeakSet<object>();
  const pending: unknown[] = [result];
  let bytes = 0;

  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || value === undefined) continue;

    if (typeof value === "string") {
      bytes += value.length * 2;
    } else if (
      typeof value === "number" ||
      typeof value === "bigint" ||
      typeof value === "boolean"
    ) {
      bytes += 8;
    } else if (typeof value === "object") {
      if (seen.has(value)) continue;
      seen.add(value);
      if (Array.isArray(value)) {
        bytes += 24 + value.length * 8;
        if (bytes > stopAfterBytes) {
          return stopAfterBytes + 1;
        }
        for (const child of value) {
          pending.push(child);
        }
      } else if (isRecord(value)) {
        bytes += 32;
        for (const key in value) {
          if (Object.hasOwn(value, key)) {
            bytes += 8 + key.length * 2;
            if (bytes > stopAfterBytes) {
              return stopAfterBytes + 1;
            }
            pending.push(value[key]);
          }
        }
      }
    } else {
      bytes += 8;
    }

    if (bytes > stopAfterBytes) {
      return stopAfterBytes + 1;
    }
  }

  return bytes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
