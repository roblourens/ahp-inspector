import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { EventRow as EventRowData } from "@ahp-viewer/core";
import { EventRow } from "./EventRow.js";

afterEach(() => cleanup());

const baseRow: EventRowData = {
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
  sessionId: "aaaaaaaa-1111-2222-3333-444444444444",
  sessionShort: "aaaaaaaa",
  turnId: "bbbbbb-77",
  turnShort: "bbbbbb",
  keyId: "1",
  status: "ok",
  latencyMs: 42,
  latencyBand: "fast",
  payloadPreview: '{"hello":"world"}',
  parseErrorReason: null,
  lineIndex: 1,
};

describe("EventRow — UI-SPEC §7.2 11 columns", () => {
  it("renders all 11 columns in source order with expected text", () => {
    render(<EventRow row={baseRow} isSelected={false} onClick={() => {}} />);
    const cells = screen.getAllByRole("gridcell");
    expect(cells.length).toBe(11);

    expect(screen.getByText("12:34:56.789")).toBeTruthy();
    expect(screen.getByText("initialize")).toBeTruthy();
    expect(screen.getByText("aaaaaaaa")).toBeTruthy();
    expect(screen.getByText("bbbbbb")).toBeTruthy();
    expect(screen.getByText("2xx")).toBeTruthy();
    expect(screen.getByText("42ms")).toBeTruthy();
    // keyId column: "1"
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText('{"hello":"world"}')).toBeTruthy();
  });

  it("sets role=row + aria-rowindex + aria-selected", () => {
    render(<EventRow row={{ ...baseRow, idx: 4 }} isSelected onClick={() => {}} />);
    const row = screen.getByRole("row");
    expect(row.getAttribute("aria-rowindex")).toBe("5");
    expect(row.getAttribute("aria-selected")).toBe("true");
  });
});
