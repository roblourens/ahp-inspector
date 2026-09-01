import { ActionType } from "@ahp-inspector/protocol";
import type { AhpEvent } from "@ahp-inspector/shared";
import { describe, expect, it } from "vitest";
import { isKnownAction, narrowEvent } from "./event-narrow.js";

function event(kind: AhpEvent["kind"], method: string, params: Record<string, unknown>): AhpEvent {
  return {
    seq: 0,
    ts: 0,
    tsRaw: "0",
    dir: "s2c",
    kind,
    method,
    actionType: null,
    id: null,
    idType: "null",
    sessionId: null,
    turnId: null,
    toolCallId: null,
    serverSeq: null,
    byteOffset: 0,
    byteLength: 0,
    raw: { jsonrpc: "2.0", method, params },
    parse: "ok",
  };
}

describe("narrowEvent", () => {
  it("narrows exact canonical chat actions", () => {
    const narrowed = narrowEvent(
      event("action", "action", {
        channel: "ahp-chat:/1",
        serverSeq: 1,
        action: {
          type: ActionType.ChatTurnStarted,
          turnId: "turn-1",
          startedAt: "1970-01-01T00:00:00.000Z",
          message: { text: "Hello", origin: { kind: "user" } },
        },
      }),
    );

    expect(narrowed.kind).toBe("action");
    if (narrowed.kind !== "action") {
      return;
    }
    expect(isKnownAction(narrowed.action)).toBe(true);
    expect(narrowed.envelope?.channel).toBe("ahp-chat:/1");
  });

  it("keeps future actions on known prefixes explicitly unknown", () => {
    const narrowed = narrowEvent(
      event("action", "action", {
        channel: "ahp-chat:/1",
        serverSeq: 2,
        action: { type: "chat/futureAction", value: true },
      }),
    );

    expect(narrowed.kind).toBe("action");
    if (narrowed.kind !== "action") {
      return;
    }
    expect(isKnownAction(narrowed.action)).toBe(false);
    expect(narrowed.action).toEqual({
      type: "chat/futureAction",
      fields: { type: "chat/futureAction", value: true },
    });
    expect(narrowed.envelope?.action).toEqual(narrowed.action);
  });

  it("keeps removed historical session actions explicit and structurally readable", () => {
    const narrowed = narrowEvent(
      event("action", "action", {
        channel: "copilot:/1",
        serverSeq: 2,
        action: {
          type: "session/toolCallDelta",
          turnId: "turn-1",
          toolCallId: "tool-1",
        },
      }),
    );

    expect(narrowed.kind).toBe("action");
    if (narrowed.kind !== "action") {
      return;
    }
    expect(isKnownAction(narrowed.action)).toBe(false);
    expect(narrowed.action.type).toBe("session/toolCallDelta");
  });

  it("types only exact canonical notification methods", () => {
    const known = narrowEvent(
      event("server-notification", "root/sessionRemoved", {
        channel: "agenthost:/root",
        session: "copilot:/1",
      }),
    );
    const future = narrowEvent(
      event("server-notification", "root/futureNotification", {
        channel: "agenthost:/root",
      }),
    );

    expect(known.kind === "server-notification" && known.notification?.method).toBe(
      "root/sessionRemoved",
    );
    expect(future.kind === "server-notification" && future.notification).toBeNull();
  });
});
