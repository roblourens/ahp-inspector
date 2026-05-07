import type { AhpEvent } from "@ahp-viewer/shared";

/**
 * Per-event lowercased haystack for server-side substring search (SEARCH-01).
 * Grows in lock-step with EventStore — index[i] is the haystack for event i.
 * Pattern from 03-RESEARCH §Pattern 2.
 */
export class SearchIndex {
  readonly #haystack: string[] = [];

  get size(): number {
    return this.#haystack.length;
  }

  append(ev: AhpEvent): void {
    const idStr = ev.id !== null ? String(ev.id) : null;
    let rawStr = "";
    try {
      rawStr = JSON.stringify(ev.raw) ?? "";
    } catch {
      rawStr = "";
    }
    const entry = [ev.method, ev.actionType, ev.sessionId, ev.turnId, idStr, rawStr]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    this.#haystack.push(entry);
  }

  scan(q: string, limit: number): { matches: number[]; truncated: boolean } {
    const matches: number[] = [];
    const matchAll = q === "";
    let truncated = false;
    for (let i = 0; i < this.#haystack.length; i++) {
      if (matchAll || (this.#haystack[i] ?? "").includes(q)) {
        if (matches.length < limit) {
          matches.push(i);
        } else {
          truncated = true;
          break;
        }
      }
    }
    return { matches, truncated };
  }
}
