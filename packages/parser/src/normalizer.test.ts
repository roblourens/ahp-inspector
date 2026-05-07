import type { Direction, NormalizeMeta } from "@ahp-viewer/shared";
import { describe, expect, it } from "vitest";
import { normalize } from "./normalizer.js";

function meta(seq = 0, dir: Direction = "c2s"): NormalizeMeta {
  return { seq, dir, ts: 0, tsRaw: "", byteOffset: 0, byteLength: 0 };
}

describe("normalize (EVENT-02 classification)", () => {
  it("c2s request → kind:'request', method/id preserved", () => {
    const ev = normalize(
      { jsonrpc: "2.0", id: 1, method: "listSessions", params: {} },
      meta(0, "c2s"),
    );
    expect(ev.kind).toBe("request");
    expect(ev.method).toBe("listSessions");
    expect(ev.id).toBe(1);
    expect(ev.idType).toBe("number");
    expect(ev.parse).toBe("ok");
  });

  it("s2c success response → kind:'response', method:null", () => {
    const ev = normalize({ jsonrpc: "2.0", id: 1, result: {} }, meta(1, "s2c"));
    expect(ev.kind).toBe("response");
    expect(ev.method).toBeNull();
    expect(ev.id).toBe(1);
  });

  it("s2c error response → kind:'response', parse:'ok'", () => {
    const ev = normalize(
      { jsonrpc: "2.0", id: 2, error: { code: -32000, message: "boom" } },
      meta(2, "s2c"),
    );
    expect(ev.kind).toBe("response");
    expect(ev.parse).toBe("ok");
  });

  it("c2s notification (no id) → kind:'client-notification'", () => {
    const ev = normalize({ jsonrpc: "2.0", method: "dispatch", params: {} }, meta(3, "c2s"));
    expect(ev.kind).toBe("client-notification");
    expect(ev.method).toBe("dispatch");
  });

  it("s2c arbitrary notification → kind:'server-notification'", () => {
    const ev = normalize({ jsonrpc: "2.0", method: "foo", params: {} }, meta(4, "s2c"));
    expect(ev.kind).toBe("server-notification");
  });

  it("s2c method:'action' → kind:'action' with actionType + serverSeq lifted", () => {
    const ev = normalize(
      {
        jsonrpc: "2.0",
        method: "action",
        params: { action: { type: "X" }, serverSeq: 7, origin: "server" },
      },
      meta(5, "s2c"),
    );
    expect(ev.kind).toBe("action");
    expect(ev.actionType).toBe("X");
    expect(ev.serverSeq).toBe(7);
  });

  it("s2c method:'notification' → kind:'protocol-notification' with notification.type lifted", () => {
    const ev = normalize(
      {
        jsonrpc: "2.0",
        method: "notification",
        params: { notification: { type: "Y" } },
      },
      meta(6, "s2c"),
    );
    expect(ev.kind).toBe("protocol-notification");
    expect(ev.actionType).toBe("Y");
  });

  it("string id preserves idType:'string'", () => {
    const ev = normalize(
      { jsonrpc: "2.0", id: "abc", method: "authenticate", params: {} },
      meta(7, "c2s"),
    );
    expect(ev.id).toBe("abc");
    expect(ev.idType).toBe("string");
  });

  it("null id preserves idType:'null'", () => {
    const ev = normalize({ jsonrpc: "2.0", id: null, method: "ping", params: {} }, meta(8, "c2s"));
    expect(ev.id).toBeNull();
    expect(ev.idType).toBe("null");
  });

  it("boolean id is coerced to null without throwing (Pitfall 1)", () => {
    const ev = normalize({ jsonrpc: "2.0", id: true, method: "wat", params: {} }, meta(9, "c2s"));
    expect(ev.id).toBeNull();
    expect(ev.idType).toBe("null");
    expect(ev.parse).toBe("ok");
  });

  it("non-object payload (raw === 42) → kind:'parse-error', never throws", () => {
    const ev = normalize(42 as unknown, meta(10, "c2s"));
    expect(ev.kind).toBe("parse-error");
    expect(ev.parseError?.reason).toBe("non-object payload");
  });

  it("unrecognised JSON-RPC shape (no method, no id+result) → kind:'parse-error'", () => {
    const ev = normalize({ jsonrpc: "2.0", foo: "bar" }, meta(11, "c2s"));
    expect(ev.kind).toBe("parse-error");
    expect(ev.parseError?.reason).toBeTruthy();
  });

  it("seq, byteOffset, byteLength propagate verbatim from meta", () => {
    const ev = normalize(
      { jsonrpc: "2.0", id: 1, method: "x", params: {} },
      { seq: 99, dir: "c2s", ts: 0, tsRaw: "", byteOffset: 1234, byteLength: 56 },
    );
    expect(ev.seq).toBe(99);
    expect(ev.byteOffset).toBe(1234);
    expect(ev.byteLength).toBe(56);
  });

  it("extracts session/turn/toolCall ids defensively from common shapes", () => {
    const ev = normalize(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "fetchTurns",
        params: {
          session: "copilot:/abc",
          turnId: "t-1",
          toolCallId: "tc-1",
        },
      },
      meta(0, "c2s"),
    );
    expect(ev.sessionId).toBe("copilot:/abc");
    expect(ev.turnId).toBe("t-1");
    expect(ev.toolCallId).toBe("tc-1");
  });

  it("session as { uri } object is unwrapped", () => {
    const ev = normalize(
      { jsonrpc: "2.0", id: 1, method: "x", params: { session: { uri: "u://1" } } },
      meta(0, "c2s"),
    );
    expect(ev.sessionId).toBe("u://1");
  });
});
