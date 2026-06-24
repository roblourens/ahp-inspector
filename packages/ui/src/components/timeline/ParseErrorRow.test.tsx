import type { EventRow as EventRowData } from "@ahp-inspector/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ParseErrorRow } from "./ParseErrorRow.js";

afterEach(() => cleanup());

const baseError: EventRowData = {
  idx: 9,
  seq: 4,
  ts: 0,
  tsFmt: "",
  dir: "c2s",
  dirGlyph: "·",
  kind: "parse-error",
  kindTag: "BAD",
  method: null,
  actionType: null,
  actionFamily: null,
  sessionId: null,
  sessionShort: null,
  turnId: null,
  turnShort: null,
  keyId: null,
  status: "error",
  latencyMs: null,
  latencyBand: null,
  payloadPreview: "",
  parseErrorReason: "expected token",
  lineIndex: 5,
  errorCode: null,
  serverSeq: null,
  previousServerSeq: null,
  gapBefore: false,
  isAuthFailure: false,
};

describe("ParseErrorRow — UI-SPEC §7.3", () => {
  it("renders verbatim BAD line copy", () => {
    render(<ParseErrorRow row={baseError} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("BAD · line 5 · expected token")).toBeTruthy();
  });

  it("rail uses repeating-linear-gradient with destructive color", () => {
    render(<ParseErrorRow row={baseError} isSelected={false} onClick={() => {}} />);
    const style = screen.getByTestId("parse-error-rail").getAttribute("style") ?? "";
    expect(style).toContain("repeating-linear-gradient");
    expect(style).toContain("var(--color-destructive)");
  });

  it("uses compact timeline-local row geometry and typography", () => {
    render(<ParseErrorRow row={baseError} isSelected={false} onClick={() => {}} />);
    expect(screen.getByRole("row")).toHaveStyle({
      height: "var(--row-height)",
      padding: "2px 8px",
      fontSize: "var(--text-ui-muted-size)",
      lineHeight: "16px",
    });
  });

  it("applies subtle alternate-row background below selection state", () => {
    const { rerender } = render(
      <ParseErrorRow row={baseError} isSelected={false} isAlternate onClick={() => {}} />,
    );
    expect(screen.getByRole("row")).toHaveAttribute("data-alternate", "true");
    expect(screen.getByRole("row").getAttribute("style")).toContain(
      "color-mix(in srgb, var(--color-surface-raised) 18%, transparent)",
    );

    rerender(<ParseErrorRow row={baseError} isSelected isAlternate onClick={() => {}} />);
    expect(screen.getByRole("row").getAttribute("style")).toContain("var(--color-surface-raised)");
  });

  it("falls back to '?' / 'unknown' when fields are null", () => {
    render(
      <ParseErrorRow
        row={{ ...baseError, lineIndex: null, parseErrorReason: null }}
        isSelected={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("BAD · line ? · unknown")).toBeTruthy();
  });
});
