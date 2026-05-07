import type { EventRow as EventRowData } from "@ahp-viewer/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventRow } from "./EventRow.js";

afterEach(() => cleanup());

const base: EventRowData = {
  idx: 0,
  seq: 0,
  ts: 0,
  tsFmt: "12:34:56.789",
  dir: "c2s",
  dirGlyph: "→",
  kind: "request",
  kindTag: "REQ",
  method: "initialize",
  actionType: null,
  actionFamily: null,
  sessionId: null,
  sessionShort: null,
  turnId: null,
  turnShort: null,
  keyId: null,
  status: "ok",
  latencyMs: null,
  latencyBand: null,
  payloadPreview: "",
  parseErrorReason: null,
  lineIndex: 1,
  errorCode: null,
  serverSeq: null,
  gapBefore: false,
  isAuthFailure: false,
};

function railBg(): string {
  return screen.getByTestId("row-rail").getAttribute("style") ?? "";
}

describe("EventRow — rail color logic", () => {
  it("orphan status → warning rail", () => {
    render(<EventRow row={{ ...base, status: "orphan" }} isSelected={false} onClick={() => {}} />);
    expect(railBg()).toContain("var(--color-warning)");
  });

  it("unmatched status → warning rail", () => {
    render(
      <EventRow row={{ ...base, status: "unmatched" }} isSelected={false} onClick={() => {}} />,
    );
    expect(railBg()).toContain("var(--color-warning)");
  });

  it("error status → destructive rail", () => {
    render(<EventRow row={{ ...base, status: "error" }} isSelected={false} onClick={() => {}} />);
    expect(railBg()).toContain("var(--color-destructive)");
  });

  it("selected → accent rail (overrides status)", () => {
    render(<EventRow row={{ ...base, status: "error" }} isSelected onClick={() => {}} />);
    expect(railBg()).toContain("var(--color-accent)");
  });

  it("ok + not-selected → transparent rail", () => {
    render(<EventRow row={base} isSelected={false} onClick={() => {}} />);
    expect(railBg()).toContain("transparent");
  });
});
