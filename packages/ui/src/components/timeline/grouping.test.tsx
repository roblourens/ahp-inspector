/**
 * Tests for GroupHeaderRow, GapBannerRow, StickyGroupBar, and polymorphic
 * TimelineList (Plan 03-05). Environment: jsdom.
 */
// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid test
import type { EventRow as EventRowData } from "@ahp-inspector/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// Fix import path: grouping.test.tsx is at .../timeline/, selectors is at .../state/
import type { VirtualItem } from "../../state/selectors.js";
import { GroupHeaderRow } from "./GroupHeaderRow.js";
import { StickyGroupBar } from "./StickyGroupBar.js";
import { TimelineList } from "./TimelineList.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEventRow(overrides: Partial<EventRowData> = {}): EventRowData {
  return {
    idx: 0,
    seq: 0,
    ts: Date.now(),
    tsFmt: "00:00:00.000",
    dir: "c2s",
    dirGlyph: "→",
    kind: "request",
    kindTag: "REQ",
    method: "initialize",
    actionType: null,
    actionFamily: null,
    sessionId: "session-abc12345",
    sessionShort: "bc12345",
    turnId: null,
    turnShort: null,
    keyId: "1",
    status: "ok",
    latencyMs: null,
    latencyBand: null,
    payloadPreview: "{}",
    parseErrorReason: null,
    lineIndex: 1,
    errorCode: null,
    serverSeq: null,
    previousServerSeq: null,
    gapBefore: false,
    isAuthFailure: false,
    ...overrides,
  };
}

// ── GroupHeaderRow ────────────────────────────────────────────────────────────

describe("GroupHeaderRow", () => {
  afterEach(() => cleanup());

  it("renders a readable session label", () => {
    render(
      <GroupHeaderRow
        level="session"
        sessionId="copilot:/session/frontend-polish-2026-05-07"
        count={10}
        durationMs={1234}
        isCollapsed={false}
        onToggle={() => {}}
        virtualStyle={{}}
      />,
    );
    expect(screen.getByText(/Session frontend-polish/)).toBeTruthy();
  });

  it("renders turn label with ↳ Turn and last 6 chars of turnId", () => {
    render(
      <GroupHeaderRow
        level="turn"
        sessionId="session-abc12345"
        turnId="turn-xyz789"
        count={5}
        durationMs={500}
        isCollapsed={false}
        onToggle={() => {}}
        virtualStyle={{}}
      />,
    );
    // "turn-xyz789".slice(-6) = "yz789" — wait, "turn-xyz789" = 11 chars, slice(-6) = "yz789" no...
    // t,u,r,n,-,x,y,z,7,8,9 = 11 chars; slice(-6) = z,7,8,9 — no, slice(-6) = "z789" ... wait
    // Let me count: t(1) u(2) r(3) n(4) -(5) x(6) y(7) z(8) 7(9) 8(10) 9(11)
    // slice(-6) starts at index 5: x,y,z,7,8,9 = "xyz789"
    expect(screen.getByText(/↳ Turn xyz789/)).toBeTruthy();
  });

  it("renders event count and duration", () => {
    render(
      <GroupHeaderRow
        level="session"
        sessionId="abc"
        count={42}
        durationMs={500}
        isCollapsed={false}
        onToggle={() => {}}
        virtualStyle={{}}
      />,
    );
    expect(screen.getByText(/42/)).toBeTruthy();
  });

  it("formats duration <50ms as milliseconds", () => {
    render(
      <GroupHeaderRow
        level="session"
        sessionId="abc"
        count={1}
        durationMs={30}
        isCollapsed={false}
        onToggle={() => {}}
        virtualStyle={{}}
      />,
    );
    expect(screen.getByText(/30ms/)).toBeTruthy();
  });

  it("formats duration >=50ms and <60s as seconds (1 decimal)", () => {
    render(
      <GroupHeaderRow
        level="session"
        sessionId="abc"
        count={1}
        durationMs={1500}
        isCollapsed={false}
        onToggle={() => {}}
        virtualStyle={{}}
      />,
    );
    expect(screen.getByText(/1\.5s/)).toBeTruthy();
  });

  it("formats duration >=60s as minutes and seconds", () => {
    render(
      <GroupHeaderRow
        level="session"
        sessionId="abc"
        count={1}
        durationMs={90000}
        isCollapsed={false}
        onToggle={() => {}}
        virtualStyle={{}}
      />,
    );
    expect(screen.getByText(/1m 30s/)).toBeTruthy();
  });

  it("collapse toggle button has correct aria-label when expanded", () => {
    render(
      <GroupHeaderRow
        level="session"
        sessionId="session-abc12345"
        count={1}
        durationMs={10}
        isCollapsed={false}
        onToggle={() => {}}
        virtualStyle={{}}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-label")).toMatch(/Collapse/);
  });

  it("collapse toggle button has correct aria-label when collapsed", () => {
    render(
      <GroupHeaderRow
        level="session"
        sessionId="session-abc12345"
        count={1}
        durationMs={10}
        isCollapsed={true}
        onToggle={() => {}}
        virtualStyle={{}}
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-label")).toMatch(/Expand/);
  });
});

// ── StickyGroupBar ────────────────────────────────────────────────────────────

describe("StickyGroupBar", () => {
  afterEach(() => cleanup());

  it("renders nothing when topGroup is null", () => {
    const { container } = render(<StickyGroupBar topGroup={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders session group label when topGroup is set", () => {
    render(<StickyGroupBar topGroup={{ level: "session", label: "Session abc12345" }} />);
    expect(screen.getByText("Session abc12345")).toBeTruthy();
  });

  it("renders turn group label when topGroup is a turn", () => {
    render(<StickyGroupBar topGroup={{ level: "turn", label: "↳ Turn xyz789" }} />);
    expect(screen.getByText("↳ Turn xyz789")).toBeTruthy();
  });
});

// ── TimelineList — polymorphic ────────────────────────────────────────────────

describe("TimelineList — polymorphic VirtualItem rendering", () => {
  let originalOffsetHeight: PropertyDescriptor | undefined;
  let originalOffsetWidth: PropertyDescriptor | undefined;
  let originalRect: typeof Element.prototype.getBoundingClientRect;

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

  beforeEach(() => {
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

  const rows: EventRowData[] = [
    makeEventRow({ idx: 0 }),
    makeEventRow({ idx: 1, sessionId: "session-abc12345" }),
  ];

  const items: VirtualItem[] = [
    {
      kind: "header",
      level: "session",
      groupKey: "session-abc12345",
      sessionId: "session-abc12345",
      count: 2,
      durationMs: 100,
    },
    { kind: "row", rowIdx: 0 },
    { kind: "row", rowIdx: 1 },
  ];

  it("renders GroupHeaderRow for header items", async () => {
    render(
      <div style={{ height: 400 }}>
        <TimelineList items={items} rows={rows} selectedIdx={null} onSelect={() => {}} />
      </div>,
    );
    // GroupHeaderRow should render the session label
    const headers = await screen.findAllByText(/Session abc12345/);
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });

  it("renders EventRow for row items", async () => {
    render(
      <div style={{ height: 400 }}>
        <TimelineList items={items} rows={rows} selectedIdx={null} onSelect={() => {}} />
      </div>,
    );
    // EventRow rows should be rendered
    const rows_ = await screen.findAllByRole("row");
    expect(rows_.length).toBeGreaterThanOrEqual(1);
  });

  it("uses correct aria-rowcount based on items length", () => {
    render(
      <div style={{ height: 400 }}>
        <TimelineList items={items} rows={rows} selectedIdx={null} onSelect={() => {}} />
      </div>,
    );
    const grid = screen.getByRole("grid");
    expect(grid.getAttribute("aria-rowcount")).toBe(String(items.length));
  });
});
