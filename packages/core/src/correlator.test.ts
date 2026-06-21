import type { AhpEvent } from "@ahp-inspector/shared";
import { describe, expect, it } from "vitest";
import { Correlator, MAX_PENDING } from "./correlator.js";
import { EventStore } from "./event-store.js";

function ev(partial: Partial<AhpEvent> & Pick<AhpEvent, "kind" | "dir" | "seq">): AhpEvent {
  return {
    seq: partial.seq,
    ts: partial.ts ?? 0,
    tsRaw: partial.tsRaw ?? "",
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
    byteOffset: partial.byteOffset ?? 0,
    byteLength: partial.byteLength ?? 0,
    raw: partial.raw,
    parse: partial.parse ?? "ok",
  } as AhpEvent;
}

function req(seq: number, ts: number, opts: Partial<AhpEvent> = {}): AhpEvent {
  return ev({
    seq,
    ts,
    dir: "c2s",
    kind: "request",
    method: "m",
    id: 1,
    idType: "number",
    ...opts,
  });
}

function res(seq: number, ts: number, opts: Partial<AhpEvent> = {}): AhpEvent {
  return ev({
    seq,
    ts,
    dir: "s2c",
    kind: "response",
    id: 1,
    idType: "number",
    raw: { jsonrpc: "2.0", id: 1, result: {} },
    ...opts,
  });
}

describe("Correlator", () => {
  it("pairs c2s request with s2c response (success → status ok)", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const r = s.append(req(0, 100));
    const p = s.append(res(1, 130));
    expect(c.pairOf(r)).toBe(p);
    expect(c.pairOf(p)).toBe(r);
    expect(c.latencyOf(r)).toBe(30);
    expect(c.statusOf(r)).toBe("ok");
  });

  it("response with error → status error", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const r = s.append(req(0, 100));
    s.append(res(1, 110, { raw: { jsonrpc: "2.0", id: 1, error: { code: -1, message: "x" } } }));
    expect(c.statusOf(r)).toBe("error");
  });

  it("does NOT pair two same-direction requests with same id", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const r1 = s.append(req(0, 100, { method: "a" }));
    const r2 = s.append(req(1, 110, { method: "b" }));
    expect(c.pairOf(r1)).toBeNull();
    expect(c.pairOf(r2)).toBeNull();
    // r1 is displaced by r2 and must be marked orphan (WR-01 fix).
    expect(c.statusOf(r1)).toBe("orphan");
    expect(c.statusOf(r2)).toBe("pending");
  });

  it("does NOT pair when idType differs (1 vs '1') (Pitfall 2)", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const r = s.append(req(0, 100));
    const p = s.append(res(1, 110, { id: "1", idType: "string", raw: { id: "1", result: {} } }));
    expect(c.pairOf(r)).toBeNull();
    expect(c.pairOf(p)).toBeNull();
  });

  it("handles out-of-order: response before request", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const p = s.append(res(0, 200, { id: 5, raw: { id: 5, result: {} } }));
    const r = s.append(req(1, 150, { id: 5, method: "x" }));
    expect(c.pairOf(p)).toBe(r);
    expect(c.pairOf(r)).toBe(p);
    // latency uses ts difference (response.ts - request.ts), still 50
    expect(c.latencyOf(r)).toBe(50);
    expect(c.statusOf(r)).toBe("ok");
  });

  it("drains changed indexes for a late response once", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const r = s.append(req(0, 100));
    c.drainChangedIndexes();

    const p = s.append(res(1, 130));

    expect(c.drainChangedIndexes()).toEqual([r, p]);
    expect(c.drainChangedIndexes()).toEqual([]);
  });

  it("drains displaced request changes without duplicating indexes", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const displaced = s.append(req(0, 100));
    c.drainChangedIndexes();

    const replacement = s.append(req(1, 110, { method: "replacement" }));
    const changed = c.drainChangedIndexes();

    expect(changed).toEqual([displaced, replacement]);
    expect(changed.filter((idx) => idx === displaced)).toHaveLength(1);
    expect(c.drainChangedIndexes()).toEqual([]);
  });

  it("notifications/actions/protocol-notifications/parse-errors NEVER touch correlation map", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const i1 = s.append(
      ev({ seq: 0, ts: 1, dir: "c2s", kind: "client-notification", method: "n" }),
    );
    const i2 = s.append(
      ev({ seq: 1, ts: 2, dir: "s2c", kind: "server-notification", method: "n" }),
    );
    const i3 = s.append(ev({ seq: 2, ts: 3, dir: "s2c", kind: "action", method: "action" }));
    const i4 = s.append(
      ev({ seq: 3, ts: 4, dir: "s2c", kind: "protocol-notification", method: "notification" }),
    );
    const i5 = s.append(ev({ seq: 4, ts: 5, dir: "c2s", kind: "parse-error", parse: "error" }));
    for (const i of [i1, i2, i3, i4, i5]) {
      expect(c.pairOf(i)).toBeNull();
      expect(c.latencyOf(i)).toBeNull();
      expect(c.statusOf(i)).toBe("n/a");
    }
  });

  it("flush past timeout marks lone request as 'unmatched'", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const r = s.append(req(0, 1000));
    expect(c.statusOf(r)).toBe("pending");
    c.flush(1000 + 31_000);
    expect(c.statusOf(r)).toBe("unmatched");
  });

  it("flush drains only changed timeout indexes and does not repeat them", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const expired = s.append(req(0, 1000));
    s.append(req(1, 31_500, { id: 2 }));
    c.drainChangedIndexes();

    c.flush(32_000);

    expect(c.drainChangedIndexes()).toEqual([expired]);
    c.flush(32_000);
    expect(c.drainChangedIndexes()).toEqual([]);
  });

  it("reset clears pending changed indexes", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    s.append(req(0, 100));

    c.reset();

    expect(c.drainChangedIndexes()).toEqual([]);
  });

  it("dispose unsubscribes from store", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const r = s.append(req(0, 100));
    c.dispose();
    s.append(res(1, 110));
    // Pair should NOT have been recorded (correlator stopped listening before response).
    expect(c.pairOf(r)).toBeNull();
  });

  it("bounds the pending-request map under a flood of unmatched requests", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const flood = MAX_PENDING + 50;
    for (let i = 0; i < flood; i++) {
      // Unique id ⇒ unique correlation key, and no response ever arrives.
      s.append(req(i, i, { id: i }));
    }
    expect(c.pendingRequestCount).toBeLessThanOrEqual(MAX_PENDING);
    // The earliest unmatched request was evicted and marked unmatched.
    expect(c.statusOf(0)).toBe("unmatched");
  });

  it("bounds the pending-response map under a flood of orphan responses", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const flood = MAX_PENDING + 50;
    for (let i = 0; i < flood; i++) {
      // Out-of-order responses whose requests never arrive.
      s.append(res(i, i, { id: i, raw: { jsonrpc: "2.0", id: i, result: {} } }));
    }
    expect(c.pendingResponseCount).toBeLessThanOrEqual(MAX_PENDING);
  });
});
