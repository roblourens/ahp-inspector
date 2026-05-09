import type { AhpEvent } from "@ahp-inspector/shared";
import { describe, expect, it } from "vitest";
import { Correlator } from "./correlator.js";
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

  it("dispose unsubscribes from store", () => {
    const s = new EventStore();
    const c = new Correlator(s);
    const r = s.append(req(0, 100));
    c.dispose();
    s.append(res(1, 110));
    // Pair should NOT have been recorded (correlator stopped listening before response).
    expect(c.pairOf(r)).toBeNull();
  });
});
