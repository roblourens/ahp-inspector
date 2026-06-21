import type { EventRow as EventRowData } from "@ahp-inspector/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

describe("EventRow — UI-SPEC §04.1 columns", () => {
  it("renders ID-first columns with summary and no standalone status cell", () => {
    render(<EventRow row={baseRow} isSelected={false} onSelect={() => {}} />);
    const cells = screen.getAllByRole("gridcell");
    expect(cells.length).toBe(10);

    expect(cells[1]?.textContent).toBe("1");
    expect(screen.getByText("12:34:56.789")).toBeTruthy();
    expect(screen.getByText("initialize")).toBeTruthy();
    expect(screen.getByText("aaaaaaaa")).toBeTruthy();
    expect(screen.getByText("bbbbbb")).toBeTruthy();
    expect(screen.queryByText("2xx")).toBeNull();
    expect(screen.getByText("42ms")).toBeTruthy();
    expect(screen.getByTestId("row-summary").textContent).toBe("initialize hello=world");
  });

  it("shows the action type as the primary label for action envelopes", () => {
    render(
      <EventRow
        row={{
          ...baseRow,
          kind: "action",
          kindTag: "ACT",
          method: "action",
          actionType: "session/delta",
        }}
        isSelected={false}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("session/delta")).toBeTruthy();
  });

  it("keeps long action labels on one truncated line", () => {
    render(
      <EventRow
        row={{
          ...baseRow,
          kind: "action",
          kindTag: "ACT",
          method: "action",
          actionType: "session/toolCallContentChanged",
        }}
        isSelected={false}
        onSelect={() => {}}
      />,
    );

    const methodCell = screen.getByTitle("session/toolCallContentChanged (action)");
    expect(methodCell.style.whiteSpace).toBe("nowrap");
    expect(methodCell.style.overflow).toBe("hidden");
    expect(screen.getByText("session/toolCallContentChanged")).toBeTruthy();
  });

  it("prevents every timeline column from wrapping", () => {
    render(<EventRow row={baseRow} isSelected={false} onSelect={() => {}} />);
    for (const cell of screen.getAllByRole("gridcell")) {
      expect(cell.style.whiteSpace).toBe("nowrap");
      expect(cell.style.overflow).toBe("hidden");
      expect(cell.style.textOverflow).toBe("ellipsis");
    }
  });

  it("sets role=row + aria-rowindex + aria-selected", () => {
    render(<EventRow row={{ ...baseRow, idx: 4 }} isSelected onSelect={() => {}} />);
    const row = screen.getByRole("row");
    expect(row.getAttribute("aria-rowindex")).toBe("5");
    expect(row.getAttribute("aria-selected")).toBe("true");
    expect(row.getAttribute("data-selected")).toBe("true");
  });

  it("marks a row as a search match", () => {
    render(<EventRow row={baseRow} isSelected={false} isSearchMatch onSelect={() => {}} />);
    expect(screen.getByRole("row")).toHaveAttribute("data-search-match", "true");
  });

  it("uses selected bg when a row is selected, search-matched, and pair-highlighted", () => {
    render(
      <EventRow
        row={baseRow}
        isSelected
        isSearchMatch
        pairHighlight="request"
        onSelect={() => {}}
      />,
    );
    const row = screen.getByRole("row");
    expect(row.getAttribute("data-selected")).toBe("true");
    expect(row.getAttribute("data-search-match")).toBe("true");
    expect(row.getAttribute("data-pair-highlight")).toBe("request");
    // Selected bg wins over pair and search-match.
    expect((row as HTMLElement).style.background).toContain("--row-selected-bg");
    // No outline rule fights the selection.
    expect((row as HTMLElement).style.outline).toBe("");
  });

  it("does not expose action family marker copy", () => {
    render(
      <EventRow
        row={{
          ...baseRow,
          kind: "action",
          kindTag: "ACT",
          method: "action",
          actionType: "mysterySafeAction",
          actionFamily: "unknown",
          summary: "action mysterySafeAction",
        }}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByTestId("action-dot")).toBeNull();
    expect(document.body.textContent).not.toMatch(/family unknown|Action row family/i);
  });
});
