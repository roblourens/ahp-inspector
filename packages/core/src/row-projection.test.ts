import type { AhpEvent, Direction, EventKind } from "@ahp-viewer/shared";
import { describe, expect, it } from "vitest";
import {
  actionFamilyFor,
  bandFor,
  dirGlyphFor,
  formatSessionShort,
  formatTs,
  kindTagFor,
  payloadPreviewOf,
  projectRow,
} from "./row-projection.js";

function mkEvent(over: Partial<AhpEvent> = {}): AhpEvent {
  const base: AhpEvent = {
    seq: 0,
    ts: Date.UTC(2026, 4, 7, 12, 34, 56, 789),
    tsRaw: "2026-05-07T12:34:56.789Z",
    dir: "c2s" as Direction,
    kind: "request" as EventKind,
    method: "initialize",
    actionType: null,
    id: 1,
    idType: "number",
    sessionId: null,
    turnId: null,
    toolCallId: null,
    serverSeq: null,
    byteOffset: 0,
    byteLength: 0,
    raw: { jsonrpc: "2.0", id: 1, method: "initialize", params: { v: 1 } },
    parse: "ok",
  };
  return { ...base, ...over };
}

describe("bandFor()", () => {
  it.each([
    [null, null],
    [-1, null],
    [0, "fast"],
    [49, "fast"],
    [50, "normal"],
    [199, "normal"],
    [200, "slow"],
    [999, "slow"],
    [1000, "critical"],
    [5000, "critical"],
  ] as const)("bandFor(%s) === %s", (lat, expected) => {
    expect(bandFor(lat)).toBe(expected);
  });
});

describe("dirGlyphFor()", () => {
  it("c2s → '→'", () => expect(dirGlyphFor("c2s")).toBe("→"));
  it("s2c → '←'", () => expect(dirGlyphFor("s2c")).toBe("←"));
});

describe("kindTagFor()", () => {
  it.each([
    ["request", "REQ"],
    ["response", "RES"],
    ["client-notification", "NTF"],
    ["server-notification", "NTF"],
    ["protocol-notification", "NTF"],
    ["action", "ACT"],
    ["parse-error", "BAD"],
    ["log", "LOG"],
  ] as const)("kindTagFor(%s) === %s", (k, t) => {
    expect(kindTagFor(k)).toBe(t);
  });
});

describe("actionFamilyFor()", () => {
  it("returns null for non-action kinds", () => {
    expect(actionFamilyFor("request", "tool.call")).toBeNull();
    expect(actionFamilyFor("response", null)).toBeNull();
  });
  it("classifies action types", () => {
    expect(actionFamilyFor("action", null)).toBe("unknown");
    expect(actionFamilyFor("action", "text")).toBe("text");
    expect(actionFamilyFor("action", "TEXT")).toBe("text");
    expect(actionFamilyFor("action", "toolCall")).toBe("tool-call");
    expect(actionFamilyFor("action", "tool_call")).toBe("tool-call");
    expect(actionFamilyFor("action", "tool-call.start")).toBe("tool-call");
    expect(actionFamilyFor("action", "toolResult")).toBe("tool-result");
    expect(actionFamilyFor("action", "tool.result")).toBe("tool-result");
    expect(actionFamilyFor("action", "statusUpdate")).toBe("status");
    expect(actionFamilyFor("action", "weird")).toBe("unknown");
  });
});

describe("formatTs()", () => {
  it("formats UTC HH:mm:ss.SSS with zero padding", () => {
    expect(formatTs(Date.UTC(2026, 0, 1, 1, 2, 3, 4))).toBe("01:02:03.004");
  });
  it("handles end-of-day", () => {
    expect(formatTs(Date.UTC(2026, 0, 1, 23, 59, 59, 999))).toBe("23:59:59.999");
  });
});

describe("formatSessionShort()", () => {
  it("uses the semantic session slug instead of the trailing date", () => {
    expect(formatSessionShort("copilot:/session/frontend-polish-2026-05-07")).toBe(
      "frontend-polish",
    );
  });

  it("keeps compact session suffixes readable", () => {
    expect(formatSessionShort("session-abc12345")).toBe("abc12345");
  });

  it("uses stable compact labels for uuid-like ids", () => {
    expect(formatSessionShort("aaaaaaaa-1111-2222-3333-444444444444")).toBe("aaaaaaaa");
    expect(formatSessionShort("ahp://session/0123456789abcdef")).toBe("89abcdef");
  });
});

describe("payloadPreviewOf()", () => {
  it("prefers params over result", () => {
    expect(payloadPreviewOf({ params: { a: 1 }, result: { b: 2 } })).toBe('{"a":1}');
  });
  it("falls back to result when params missing", () => {
    expect(payloadPreviewOf({ result: { ok: true } })).toBe('{"ok":true}');
  });
  it("collapses whitespace", () => {
    // JSON.stringify with no indent has no whitespace itself, but embedded
    // multi-space characters inside string values must collapse to single
    // spaces per the EventRow projection contract.
    expect(payloadPreviewOf({ params: { a: "x   y" } })).toBe('{"a":"x y"}');
  });
  it("truncates at 120 chars without ellipsis", () => {
    const big = { params: { s: "x".repeat(500) } };
    const out = payloadPreviewOf(big);
    expect(out.length).toBe(120);
    expect(out.endsWith("…")).toBe(false);
  });
  it("returns empty string for null/undefined", () => {
    expect(payloadPreviewOf(null)).toBe("");
    expect(payloadPreviewOf(undefined)).toBe("");
  });
});

describe("projectRow() — request paired (latency bands)", () => {
  it("fast band for latency=42", () => {
    const e = mkEvent({ seq: 1 });
    const row = projectRow(e, 1, "ok", 42);
    expect(row.kind).toBe("request");
    expect(row.kindTag).toBe("REQ");
    expect(row.dirGlyph).toBe("→");
    expect(row.method).toBe("initialize");
    expect(row.status).toBe("ok");
    expect(row.latencyMs).toBe(42);
    expect(row.latencyBand).toBe("fast");
    expect(row.payloadPreview).toBe('{"v":1}');
    expect(row.parseErrorReason).toBeNull();
    expect(row.lineIndex).toBeNull();
  });
  it("slow band for latency=750", () => {
    const row = projectRow(mkEvent(), 0, "ok", 750);
    expect(row.latencyBand).toBe("slow");
  });
  it("critical band for latency=2500", () => {
    const row = projectRow(mkEvent(), 0, "ok", 2500);
    expect(row.latencyBand).toBe("critical");
  });
});

describe("projectRow() — unmatched / orphan / pending", () => {
  it("unmatched request: latencyMs null, status 'unmatched'", () => {
    const row = projectRow(mkEvent(), 0, "unmatched", null);
    expect(row.status).toBe("unmatched");
    expect(row.latencyMs).toBeNull();
    expect(row.latencyBand).toBeNull();
  });
  it("orphan response: status round-trips", () => {
    const e = mkEvent({
      kind: "response",
      method: null,
      raw: { jsonrpc: "2.0", id: 99, result: {} },
    });
    const row = projectRow(e, 0, "orphan", null);
    expect(row.status).toBe("orphan");
    expect(row.kindTag).toBe("RES");
  });
  it("pending status passes through", () => {
    const row = projectRow(mkEvent(), 0, "pending", null);
    expect(row.status).toBe("pending");
  });
});

describe("projectRow() — parse-error", () => {
  it("derives parseErrorReason and lineIndex=seq+1", () => {
    const e = mkEvent({
      seq: 41,
      kind: "parse-error",
      method: null,
      id: null,
      idType: "null",
      raw: undefined,
      parse: "error",
      parseError: { reason: "bad json", rawText: "{not json" },
    });
    const row = projectRow(e, 7, "n/a", null);
    expect(row.kind).toBe("parse-error");
    expect(row.kindTag).toBe("BAD");
    expect(row.status).toBe("n/a");
    expect(row.parseErrorReason).toBe("bad json");
    expect(row.lineIndex).toBe(42);
    expect(row.method).toBeNull();
    expect(row.payloadPreview).toBe("");
    expect(row.latencyMs).toBeNull();
    expect(row.latencyBand).toBeNull();
    expect(row.sessionShort).toBeNull();
    expect(row.turnShort).toBeNull();
    expect(row.keyId).toBeNull();
  });
  it("falls back when parseError missing", () => {
    const e = mkEvent({ kind: "parse-error", parse: "error", raw: undefined });
    const row = projectRow(e, 0, "n/a", null);
    expect(row.parseErrorReason).toBe("unknown parse error");
  });
});

describe("projectRow() — tabular field formatting", () => {
  it("session/turn shortening + key id truncation", () => {
    const e = mkEvent({
      sessionId: "ahp://session/0123456789abcdef",
      turnId: "turn-aaaabbbbcccc",
      id: "very-long-id-1234567890",
    });
    const row = projectRow(e, 0, "ok", 0);
    expect(row.sessionShort).toBe("89abcdef");
    expect(row.turnShort).toBe("bbcccc");
    expect(row.keyId?.length).toBe(12);
    expect(row.keyId).toBe("very-long-id");
  });
  it("nulls when ids missing", () => {
    const row = projectRow(mkEvent({ id: null, idType: "null" }), 0, "ok", 0);
    expect(row.sessionShort).toBeNull();
    expect(row.turnShort).toBeNull();
    expect(row.keyId).toBeNull();
  });
  it("dirGlyph for s2c", () => {
    const row = projectRow(mkEvent({ dir: "s2c" }), 0, "ok", 0);
    expect(row.dirGlyph).toBe("←");
  });
});

describe("projectRow() — action family derivation", () => {
  it("populates actionFamily for action events", () => {
    const e = mkEvent({
      kind: "action",
      method: null,
      actionType: "tool.call",
      raw: { type: "tool.call" },
    });
    const row = projectRow(e, 0, "n/a", null);
    expect(row.kindTag).toBe("ACT");
    expect(row.actionFamily).toBe("tool-call");
  });
  it("null actionFamily for non-action kinds", () => {
    const row = projectRow(mkEvent(), 0, "ok", 0);
    expect(row.actionFamily).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Phase 3 EventRow extras (plan 03-00) — TDD RED before implementation
// ──────────────────────────────────────────────────────────────────────────────
describe("Phase 3 EventRow extras", () => {
  it("response with errorCode=-32007 extras gets isAuthFailure:true and errorCode:-32007", () => {
    const e = mkEvent({
      kind: "response",
      method: null,
      raw: { jsonrpc: "2.0", id: 1, error: { code: -32007, message: "Not authenticated" } },
    });
    const row = projectRow(e, 0, "ok", null, {
      errorCode: -32007,
      serverSeq: null,
      gapBefore: false,
      isAuthFailure: true,
    });
    expect(row.isAuthFailure).toBe(true);
    expect(row.errorCode).toBe(-32007);
  });

  it("protocol-notification with notify/authRequired extras gets isAuthFailure:true", () => {
    const e = mkEvent({
      kind: "protocol-notification",
      method: "notification",
      actionType: "notify/authRequired",
      raw: {
        jsonrpc: "2.0",
        method: "notification",
        params: { notification: { type: "notify/authRequired" } },
      },
    });
    const row = projectRow(e, 0, "n/a", null, {
      errorCode: null,
      serverSeq: null,
      gapBefore: false,
      isAuthFailure: true,
    });
    expect(row.isAuthFailure).toBe(true);
  });

  it("row with gapBefore:true extras propagates gapBefore", () => {
    const e = mkEvent({ kind: "action", method: "action", serverSeq: 3 });
    const row = projectRow(e, 0, "n/a", null, {
      errorCode: null,
      serverSeq: 3,
      gapBefore: true,
      isAuthFailure: false,
    });
    expect(row.gapBefore).toBe(true);
    expect(row.serverSeq).toBe(3);
  });

  it("row with gapBefore:false extras propagates gapBefore:false", () => {
    const e = mkEvent({ kind: "action", method: "action", serverSeq: 2 });
    const row = projectRow(e, 0, "n/a", null, {
      errorCode: null,
      serverSeq: 2,
      gapBefore: false,
      isAuthFailure: false,
    });
    expect(row.gapBefore).toBe(false);
  });

  it("row with no serverSeq extras gets gapBefore:false, serverSeq:null", () => {
    const e = mkEvent({ kind: "request" });
    const row = projectRow(e, 0, "pending", null, {
      errorCode: null,
      serverSeq: null,
      gapBefore: false,
      isAuthFailure: false,
    });
    expect(row.gapBefore).toBe(false);
    expect(row.serverSeq).toBeNull();
  });

  it("normal ok response gets isAuthFailure:false, errorCode:null", () => {
    const e = mkEvent({
      kind: "response",
      method: null,
      raw: { jsonrpc: "2.0", id: 2, result: { ok: true } },
    });
    const row = projectRow(e, 0, "ok", 50, {
      errorCode: null,
      serverSeq: null,
      gapBefore: false,
      isAuthFailure: false,
    });
    expect(row.isAuthFailure).toBe(false);
    expect(row.errorCode).toBeNull();
  });

  it("calling projectRow without extras produces safe defaults (all null/false)", () => {
    const row = projectRow(mkEvent(), 0, "ok", 0);
    expect(row.errorCode).toBeNull();
    expect(row.serverSeq).toBeNull();
    expect(row.gapBefore).toBe(false);
    expect(row.isAuthFailure).toBe(false);
  });

  it("parse-error rows get errorCode:null, serverSeq:null, gapBefore:false, isAuthFailure:false", () => {
    const e = mkEvent({
      seq: 5,
      kind: "parse-error",
      method: null,
      id: null,
      idType: "null",
      raw: undefined,
      parse: "error",
      parseError: { reason: "bad json", rawText: "{bad" },
    });
    const row = projectRow(e, 5, "n/a", null);
    expect(row.errorCode).toBeNull();
    expect(row.serverSeq).toBeNull();
    expect(row.gapBefore).toBe(false);
    expect(row.isAuthFailure).toBe(false);
  });
});
