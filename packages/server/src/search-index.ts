import type { AhpEvent } from "@ahp-inspector/shared";

export const DEFAULT_MAX_SEARCH_CACHE_BYTES = 64 * 1024 * 1024;
const MAX_SCAN_RESTARTS = 2;

export class SearchIndexChangedError extends Error {
  constructor() {
    super("Log changed repeatedly while search was running");
    this.name = "SearchIndexChangedError";
  }
}

/**
 * Compact per-event references for server-side substring search (SEARCH-01).
 * EventStore already retains each event graph, so the index avoids retaining a
 * second, unbounded lowercased JSON serialization of every raw payload.
 */
export class SearchIndex {
  readonly #events: AhpEvent[] = [];
  readonly #cachedText = new Map<number, string>();
  readonly #maxCachedTextBytes: number;
  #cachedTextBytes = 0;
  #generation = 0;

  constructor(maxCachedTextBytes = DEFAULT_MAX_SEARCH_CACHE_BYTES) {
    this.#maxCachedTextBytes = Math.max(0, Math.floor(maxCachedTextBytes));
  }

  get size(): number {
    return this.#events.length;
  }

  /**
   * Stable lower-bound estimate of index-owned storage, excluding event graphs
   * already owned by EventStore and JavaScript container bookkeeping.
   */
  get estimatedRetainedBytes(): number {
    return this.#events.length * 8 + this.#cachedTextBytes;
  }

  get cachedTextBytes(): number {
    return this.#cachedTextBytes;
  }

  append(ev: AhpEvent): void {
    this.#events.push(ev);
  }

  reset(): void {
    this.#generation += 1;
    this.#events.length = 0;
    this.#cachedText.clear();
    this.#cachedTextBytes = 0;
  }

  scan(q: string, limit: number): { matches: number[]; truncated: boolean } {
    return this.#scanRange(q, limit, 0, this.#events.length);
  }

  async scanAsync(
    q: string,
    limit: number,
    yieldEvery = 500,
  ): Promise<{ matches: number[]; truncated: boolean }> {
    for (let attempt = 0; attempt <= MAX_SCAN_RESTARTS; attempt++) {
      const generation = this.#generation;
      const result = await this.#scanAsyncGeneration(q, limit, yieldEvery, generation);
      if (result) return result;
    }
    throw new SearchIndexChangedError();
  }

  async #scanAsyncGeneration(
    q: string,
    limit: number,
    yieldEvery: number,
    generation: number,
  ): Promise<{ matches: number[]; truncated: boolean } | null> {
    const matches: number[] = [];
    const matchAll = q === "";
    const end = this.#events.length;
    for (let i = 0; i < end; i++) {
      const event = this.#events[i];
      if (matchAll || (event && this.#textFor(i, event).includes(q))) {
        if (matches.length < limit) {
          matches.push(i);
        } else {
          return { matches, truncated: true };
        }
      }
      if (yieldEvery > 0 && i > 0 && i % yieldEvery === 0) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (generation !== this.#generation) return null;
      }
    }
    return generation === this.#generation ? { matches, truncated: false } : null;
  }

  #scanRange(
    q: string,
    limit: number,
    start: number,
    end: number,
  ): { matches: number[]; truncated: boolean } {
    const matches: number[] = [];
    const matchAll = q === "";
    for (let i = start; i < end; i++) {
      const event = this.#events[i];
      if (matchAll || (event && this.#textFor(i, event).includes(q))) {
        if (matches.length < limit) {
          matches.push(i);
        } else {
          return { matches, truncated: true };
        }
      }
    }
    return { matches, truncated: false };
  }

  #textFor(index: number, event: AhpEvent): string {
    const cached = this.#cachedText.get(index);
    if (cached !== undefined) return cached;

    const text = searchableText(event);
    const costBytes = text.length * 2;
    if (costBytes <= this.#maxCachedTextBytes - this.#cachedTextBytes) {
      this.#cachedText.set(index, text);
      this.#cachedTextBytes += costBytes;
    }
    return text;
  }
}

function searchableText(event: AhpEvent): string {
  const id = event.id !== null ? String(event.id) : null;
  let raw = "";
  try {
    raw = JSON.stringify(event.raw) ?? "";
  } catch {
    // Parsed JSON cannot be cyclic, but preserve the prior behavior for
    // programmatically constructed events.
  }
  return [event.method, event.actionType, event.sessionId, event.turnId, id, raw]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
