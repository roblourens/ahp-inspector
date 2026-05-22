// TimelineRegion tests — Plan 04-06 Task 2.
// Covers: live-pause Space-key shortcut (with editable-target guards),
// RotationBanner mount + auto-dismiss, NewEventsPill mount when paused.

import type { EventRow } from "@ahp-inspector/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "../../state/filters.js";
import { useAppStore } from "../../state/store.js";
import { TimelineRegion } from "./TimelineRegion.js";

function makeRow(idx: number): EventRow {
  return {
    idx,
    seq: idx,
    ts: 0,
    tsFmt: "12:00:00.000",
    dir: "c2s",
    dirGlyph: "→",
    kind: "request",
    kindTag: "REQ",
    method: "ping",
    actionType: null,
    actionFamily: null,
    sessionId: "s1",
    sessionShort: "s1",
    turnId: "t1",
    turnShort: "t1",
    keyId: `e${idx}`,
    status: "pending",
    latencyMs: null,
    latencyBand: null,
    payloadPreview: "",
    summary: `ping id=e${idx}`,
    pairIdx: null,
    parseErrorReason: null,
    lineIndex: idx + 1,
    errorCode: null,
    serverSeq: null,
    previousServerSeq: null,
    gapBefore: false,
    isAuthFailure: false,
  };
}

beforeEach(() => {
  useAppStore.setState({
    rows: [makeRow(0), makeRow(1), makeRow(2)],
    connection: "connected",
    selectedIdx: null,
    livePaused: false,
    pendingBuffer: [],
    pendingNewCount: 0,
    loadProgress: { phase: "idle", loadedRows: 0, loadedBytes: 0 },
    streamBacklog: { queuedFrames: 0, queuedRows: 0 },
    rotationNotice: false,
    meta: { filename: "x.jsonl", eventCount: 3, sessionCount: 1 },
    searchQuery: "",
    searchMatches: null,
    searchTotal: 0,
    searchTruncated: false,
    searchStatus: "idle",
    searchError: null,
    filters: EMPTY_FILTERS,
    grouping: "none",
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TimelineRegion — Plan 04-06 Task 2", () => {
  it("renders RotationBanner above the list when rotationNotice=true and self-dismisses after 5s", () => {
    vi.useFakeTimers();
    useAppStore.setState({ rotationNotice: true });
    render(<TimelineRegion />);
    expect(screen.getByTestId("rotation-banner")).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toContain(
      "Log rotated — reloading from new file.",
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(useAppStore.getState().rotationNotice).toBe(false);
  });

  it("does NOT render RotationBanner when rotationNotice=false", () => {
    render(<TimelineRegion />);
    expect(screen.queryByTestId("rotation-banner")).toBeNull();
  });

  it("renders progress-aware LoadingState while connecting with zero partial rows", () => {
    useAppStore.setState({
      rows: [],
      connection: "connecting",
      loadProgress: {
        phase: "loading",
        loadedRows: 0,
        loadedBytes: 50,
        totalBytes: 100,
        percent: 50,
      },
    });
    render(<TimelineRegion />);
    expect(screen.getByTestId("state-loading")).toBeInTheDocument();
    expect(screen.getByText("50% loaded")).toBeInTheDocument();
  });

  it("keeps partial rows visible with inline progress and stream backlog status", () => {
    useAppStore.setState({
      connection: "connecting",
      loadProgress: { phase: "loading", loadedRows: 3, loadedBytes: 64 },
      streamBacklog: { queuedFrames: 2, queuedRows: 8 },
    });
    render(<TimelineRegion />);
    expect(screen.getByTestId("timeline-region")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-load-progress").textContent).toContain("3 rows loaded");
    expect(screen.getByTestId("stream-backlog-pill").textContent).toContain("8 stream events queued");
    expect(screen.queryByTestId("new-events-pill")).toBeNull();
  });

  it("navigates between visible search matches", () => {
    useAppStore.setState({ searchQuery: "ping", searchMatches: new Set([0, 2]), searchTotal: 2 });
    render(<TimelineRegion />);
    window.dispatchEvent(new CustomEvent("ahp-search-nav", { detail: "next" }));
    expect(useAppStore.getState().selectedIdx).toBe(0);
    window.dispatchEvent(new CustomEvent("ahp-search-nav", { detail: "next" }));
    expect(useAppStore.getState().selectedIdx).toBe(2);
    window.dispatchEvent(new CustomEvent("ahp-search-nav", { detail: "previous" }));
    expect(useAppStore.getState().selectedIdx).toBe(0);
  });

  it("renders NewEventsPill when livePaused && pendingNewCount > 0; click flushes buffer + resumes", () => {
    useAppStore.setState({
      livePaused: true,
      pendingBuffer: [makeRow(3), makeRow(4)],
      pendingNewCount: 2,
    });
    render(<TimelineRegion />);
    const pill = screen.getByTestId("new-events-pill");
    expect(pill.textContent).toContain("2 new events");
    expect(pill.textContent).toContain("Resume Following");
    fireEvent.click(pill);
    const s = useAppStore.getState();
    expect(s.livePaused).toBe(false);
    expect(s.pendingNewCount).toBe(0);
    expect(s.pendingBuffer).toHaveLength(0);
    expect(s.rows).toHaveLength(5);
  });

  it("does NOT render NewEventsPill when livePaused but pendingNewCount === 0", () => {
    useAppStore.setState({ livePaused: true, pendingBuffer: [], pendingNewCount: 0 });
    render(<TimelineRegion />);
    expect(screen.queryByTestId("new-events-pill")).toBeNull();
  });

  it("does NOT render NewEventsPill when not paused", () => {
    useAppStore.setState({ livePaused: false, pendingNewCount: 5 });
    render(<TimelineRegion />);
    expect(screen.queryByTestId("new-events-pill")).toBeNull();
  });

  it("Space key on the region root toggles livePaused on/off", () => {
    render(<TimelineRegion />);
    const region = screen.getByTestId("timeline-region");
    region.focus();
    fireEvent.keyDown(region, { key: " ", code: "Space" });
    expect(useAppStore.getState().livePaused).toBe(true);
    fireEvent.keyDown(region, { key: " ", code: "Space" });
    expect(useAppStore.getState().livePaused).toBe(false);
  });

  it("Space key inside an <input> does NOT toggle livePaused (editable guard)", () => {
    render(
      <div>
        <TimelineRegion />
        <input data-testid="probe-input" />
      </div>,
    );
    // Place the input inside the region for an even stricter test:
    const region = screen.getByTestId("timeline-region");
    const input = document.createElement("input");
    region.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: " ", code: "Space" });
    expect(useAppStore.getState().livePaused).toBe(false);
  });

  it("Space key inside a <textarea> does NOT toggle livePaused", () => {
    render(<TimelineRegion />);
    const region = screen.getByTestId("timeline-region");
    const ta = document.createElement("textarea");
    region.appendChild(ta);
    ta.focus();
    fireEvent.keyDown(ta, { key: " ", code: "Space" });
    expect(useAppStore.getState().livePaused).toBe(false);
  });

  it("Space key inside a <select> does NOT toggle livePaused", () => {
    render(<TimelineRegion />);
    const region = screen.getByTestId("timeline-region");
    const sel = document.createElement("select");
    region.appendChild(sel);
    sel.focus();
    fireEvent.keyDown(sel, { key: " ", code: "Space" });
    expect(useAppStore.getState().livePaused).toBe(false);
  });

  it("Space key inside [contenteditable] does NOT toggle livePaused", () => {
    render(<TimelineRegion />);
    const region = screen.getByTestId("timeline-region");
    const ce = document.createElement("div");
    ce.setAttribute("contenteditable", "true");
    ce.contentEditable = "true";
    region.appendChild(ce);
    ce.focus();
    fireEvent.keyDown(ce, { key: " ", code: "Space" });
    expect(useAppStore.getState().livePaused).toBe(false);
  });

  it("renders pair highlight from stable row pairIdx metadata", async () => {
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(
      window.HTMLElement.prototype,
      "offsetHeight",
    );
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(
      window.HTMLElement.prototype,
      "offsetWidth",
    );
    Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 800,
    });
    const request = { ...makeRow(0), pairIdx: 1, status: "ok" as const };
    const response = {
      ...makeRow(1),
      kind: "response" as const,
      kindTag: "RES" as const,
      method: null,
      dir: "s2c" as const,
      dirGlyph: "←" as const,
      pairIdx: 0,
      status: "ok" as const,
    };
    useAppStore.setState({ rows: [request, response], selectedIdx: 1 });
    render(<TimelineRegion />);
    expect(await screen.findByTestId("row-0")).toHaveAttribute("data-pair-highlight", "request");
    expect(screen.getByTestId("row-1")).toHaveAttribute("data-selected", "true");
    if (originalOffsetHeight) {
      Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    }
    if (originalOffsetWidth) {
      Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
    }
  });
});
