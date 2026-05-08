// AppShell tests (Plan 04-05 Task 3).
// Heavy modules (TimelineRegion / DetailPanel / FilterBar) are mocked so the
// tests focus on Plan-04-05 wiring: WatchErrorBanner, LogPickerPanel, SwitchLogButton,
// and the negative — RotationBanner is NOT rendered by AppShell.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../timeline/TimelineRegion.js", () => ({
  TimelineRegion: (): JSX.Element => <div data-testid="timeline-region-stub" />,
}));
vi.mock("../timeline/StickyGroupBar.js", () => ({
  StickyGroupBar: (): JSX.Element => <div />,
}));
vi.mock("../detail/index.js", () => ({
  DetailPanel: (): JSX.Element => <div data-testid="detail-panel-stub" />,
}));
vi.mock("../filters/index.js", () => ({
  FilterBar: (): JSX.Element => <div />,
  ActiveFilterChips: (): JSX.Element => <div />,
}));
vi.mock("../filters/useSearch.js", () => ({
  useSearch: (): void => {},
}));
vi.mock("../../transport/sessions-client.js", () => ({
  fetchCandidates: vi.fn().mockResolvedValue([]),
  openSessionByCandidate: vi.fn().mockResolvedValue(undefined),
  openSessionByPath: vi.fn().mockResolvedValue(undefined),
  SessionOpenError: class extends Error {
    constructor(
      public code: string,
      msg: string,
    ) {
      super(msg);
    }
  },
}));
vi.mock("../../transport/sse-client.js", () => ({
  connectLogStream: vi.fn(() => ({ close: vi.fn() })),
}));

import { useAppStore } from "../../state/store.js";
import { fetchCandidates, openSessionByCandidate } from "../../transport/sessions-client.js";
import { connectLogStream } from "../../transport/sse-client.js";
import { AppShell } from "./AppShell.js";

beforeEach(() => {
  // Reset relevant store slices.
  useAppStore.setState({
    rows: [],
    connection: "connected",
    selectedIdx: null,
    meta: { filename: "x.jsonl", eventCount: 0, sessionCount: 0 },
    lastWatchError: null,
    rotationNotice: false,
    lastOpenRef: null,
    searchQuery: "",
    searchMatches: null,
    grouping: "none",
  });
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AppShell — Plan 04-05 wiring", () => {
  it("renders WatchErrorBanner with mapped 'file read error' copy when code is read-error", () => {
    useAppStore.setState({
      lastWatchError: { code: "read-error", message: "raw os string here" },
    });
    render(<AppShell />);
    expect(screen.getByTestId("watch-error-banner").textContent).toContain(
      "Watch error: file read error",
    );
    // Negative: raw OS message must NOT appear in banner copy.
    expect(screen.getByTestId("watch-error-banner").textContent).not.toContain(
      "raw os string here",
    );
  });

  it("renders WatchErrorBanner with 'watcher stopped' copy when code is watch-fatal and Reopen calls openSessionByCandidate", async () => {
    useAppStore.setState({
      lastWatchError: { code: "watch-fatal", message: "" },
      lastOpenRef: { kind: "candidate", id: "cand-42" },
    });
    render(<AppShell />);
    expect(screen.getByTestId("watch-error-banner").textContent).toContain(
      "Watch error: watcher stopped",
    );
    fireEvent.click(screen.getByText("Reopen log"));
    // The handler is async — flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect(openSessionByCandidate).toHaveBeenCalledWith("cand-42");
  });

  it("Retry Connection button calls connectLogStream", () => {
    useAppStore.setState({
      lastWatchError: { code: "read-error", message: "" },
    });
    render(<AppShell />);
    fireEvent.click(screen.getByText("Retry Connection"));
    expect(connectLogStream).toHaveBeenCalled();
  });

  it("clicking SwitchLogButton opens LogPickerPanel and triggers fetchCandidates", () => {
    render(<AppShell />);
    expect(screen.queryByRole("dialog", { name: /switch log/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Switch log" }));
    expect(screen.getByRole("dialog", { name: /switch log/i })).toBeInTheDocument();
    expect(fetchCandidates).toHaveBeenCalled();
  });

  it("clicking SwitchLogButton twice toggles the panel closed", () => {
    render(<AppShell />);
    const btn = screen.getByRole("button", { name: "Switch log" });
    fireEvent.click(btn);
    expect(screen.getByRole("dialog", { name: /switch log/i })).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole("dialog", { name: /switch log/i })).toBeNull();
  });

  it("does NOT render RotationBanner even when rotationNotice is true (TimelineRegion owns it)", () => {
    useAppStore.setState({ rotationNotice: true });
    render(<AppShell />);
    // No element with the rotation copy should be rendered at the AppShell level.
    expect(screen.queryByText(/Log rotated/)).toBeNull();
    expect(screen.queryByTestId("rotation-banner")).toBeNull();
  });
});
