// EventRow.memo.test.tsx — verifies Plan 32-04's memo stabilization:
//  1. EventRow is wrapped in React.memo so it can short-circuit re-renders.
//  2. The new `onSelect(idx)` contract fires with this row's index on click and
//     keyboard activation (replaces the old fresh-closure `onClick`).

import type { EventRow as EventRowData } from "@ahp-inspector/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventRow } from "./EventRow.js";

afterEach(() => cleanup());

const baseRow: EventRowData = {
  idx: 7,
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
  summary: "initialize hello=world",
  pairIdx: null,
  parseErrorReason: null,
  lineIndex: 1,
  errorCode: null,
  serverSeq: null,
  previousServerSeq: null,
  gapBefore: false,
  isAuthFailure: false,
};

describe("EventRow memoization", () => {
  it("is wrapped in React.memo so stable props can short-circuit re-renders", () => {
    const tag = (EventRow as unknown as { $$typeof?: symbol }).$$typeof;
    expect(tag).toBe(Symbol.for("react.memo"));
  });

  it("calls onSelect with this row's index on click", () => {
    const onSelect = vi.fn();
    render(<EventRow row={baseRow} isSelected={false} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId("row-7"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it("calls onSelect with this row's index on keyboard activation", () => {
    const onSelect = vi.fn();
    render(<EventRow row={baseRow} isSelected onSelect={onSelect} />);

    const row = screen.getByTestId("row-7");
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenNthCalledWith(1, 7);
    expect(onSelect).toHaveBeenNthCalledWith(2, 7);
  });
});
