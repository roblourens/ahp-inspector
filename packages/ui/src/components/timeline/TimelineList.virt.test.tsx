import type { EventRow as EventRowData } from "@ahp-inspector/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { VirtualItem } from "../../state/selectors.js";
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
    summary: `ping id=${i}`,
    pairIdx: null,
    parseErrorReason: null,
    lineIndex: i + 1,
    errorCode: null,
    serverSeq: null,
    previousServerSeq: null,
    gapBefore: false,
    isAuthFailure: false,
  };
}

const fixture = Array.from({ length: ROWS }, (_, i) => makeRow(i));
const fixtureItems: VirtualItem[] = fixture.map((r) => ({ kind: "row", rowIdx: r.idx }));

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
        <TimelineList items={fixtureItems} rows={fixture} selectedIdx={null} onSelect={() => {}} />
      </div>,
    );

    const grid = screen.getByRole("grid");
    expect(grid.getAttribute("aria-rowcount")).toBe(String(ROWS));
    expect(screen.getByTestId("timeline-column-header")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Request or event ID" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Time" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Status" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Parsed event summary" })).toBeInTheDocument();

    const rendered = await screen.findAllByRole("row");
    expect(rendered.length).toBeGreaterThanOrEqual(1);
    expect(rendered.length).toBeLessThan(100);
  });

  it("highlights a visible correlated response for the selected request", async () => {
    const request = { ...makeRow(0), kind: "request" as const, pairIdx: 1 };
    const response = {
      ...makeRow(1),
      kind: "response" as const,
      kindTag: "RES" as const,
      pairIdx: 0,
    };
    const rows = [request, response];
    render(
      <div style={{ height: 400 }}>
        <TimelineList
          items={rows.map((r) => ({ kind: "row", rowIdx: r.idx }))}
          rows={rows}
          selectedIdx={0}
          onSelect={() => {}}
        />
      </div>,
    );
    expect(await screen.findByTestId("row-1")).toHaveAttribute("data-pair-highlight", "response");
    expect(screen.getByTestId("row-0")).toHaveAttribute("data-selected", "true");
  });

  it("marks rows returned by search without removing context rows", async () => {
    const rows = [makeRow(0), makeRow(1), makeRow(2)];
    render(
      <div style={{ height: 400 }}>
        <TimelineList
          items={rows.map((r) => ({ kind: "row", rowIdx: r.idx }))}
          rows={rows}
          selectedIdx={null}
          onSelect={() => {}}
          searchMatches={new Set([1])}
          searchQuery="event"
        />
      </div>,
    );
    expect(await screen.findByTestId("row-0")).not.toHaveAttribute("data-search-match");
    expect(screen.getByTestId("row-1")).toHaveAttribute("data-search-match", "true");
    expect(screen.getByTestId("row-2")).not.toHaveAttribute("data-search-match");
  });

  it("marks selected response when its correlated request is hidden by filters", async () => {
    const request = { ...makeRow(0), kind: "request" as const, pairIdx: 1 };
    const response = {
      ...makeRow(1),
      kind: "response" as const,
      kindTag: "RES" as const,
      pairIdx: 0,
    };
    const rows = [request, response];
    render(
      <div style={{ height: 400 }}>
        <TimelineList
          items={[{ kind: "row", rowIdx: 1 }]}
          rows={rows}
          selectedIdx={1}
          onSelect={() => {}}
        />
      </div>,
    );
    const selected = await screen.findByTestId("row-1");
    expect(selected).toHaveAttribute("data-pair-hidden", "request");
    expect(selected.getAttribute("aria-label")).toContain(
      "Correlated request is hidden by current filters",
    );
  });

  it("keeps a progressive off-bottom inspection viewport stable when rows grow", () => {
    const callbacks: FrameRequestCallback[] = [];
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
      callbacks.push(cb);
      return callbacks.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
    try {
      const initialRows = fixture.slice(0, 20);
      const rendered = render(
        <div style={{ height: 400 }}>
          <TimelineList
            items={initialRows.map((row) => ({ kind: "row", rowIdx: row.idx }))}
            rows={initialRows}
            selectedIdx={null}
            onSelect={() => {}}
          />
        </div>,
      );
      const grid = screen.getByTestId("timeline-list");
      let scrollTop = 0;
      Object.defineProperties(grid, {
        scrollTop: { configurable: true, get: () => scrollTop, set: (value) => (scrollTop = Number(value)) },
        scrollHeight: { configurable: true, get: () => 2_000 },
        clientHeight: { configurable: true, get: () => 400 },
      });
      for (const cb of callbacks.splice(0)) cb(0);
      scrollTop = 100;
      fireEvent.scroll(grid);

      const grownRows = fixture.slice(0, 21);
      rendered.rerender(
        <div style={{ height: 400 }}>
          <TimelineList
            items={grownRows.map((row) => ({ kind: "row", rowIdx: row.idx }))}
            rows={grownRows}
            selectedIdx={null}
            onSelect={() => {}}
          />
        </div>,
      );
      for (const cb of callbacks.splice(0)) cb(0);
      expect(scrollTop).toBe(100);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }
  });

  it("keeps true bottom follow smooth when progressive rows append", () => {
    const callbacks: FrameRequestCallback[] = [];
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancelRaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
      callbacks.push(cb);
      return callbacks.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
    try {
      const initialRows = fixture.slice(0, 20);
      const rendered = render(
        <div style={{ height: 400 }}>
          <TimelineList
            items={initialRows.map((row) => ({ kind: "row", rowIdx: row.idx }))}
            rows={initialRows}
            selectedIdx={null}
            onSelect={() => {}}
          />
        </div>,
      );
      const grid = screen.getByTestId("timeline-list");
      let scrollTop = 1_600;
      let scrollHeight = 2_000;
      Object.defineProperties(grid, {
        scrollTop: { configurable: true, get: () => scrollTop, set: (value) => (scrollTop = Number(value)) },
        scrollHeight: { configurable: true, get: () => scrollHeight },
        clientHeight: { configurable: true, get: () => 400 },
      });
      for (const cb of callbacks.splice(0)) cb(0);
      scrollTop = 1_600;
      fireEvent.scroll(grid);
      scrollHeight = 2_100;

      const grownRows = fixture.slice(0, 21);
      rendered.rerender(
        <div style={{ height: 400 }}>
          <TimelineList
            items={grownRows.map((row) => ({ kind: "row", rowIdx: row.idx }))}
            rows={grownRows}
            selectedIdx={null}
            onSelect={() => {}}
          />
        </div>,
      );
      for (const cb of callbacks.splice(0)) cb(0);
      expect(scrollTop).toBe(2_100);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancelRaf;
    }
  });
});
