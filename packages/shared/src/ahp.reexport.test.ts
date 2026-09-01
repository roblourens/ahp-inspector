// Subpath import — verifies the package "exports" map exposes ./ahp.
import type {
  ActionEnvelope,
  ChatAction,
  ChatState,
  ClientNotificationMap,
  CommandMap,
  ProtocolMessage,
  ProtocolNotificationMethod,
  ServerNotificationMap,
} from "@ahp-inspector/shared/ahp";
import { ActionType } from "@ahp-inspector/shared/ahp";
import { describe, expect, it } from "vitest";
import {
  type AhpEvent,
  type CorrelationKey,
  correlationKeyForRequest,
  correlationKeyForResponse,
  type Direction,
  type EventKind,
  type IdType,
  makeCorrelationKey,
  makeParseErrorEvent,
} from "./index.js";

// ─── AHP re-export shape ─────────────────────────────────────────────────────

describe("AHP compatibility re-exports (SYNC-04)", () => {
  it("type-only symbols typecheck via the @ahp-inspector/shared/ahp subpath", () => {
    // Pure type-level assertions: if the imports above resolved, they pass.
    type _M = ProtocolMessage;
    type _A = ActionEnvelope;
    type _CM = CommandMap;
    type _CN = ClientNotificationMap;
    type _SN = ServerNotificationMap;
    type _CS = ChatState;
    type _CA = ChatAction;
    type _PN = ProtocolNotificationMethod;
    // Force the type aliases to be referenced so the compiler doesn't drop
    // them under verbatimModuleSyntax.
    const _x: _M | _A | _CM | _CN | _SN | _CS | _CA | _PN | undefined = undefined;
    expect(_x).toBeUndefined();
  });

  it("canonical action and notification method types are exported", () => {
    const at: ActionType = ActionType.ChatTurnStarted;
    const nt: ProtocolNotificationMethod = "root/sessionAdded";
    expect(typeof at).toBe("string");
    expect(typeof nt).toBe("string");
  });
});

// ─── AhpEvent envelope ───────────────────────────────────────────────────────

function makeEvent(overrides: Partial<AhpEvent> = {}): AhpEvent {
  const base: AhpEvent = {
    seq: 0,
    ts: 0,
    tsRaw: "",
    dir: "c2s",
    kind: "request",
    method: "listSessions",
    actionType: null,
    id: 1,
    idType: "number",
    sessionId: null,
    turnId: null,
    toolCallId: null,
    serverSeq: null,
    byteOffset: 0,
    byteLength: 0,
    raw: undefined,
    parse: "ok",
  };
  return { ...base, ...overrides };
}

describe("AhpEvent shape", () => {
  it("constructs via object literal and has readonly fields", () => {
    const ev = makeEvent({ id: "abc", idType: "string" });
    expect(ev.kind).toBe("request");
    expect(ev.idType).toBe("string");
    // @ts-expect-error - seq is readonly; mutation must fail typecheck.
    ev.seq = 99;
  });

  it("EventKind union covers all 8 documented kinds", () => {
    const kinds: EventKind[] = [
      "request",
      "response",
      "client-notification",
      "server-notification",
      "action",
      "protocol-notification",
      "log",
      "parse-error",
    ];
    expect(kinds).toHaveLength(8);
  });
});

// ─── makeParseErrorEvent ─────────────────────────────────────────────────────

describe("makeParseErrorEvent", () => {
  it("emits kind:'parse-error' with capped rawText (≤ 8 KiB)", () => {
    const huge = "x".repeat(20_000);
    const ev = makeParseErrorEvent(
      { seq: 7, ts: 1, tsRaw: "t", dir: "s2c", byteOffset: 100, byteLength: huge.length },
      "boom",
      huge,
    );
    expect(ev.kind).toBe("parse-error");
    expect(ev.parse).toBe("error");
    expect(ev.parseError?.reason).toBe("boom");
    expect(ev.parseError?.rawText.length).toBe(8 * 1024);
    expect(ev.dir).toBe("s2c");
    expect(ev.seq).toBe(7);
    expect(ev.byteOffset).toBe(100);
  });
});

// ─── Correlation keys ────────────────────────────────────────────────────────

describe("correlation (Pattern 4)", () => {
  it("makeCorrelationKey: sessioned + numeric id", () => {
    const k = makeCorrelationKey("s1", "c2s", "number", 1);
    expect(k).toBe("s1::c2s::number::1");
  });

  it("makeCorrelationKey: null session + string id uses ∅ marker", () => {
    const k = makeCorrelationKey(null, "s2c", "string", "abc");
    expect(k).toBe("\u2205::s2c::string::abc");
  });

  it("response key INVERTS direction so it matches its originating request", () => {
    const req = makeEvent({ dir: "c2s", sessionId: "s1", id: 1, idType: "number" });
    const res = makeEvent({
      dir: "s2c",
      sessionId: "s1",
      id: 1,
      idType: "number",
      kind: "response",
    });
    const reqKey: CorrelationKey = correlationKeyForRequest(req);
    const resKey: CorrelationKey = correlationKeyForResponse(res);
    expect(reqKey).toBe("∅::c2s::number::1");
    expect(resKey).toBe(reqKey);
  });

  it("pairs a session-scoped request with a response that cannot carry the session", () => {
    const req = makeEvent({ dir: "c2s", sessionId: "s1", id: 1, idType: "number" });
    const res = makeEvent({
      dir: "s2c",
      sessionId: null,
      id: 1,
      idType: "number",
      kind: "response",
    });

    expect(correlationKeyForResponse(res)).toBe(correlationKeyForRequest(req));
  });

  it("number id 1 and string id '1' produce DIFFERENT keys (Pitfall 2)", () => {
    const a = makeCorrelationKey("s1", "c2s", "number", 1);
    const b = makeCorrelationKey("s1", "c2s", "string", "1");
    expect(a).not.toBe(b);
  });

  it("Direction / IdType narrow correctly", () => {
    const dirs: Direction[] = ["c2s", "s2c"];
    const idTypes: IdType[] = ["number", "string", "null"];
    expect(dirs).toHaveLength(2);
    expect(idTypes).toHaveLength(3);
  });
});
