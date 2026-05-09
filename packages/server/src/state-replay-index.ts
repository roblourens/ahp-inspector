import type { EventStore, ReplayResult } from "@ahp-inspector/core";
import { replayToIndex } from "@ahp-inspector/core";

export interface StateReplayCacheInfo {
  readonly hit: boolean;
  readonly size: number;
  readonly maxEntries: number;
}

export interface StateReplayIndexResult {
  readonly result: ReplayResult;
  readonly cache: StateReplayCacheInfo;
}

export class StateReplayIndex {
  readonly #store: EventStore;
  readonly #maxEntries: number;
  readonly #cache = new Map<number, ReplayResult>();

  constructor(store: EventStore, maxEntries = 25) {
    this.#store = store;
    this.#maxEntries = maxEntries;
  }

  reset(): void {
    this.#cache.clear();
  }

  stateAtIndex(targetIndex: number): StateReplayIndexResult {
    if (!this.#isCacheable(targetIndex)) {
      return {
        result: replayToIndex(this.#store.events, targetIndex),
        cache: this.#cacheInfo(false),
      };
    }

    const cached = this.#cache.get(targetIndex);
    if (cached) {
      this.#cache.delete(targetIndex);
      this.#cache.set(targetIndex, cached);
      return { result: cached, cache: this.#cacheInfo(true) };
    }

    const result = replayToIndex(this.#store.events, targetIndex);
    this.#cache.set(targetIndex, result);
    while (this.#cache.size > this.#maxEntries) {
      const oldest = this.#cache.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.#cache.delete(oldest);
    }

    return { result, cache: this.#cacheInfo(false) };
  }

  #isCacheable(targetIndex: number): boolean {
    return Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < this.#store.size();
  }

  #cacheInfo(hit: boolean): StateReplayCacheInfo {
    return {
      hit,
      size: this.#cache.size,
      maxEntries: this.#maxEntries,
    };
  }
}
