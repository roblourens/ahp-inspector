import type { AhpEvent } from "@ahp-inspector/shared";
import { describe, expect, it, vi } from "vitest";
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
    ...(partial.parseError ? { parseError: partial.parseError } : {}),
  } as AhpEvent;
}

describe("EventStore", () => {
  it("starts empty", () => {
    const s = new EventStore();
    expect(s.size()).toBe(0);
  });

  it("append returns indices 0,1,2 and pushes to columns", () => {
    const s = new EventStore();
    const a = s.append(
      ev({ seq: 0, dir: "c2s", kind: "request", id: 1, idType: "number", method: "ls" }),
    );
    const b = s.append(ev({ seq: 1, dir: "s2c", kind: "response", id: 1, idType: "number" }));
    expect(a).toBe(0);
    expect(b).toBe(1);
    expect(s.size()).toBe(2);
    expect(s.kind[0]).toBe("request");
    expect(s.kind[1]).toBe("response");
    expect(s.dir[0]).toBe("c2s");
    expect(s.method[0]).toBe("ls");
    expect(s.id[0]).toBe(1);
    expect(s.idType[1]).toBe("number");
  });

  it("at(idx) returns the original event reference", () => {
    const s = new EventStore();
    const e = ev({ seq: 0, dir: "c2s", kind: "request", id: 1, idType: "number", method: "ls" });
    s.append(e);
    expect(s.at(0)).toBe(e);
  });

  it("subscribe is invoked with {from,to} after each append; unsubscribe stops it", () => {
    const s = new EventStore();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.append(ev({ seq: 0, dir: "c2s", kind: "request" }));
    s.append(ev({ seq: 1, dir: "c2s", kind: "request" }));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, { from: 0, to: 1 });
    expect(fn).toHaveBeenNthCalledWith(2, { from: 1, to: 2 });
    off();
    s.append(ev({ seq: 2, dir: "c2s", kind: "request" }));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("side indices byKind/byDir/byMethod stay in sync", () => {
    const s = new EventStore();
    s.append(ev({ seq: 0, dir: "c2s", kind: "request", method: "a" }));
    s.append(ev({ seq: 1, dir: "s2c", kind: "response", method: null }));
    s.append(ev({ seq: 2, dir: "c2s", kind: "request", method: "a" }));
    expect(s.byKind.get("request")).toEqual([0, 2]);
    expect(s.byKind.get("response")).toEqual([1]);
    expect(s.byDir.get("c2s")).toEqual([0, 2]);
    expect(s.byDir.get("s2c")).toEqual([1]);
    expect(s.byMethod.get("a")).toEqual([0, 2]);
  });

  it("subscriber that throws does not break append (T-03-04)", () => {
    const s = new EventStore();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    s.subscribe(() => {
      throw new Error("boom");
    });
    expect(() => s.append(ev({ seq: 0, dir: "c2s", kind: "request" }))).not.toThrow();
    expect(s.size()).toBe(1);
    warn.mockRestore();
  });
});
