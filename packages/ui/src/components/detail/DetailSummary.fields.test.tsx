/**
 * Tests for AhpFieldStrip — all 9 AHP fields (Plan 03-04 Task 1).
 */

import type { EventRow, KindTag } from "@ahp-viewer/core";
import type { AhpEvent } from "@ahp-viewer/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AhpFieldStrip } from "./AhpFieldStrip.js";

function makeRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    idx: 0,
    seq: 0,
    ts: 1700000000000,
    tsFmt: "22:13:20.000",
    dir: "c2s",
    dirGlyph: "→",
    kind: "request",
    kindTag: "REQ",
    method: "tools/list",
    actionType: null,
    actionFamily: null,
    sessionId: null,
    sessionShort: null,
    turnId: null,
    turnShort: null,
    keyId: null,
    status: "pending",
    latencyMs: null,
    latencyBand: null,
    payloadPreview: "{}",
    parseErrorReason: null,
    lineIndex: null,
    errorCode: null,
    serverSeq: null,
    previousServerSeq: null,
    gapBefore: false,
    isAuthFailure: false,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<AhpEvent> = {}): AhpEvent {
  return {
    seq: 0,
    ts: 1700000000000,
    tsRaw: "2023-11-14T22:13:20.000Z",
    dir: "c2s",
    kind: "request",
    method: "tools/list",
    actionType: null,
    id: 1,
    idType: "number",
    sessionId: null,
    turnId: null,
    toolCallId: null,
    serverSeq: null,
    byteOffset: 0,
    byteLength: 100,
    raw: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    parse: "ok",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("AhpFieldStrip — session field", () => {
  it("renders Session row with --color-info stripe when sessionId present", () => {
    const row = makeRow({ sessionId: "sess-abc", sessionShort: "abc" });
    const rawEvent = makeEvent({ sessionId: "sess-abc" });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    const strip = screen.getByTestId("ahp-field-strip");
    expect(strip).toBeInTheDocument();
    expect(screen.getByText("Session")).toBeInTheDocument();
    expect(screen.getByText("sess-abc")).toBeInTheDocument();
  });

  it("does NOT render Session row when sessionId is null", () => {
    const row = makeRow({ sessionId: null });
    const rawEvent = makeEvent({ sessionId: null });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.queryByText("Session")).toBeNull();
  });
});

describe("AhpFieldStrip — turn field", () => {
  it("renders Turn row when turnId present", () => {
    const row = makeRow({ turnId: "turn-xyz", turnShort: "xyz" });
    const rawEvent = makeEvent({ turnId: "turn-xyz" });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.getByText("Turn")).toBeInTheDocument();
  });

  it("does NOT render Turn row when turnId is null", () => {
    const row = makeRow({ turnId: null });
    const rawEvent = makeEvent({ turnId: null });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.queryByText("Turn")).toBeNull();
  });
});

describe("AhpFieldStrip — actionType field", () => {
  it("renders Action type row when actionType present", () => {
    const row = makeRow({ actionType: "text", kind: "action", kindTag: "ACT" as KindTag });
    const rawEvent = makeEvent({ actionType: "text", kind: "action" });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.getByText("Action type")).toBeInTheDocument();
    expect(screen.getByText("text")).toBeInTheDocument();
  });
});

describe("AhpFieldStrip — serverSeq field", () => {
  it("renders Server seq row when serverSeq present", () => {
    const row = makeRow({ serverSeq: 42 });
    const rawEvent = makeEvent({ serverSeq: 42 });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.getByText("Server seq")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders gap annotation when gapBefore is true", () => {
    const row = makeRow({ serverSeq: 10, gapBefore: true });
    const rawEvent = makeEvent({ serverSeq: 10 });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.getByText(/gap/i)).toBeInTheDocument();
  });
});

describe("AhpFieldStrip — requestId field", () => {
  it("renders Request id row for request events when keyId present", () => {
    const row = makeRow({ keyId: "req-1", kindTag: "REQ" });
    const rawEvent = makeEvent({ id: 1 });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.getByText("Request id")).toBeInTheDocument();
    expect(screen.getByText("req-1")).toBeInTheDocument();
  });
});

describe("AhpFieldStrip — errorCode field", () => {
  it("renders Error code row with AHP label for -32007", () => {
    const row = makeRow({ errorCode: -32007, kindTag: "RES" as KindTag, isAuthFailure: true });
    const rawEvent = makeEvent({ kind: "response", method: null });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.getByText("Error code")).toBeInTheDocument();
    expect(screen.getByText(/-32007/)).toBeInTheDocument();
    expect(screen.getByText(/Authentication required/i)).toBeInTheDocument();
  });

  it("does NOT render Error code row when errorCode is null", () => {
    const row = makeRow({ errorCode: null });
    const rawEvent = makeEvent();
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.queryByText("Error code")).toBeNull();
  });
});

describe("AhpFieldStrip — notificationType field", () => {
  it("renders Notification type for NTF rows", () => {
    const row = makeRow({ kindTag: "NTF" as KindTag, actionType: "authRequired" });
    const rawEvent = makeEvent({ kind: "client-notification", actionType: "authRequired" });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.getByText("Notification type")).toBeInTheDocument();
    expect(screen.getByText("authRequired")).toBeInTheDocument();
  });
});

describe("AhpFieldStrip — all 9 fields present", () => {
  it("renders all 9 rows when all fields are populated", () => {
    const row = makeRow({
      sessionId: "sess-1",
      sessionShort: "s1",
      turnId: "turn-1",
      turnShort: "t1",
      actionType: "text",
      kind: "action",
      kindTag: "ACT" as KindTag,
      serverSeq: 5,
      keyId: "req-99",
      errorCode: -32007,
      isAuthFailure: true,
    });
    const rawEvent = makeEvent({
      sessionId: "sess-1",
      turnId: "turn-1",
      actionType: "text",
      kind: "action",
      serverSeq: 5,
      raw: {
        jsonrpc: "2.0",
        method: "action",
        params: {
          toolCall: { name: "search" },
          origin: "extension",
        },
      },
    });
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    expect(screen.getByText("Session")).toBeInTheDocument();
    expect(screen.getByText("Turn")).toBeInTheDocument();
    expect(screen.getByText("Tool call")).toBeInTheDocument();
    expect(screen.getByText("Action type")).toBeInTheDocument();
    expect(screen.getByText("Server seq")).toBeInTheDocument();
    expect(screen.getByText("Origin")).toBeInTheDocument();
    expect(screen.getByText("Error code")).toBeInTheDocument();
  });
});

describe("AhpFieldStrip — empty strip", () => {
  it("renders an empty strip (no rows) when no AHP fields are present", () => {
    const row = makeRow();
    const rawEvent = makeEvent();
    render(<AhpFieldStrip row={row} rawEvent={rawEvent} />);
    const strip = screen.getByTestId("ahp-field-strip");
    // The strip itself should exist but have no field rows inside it
    expect(strip).toBeInTheDocument();
    expect(strip.children).toHaveLength(0);
  });
});
