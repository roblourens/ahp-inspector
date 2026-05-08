// EventStore — append-only columnar storage for AhpEvents.
// 01-RESEARCH.md Pattern 5 (lines 321-358).
//
// One column per AhpEvent field used by hot scans (id/method/kind/dir/...),
// plus an `events` array preserving the full envelope for round-trip via at().
// Subscribers are notified after each append with a (from,to) range.
//
// Phase 1 keeps subscribe() synchronous (no rAF coalescing — that's Phase 2).
// A throwing subscriber MUST NOT block ingest (T-03-04): we wrap dispatch in
// try/catch and one-shot warn via console.warn.

import type { AhpEvent, Direction, EventKind, IdType } from "@ahp-viewer/shared";

export interface AppendRange {
  /** Inclusive start index. */
  readonly from: number;
  /** Exclusive end index. */
  readonly to: number;
}

export type AppendListener = (range: AppendRange) => void;

export class EventStore {
  // Parallel columns. All arrays grow together with each append().
  readonly seq: number[] = [];
  readonly ts: number[] = [];
  readonly tsRaw: string[] = [];
  readonly kind: EventKind[] = [];
  readonly dir: Direction[] = [];
  readonly method: (string | null)[] = [];
  readonly id: (number | string | null)[] = [];
  readonly idType: IdType[] = [];
  readonly sessionId: (string | null)[] = [];
  readonly actionType: (string | null)[] = [];
  readonly serverSeq: (number | null)[] = [];
  readonly byteOffset: number[] = [];
  readonly byteLength: number[] = [];

  /** Round-trip storage: index → original event reference. */
  readonly events: AhpEvent[] = [];

  // Side indices.
  readonly byKind = new Map<EventKind, number[]>();
  readonly byDir = new Map<Direction, number[]>();
  readonly byMethod = new Map<string, number[]>();

  readonly #subs = new Set<AppendListener>();

  size(): number {
    return this.events.length;
  }

  at(idx: number): AhpEvent | undefined {
    return this.events[idx];
  }

  /**
   * Clear all stored events and derived indices without notifying append
   * subscribers. Used when a tailed log rotates: subscribers receive the
   * explicit rotation frame, and subsequent appends must start from idx 0.
   */
  reset(): void {
    this.seq.length = 0;
    this.ts.length = 0;
    this.tsRaw.length = 0;
    this.kind.length = 0;
    this.dir.length = 0;
    this.method.length = 0;
    this.id.length = 0;
    this.idType.length = 0;
    this.sessionId.length = 0;
    this.actionType.length = 0;
    this.serverSeq.length = 0;
    this.byteOffset.length = 0;
    this.byteLength.length = 0;
    this.events.length = 0;
    this.byKind.clear();
    this.byDir.clear();
    this.byMethod.clear();
  }

  append(ev: AhpEvent): number {
    const idx = this.events.length;
    this.events.push(ev);
    this.seq.push(ev.seq);
    this.ts.push(ev.ts);
    this.tsRaw.push(ev.tsRaw);
    this.kind.push(ev.kind);
    this.dir.push(ev.dir);
    this.method.push(ev.method);
    this.id.push(ev.id);
    this.idType.push(ev.idType);
    this.sessionId.push(ev.sessionId);
    this.actionType.push(ev.actionType);
    this.serverSeq.push(ev.serverSeq);
    this.byteOffset.push(ev.byteOffset);
    this.byteLength.push(ev.byteLength);

    pushIndex(this.byKind, ev.kind, idx);
    pushIndex(this.byDir, ev.dir, idx);
    if (ev.method !== null) pushIndex(this.byMethod, ev.method, idx);

    const range: AppendRange = { from: idx, to: idx + 1 };
    for (const fn of this.#subs) {
      try {
        fn(range);
      } catch (err) {
        // T-03-04: a misbehaving subscriber must not block ingest.
        console.warn("[EventStore] subscriber threw", (err as Error)?.message ?? err);
      }
    }
    return idx;
  }

  subscribe(fn: AppendListener): () => void {
    this.#subs.add(fn);
    return () => {
      this.#subs.delete(fn);
    };
  }
}

function pushIndex<K>(map: Map<K, number[]>, key: K, idx: number): void {
  const list = map.get(key);
  if (list) list.push(idx);
  else map.set(key, [idx]);
}
