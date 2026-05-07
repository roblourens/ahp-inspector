// classifyDirection — JSON-RPC structural inference for client-side AHP logs.
// Plan 02-05 Task 1.

import { describe, expect, it } from "vitest";
import { classifyDirection } from "./direction.js";

describe("classifyDirection (JSON-RPC structural inference)", () => {
  it("classifies an outbound request {id, method} as c2s", () => {
    expect(classifyDirection({ jsonrpc: "2.0", id: 1, method: "initialize" })).toBe("c2s");
  });

  it("classifies a response {id, result} as s2c", () => {
    expect(classifyDirection({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } })).toBe("s2c");
  });

  it("classifies an error response {id, error} as s2c", () => {
    expect(
      classifyDirection({ jsonrpc: "2.0", id: 1, error: { code: -32600, message: "x" } }),
    ).toBe("s2c");
  });

  it("classifies a server-originated action notification as s2c", () => {
    expect(
      classifyDirection({
        jsonrpc: "2.0",
        method: "action",
        params: { type: "text", sessionId: "sess-aaa" },
      }),
    ).toBe("s2c");
  });

  it("classifies a server-originated notification message as s2c", () => {
    expect(
      classifyDirection({
        jsonrpc: "2.0",
        method: "notification",
        params: { type: "sessionUpdate" },
      }),
    ).toBe("s2c");
  });

  it("classifies an arbitrary client notification (no id) as c2s", () => {
    expect(classifyDirection({ jsonrpc: "2.0", method: "session/cancel" })).toBe("c2s");
  });

  it("returns c2s defensively for non-object input", () => {
    expect(classifyDirection(null)).toBe("c2s");
    expect(classifyDirection(undefined)).toBe("c2s");
    expect(classifyDirection("not-an-object")).toBe("c2s");
    expect(classifyDirection(42)).toBe("c2s");
  });

  it("returns c2s for an empty object (defensive fallback)", () => {
    expect(classifyDirection({})).toBe("c2s");
  });
});
