// TimelineRegion tests — Plan 04-06 Task 2.
// Covers: live-pause Space-key shortcut (with editable-target guards),
// RotationBanner mount + auto-dismiss, NewEventsPill mount when paused.

import type { EventRow } from "@ahp-viewer/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../state/store.js";
import { TimelineRegion } from "./TimelineRegion.js";

function makeRow(idx: number): EventRow {
  return {
    kind: "event",
    idx,
    ts: idx,
    direction: "request",
    eventKind: "chat",
    sessionId: "s1",
    turnId: "t1",
    eventId: `e${idx}`,
    status: null,
    latencyMs: null,
    latencyBand: null,
    eventName: "x",
    payloadPreview: "",
  } as unknown as EventRow;
}

beforeEach(() => {
  useAppStore.setState({
    rows: [makeRow(0), makeRow(1), makeRow(2)],
    connection: "connected",
    selectedIdx: null,
    livePaused: false,
    pendingBuffer: [],
    pendingNewCount: 0,
    rotationNotice: false,
    meta: { filename: "x.jsonl", eventCount: 3, sessionCount: 1 },
    searchQuery: "",
    searchMatches: null,
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
});
