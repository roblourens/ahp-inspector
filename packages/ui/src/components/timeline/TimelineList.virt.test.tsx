import type { EventRow as EventRowData } from "@ahp-viewer/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TimelineList } from "./TimelineList.js";

const ROWS = 50_000;

function makeRow(i: number): EventRowData {
  return {
    idx: i,
    seq: i,
    ts: 0,
    tsFmt: "12:00:00.000",
    dir: "c2s",
    dirGlyph: "→",
    kind: "request",
    kindTag: "REQ",
    method: "ping",
    actionType: null,
    actionFamily: null,
    sessionId: null,
    sessionShort: null,
    turnId: null,
    turnShort: null,
    keyId: String(i),
    status: "ok",
    latencyMs: null,
    latencyBand: null,
    payloadPreview: "",
    parseErrorReason: null,
    lineIndex: i + 1,
    errorCode: null,
    serverSeq: null,
    gapBefore: false,
    isAuthFailure: false,
  };
}

const fixture = Array.from({ length: ROWS }, (_, i) => makeRow(i));

const FAKE_RECT: DOMRect = {
  height: 400,
  width: 800,
  top: 0,
  left: 0,
  right: 800,
  bottom: 400,
  x: 0,
  y: 0,
  toJSON: () => "",
};

describe("TimelineList — virtualization", () => {
  let originalRect: typeof Element.prototype.getBoundingClientRect;
  let originalOffsetHeight: PropertyDescriptor | undefined;
  let originalOffsetWidth: PropertyDescriptor | undefined;

  beforeEach(() => {
    // TanStack Virtual reads `offsetWidth` / `offsetHeight` from the scroll element
    // (see @tanstack/virtual-core getRect). jsdom defaults both to 0, which yields
    // zero virtual items. We mock the prototype getters to return a 800x400 viewport
    // and also override getBoundingClientRect for completeness — Rule 3 deviation
    // from the plan, which only mocked getBoundingClientRect.
    originalRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () => FAKE_RECT;
    originalOffsetHeight = Object.getOwnPropertyDescriptor(
      window.HTMLElement.prototype,
      "offsetHeight",
    );
    originalOffsetWidth = Object.getOwnPropertyDescriptor(
      window.HTMLElement.prototype,
      "offsetWidth",
    );
    Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return 400;
      },
    });
    Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        return 800;
      },
    });
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalRect;
    if (originalOffsetHeight) {
      Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    }
    if (originalOffsetWidth) {
      Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
    }
    cleanup();
  });

  it("renders ≤ ~50 DOM rows for a 50,000-row fixture", async () => {
    render(
      <div style={{ height: 400 }}>
        <TimelineList rows={fixture} selectedIdx={null} onSelect={() => {}} />
      </div>,
    );

    const grid = screen.getByRole("grid");
    expect(grid.getAttribute("aria-rowcount")).toBe(String(ROWS));

    const rendered = await screen.findAllByRole("row");
    expect(rendered.length).toBeGreaterThanOrEqual(1);
    expect(rendered.length).toBeLessThan(100);
  });
});
