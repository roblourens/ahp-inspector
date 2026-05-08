import { EventStore } from "@ahp-viewer/core";
import type { AhpEvent } from "@ahp-viewer/shared";
import { describe, expect, it } from "vitest";
import { StateReplayIndex } from "./state-replay-index.js";

function ev(partial: Partial<AhpEvent> & Pick<AhpEvent, "kind" | "dir" | "seq">): AhpEvent {
  return {
    seq: partial.seq,
    ts: partial.ts ?? partial.seq * 1000,
    tsRaw: partial.tsRaw ?? String(partial.ts ?? partial.seq * 1000),
    dir: partial.dir,
    kind: partial.kind,
    method: partial.method ?? null,
    actionType: partial.actionType ?? null,
    id: partial.id ?? null,
    idType: partial.idType ?? "null",
    sessionId: partial.sessionId ?? null,
    turnId: partial.turnId ?? null,
    toolCallId: partial.toolCallId ?? null,
    serverSeq: partial.serverSeq ?? null,
    byteOffset: partial.byteOffset ?? partial.seq,
    byteLength: partial.byteLength ?? 1,
    raw: partial.raw ?? {},
    parse: partial.parse ?? "ok",
    ...(partial.parseError !== undefined ? { parseError: partial.parseError } : {}),
  };
}

function request(seq: number, id = seq + 1): AhpEvent {
  return ev({
    seq,
    dir: "c2s",
    kind: "request",
    method: "initialize",
    id,
    idType: "number",
    raw: { jsonrpc: "2.0", id, method: "initialize", params: {} },
  });
}

function response(seq: number, id = seq): AhpEvent {
  return ev({
    seq,
    dir: "s2c",
    kind: "response",
    id,
    idType: "number",
    raw: {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "0.1.0",
        serverSeq: 0,
        snapshots: [{ resource: "agenthost:/root", fromSeq: 0, state: { agents: [] } }],
      },
    },
  });
}

function storeWith(count: number): EventStore {
  const store = new EventStore();
  for (let i = 0; i < count; i++) {
    store.append(i % 2 === 0 ? request(i, i + 1) : response(i, i));
  }
  return store;
}

describe("StateReplayIndex", () => {
  it("returns cache miss then hit for the same exact target index", () => {
    const store = storeWith(2);
    const index = new StateReplayIndex(store);

    const first = index.stateAtIndex(1);
    const second = index.stateAtIndex(1);

    expect(first.cache).toEqual({ hit: false, size: 1, maxEntries: 25 });
    expect(second.cache).toEqual({ hit: true, size: 1, maxEntries: 25 });
    expect(second.result).toEqual(first.result);
  });

  it("evicts least-recently-used exact indexes when maxEntries is exceeded", () => {
    const store = storeWith(4);
    const index = new StateReplayIndex(store, 2);

    expect(index.stateAtIndex(0).cache.hit).toBe(false);
    expect(index.stateAtIndex(1).cache.hit).toBe(false);
    expect(index.stateAtIndex(2).cache).toEqual({ hit: false, size: 2, maxEntries: 2 });
    expect(index.stateAtIndex(0).cache).toEqual({ hit: false, size: 2, maxEntries: 2 });
  });

  it("keeps cached historical indexes stable across append", () => {
    const store = storeWith(2);
    const index = new StateReplayIndex(store);

    const beforeAppend = index.stateAtIndex(1);
    store.append(request(2, 3));
    const afterAppend = index.stateAtIndex(1);

    expect(beforeAppend.cache.hit).toBe(false);
    expect(afterAppend.cache.hit).toBe(true);
    expect(afterAppend.result).toEqual(beforeAppend.result);
  });

  it("clears cached results on reset", () => {
    const store = storeWith(2);
    const index = new StateReplayIndex(store);

    expect(index.stateAtIndex(1).cache.hit).toBe(false);
    expect(index.stateAtIndex(1).cache.hit).toBe(true);
    index.reset();

    expect(index.stateAtIndex(1).cache).toEqual({ hit: false, size: 1, maxEntries: 25 });
  });

  it("does not cache invalid or out-of-range indexes", () => {
    const store = storeWith(2);
    const index = new StateReplayIndex(store);

    expect(index.stateAtIndex(-1).cache).toEqual({ hit: false, size: 0, maxEntries: 25 });
    expect(index.stateAtIndex(2).cache).toEqual({ hit: false, size: 0, maxEntries: 25 });
    expect(index.stateAtIndex(1.5).cache).toEqual({ hit: false, size: 0, maxEntries: 25 });
    expect(index.stateAtIndex(1).cache).toEqual({ hit: false, size: 1, maxEntries: 25 });
  });
});
