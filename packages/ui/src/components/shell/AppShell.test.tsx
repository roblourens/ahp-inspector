// AppShell tests (Plan 04-05 Task 3).
// Heavy modules (TimelineRegion / DetailPanel / FilterBar) are mocked so the
// tests focus on Plan-04-05 wiring: WatchErrorBanner, LogPickerPanel, SwitchLogButton,
// and the negative — RotationBanner is NOT rendered by AppShell.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  openSessionByCandidate: vi.fn().mockResolvedValue({
    active: {
      logKey: "opened-key",
      meta: { filename: "opened.jsonl", sizeBytes: 1, startedAt: 2, logKey: "opened-key" },
    },
  }),
  openSessionByPath: vi.fn().mockResolvedValue({
    active: {
      logKey: "opened-key",
      meta: { filename: "opened.jsonl", sizeBytes: 1, startedAt: 2, logKey: "opened-key" },
    },
  }),
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
import { DESKTOP_WIDTH, NARROW_WIDTH, setViewportWidth } from "../../test-fixtures/viewport.js";
import { fetchCandidates, openSessionByCandidate } from "../../transport/sessions-client.js";
import { connectLogStream } from "../../transport/sse-client.js";
import { AppShell } from "./AppShell.js";

beforeEach(() => {
  // Reset relevant store slices.
  useAppStore.setState({
    rows: [],
    connection: "connected",
    selectedIdx: null,
    selectionSource: "explicit",
    meta: { filename: "x.jsonl", eventCount: 0, sessionCount: 0 },
    lastWatchError: null,
    rotationNotice: false,
    lastOpenRef: null,
    searchQuery: "",
    searchMatches: null,
    grouping: "none",
    persistenceError: null,
  });
  vi.clearAllMocks();
  delete window.__ahpStream;
});

afterEach(() => {
  cleanup();
  delete window.__ahpStream;
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

  it("selecting a switch-log candidate replaces the previous EventSource handle", async () => {
    const oldHandle = { close: vi.fn() };
    const newHandle = { close: vi.fn() };
    window.__ahpStream = oldHandle;
    vi.mocked(fetchCandidates).mockResolvedValue([
      {
        id: "cand-next",
        label: "next.jsonl",
        origin: "vscode",
        confidence: "high",
        mtimeMs: Date.now(),
        sizeBytes: 128,
      },
    ]);
    vi.mocked(connectLogStream).mockReturnValue(newHandle);

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Switch log" }));
    fireEvent.click(await screen.findByText("next"));

    await waitFor(() => expect(openSessionByCandidate).toHaveBeenCalledWith("cand-next"));
    expect(oldHandle.close).toHaveBeenCalled();
    expect(connectLogStream).toHaveBeenCalled();
    expect(window.__ahpStream).toBe(newHandle);
    expect(useAppStore.getState().logKey).toBe("opened-key");
  });

  it("clears stale log-local state before opening the replacement stream", async () => {
    useAppStore.setState({
      rows: [],
      selectedIdx: 7,
      searchQuery: "stale",
      searchMatches: new Set([7]),
      searchStatus: "searching",
      pendingNewCount: 3,
      pendingBuffer: [],
      logKey: "old-key",
    });
    vi.mocked(fetchCandidates).mockResolvedValue([
      {
        id: "cand-next",
        label: "next.jsonl",
        origin: "vscode",
        confidence: "high",
        mtimeMs: Date.now(),
        sizeBytes: 128,
      },
    ]);
    let stateAtConnect: ReturnType<typeof useAppStore.getState> | undefined;
    vi.mocked(connectLogStream).mockImplementation(() => {
      stateAtConnect = useAppStore.getState();
      return { close: vi.fn() };
    });

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Switch log" }));
    fireEvent.click(await screen.findByText("next"));

    await waitFor(() => expect(connectLogStream).toHaveBeenCalled());
    expect(stateAtConnect).toMatchObject({
      rows: [],
      selectedIdx: null,
      searchQuery: "",
      searchMatches: null,
      searchStatus: "idle",
      pendingNewCount: 0,
      pendingBuffer: [],
      logKey: "opened-key",
      lastOpenRef: { kind: "candidate", id: "cand-next" },
    });
  });

  it("keeps the picker open with sanitized retry feedback when a candidate fails", async () => {
    vi.mocked(fetchCandidates).mockResolvedValue([
      {
        id: "cand-retry",
        label: "retry.jsonl",
        origin: "vscode",
        confidence: "high",
        mtimeMs: Date.now(),
        sizeBytes: 128,
      },
    ]);
    vi.mocked(openSessionByCandidate).mockRejectedValueOnce(
      Object.assign(new Error("sensitive host detail"), { code: "not-found" }),
    );

    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Switch log" }));
    const candidate = await screen.findByText("retry");
    fireEvent.click(candidate);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "File not found. Check the path and try again.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("sensitive host detail");
    expect(screen.getByRole("dialog", { name: /switch log/i })).toBeInTheDocument();

    fireEvent.click(screen.getByText("retry"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /switch log/i })).toBeNull());
    expect(openSessionByCandidate).toHaveBeenCalledTimes(2);
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

describe("AppShell — responsive detail layout", () => {
  it("renders desktop detail side rail at 1400px and above", () => {
    setViewportWidth(DESKTOP_WIDTH);
    useAppStore.setState({ selectedIdx: 0 });
    render(<AppShell />);
    expect(screen.getByTestId("detail-panel-wrapper")).toBeInTheDocument();
    expect(screen.queryByTestId("detail-drawer")).toBeNull();
  });

  it("renders selected details in an overlay drawer below 1400px", () => {
    setViewportWidth(NARROW_WIDTH);
    useAppStore.setState({ selectedIdx: 0 });
    render(<AppShell />);
    expect(screen.queryByTestId("detail-panel-wrapper")).toBeNull();
    expect(screen.getByTestId("detail-drawer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close details" })).toBeInTheDocument();
  });

  it("closes the drawer with Escape", () => {
    setViewportWidth(NARROW_WIDTH);
    useAppStore.setState({ selectedIdx: 0 });
    render(<AppShell />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useAppStore.getState().selectedIdx).toBeNull();
  });

  it("does not open the narrow drawer for search-driven selection (D-02)", () => {
    setViewportWidth(NARROW_WIDTH);
    render(<AppShell />);
    act(() => useAppStore.getState().selectIdx(0, "search"));
    expect(screen.queryByTestId("detail-drawer")).toBeNull();
  });

  it("opens the narrow drawer for explicit selection (D-04)", () => {
    setViewportWidth(NARROW_WIDTH);
    render(<AppShell />);
    act(() => useAppStore.getState().selectIdx(0, "explicit"));
    expect(screen.getByTestId("detail-drawer")).toBeInTheDocument();
  });

  it("keeps the drawer closed after search-select then clearSelection (D-03)", () => {
    setViewportWidth(NARROW_WIDTH);
    render(<AppShell />);
    act(() => useAppStore.getState().selectIdx(0, "search"));
    act(() => useAppStore.getState().clearSelection());
    expect(screen.queryByTestId("detail-drawer")).toBeNull();
  });

  it("syncs the desktop rail for search-driven selection (D-01)", () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(<AppShell />);
    act(() => useAppStore.getState().selectIdx(0, "search"));
    expect(screen.getByTestId("detail-panel-wrapper")).toBeInTheDocument();
  });
});

describe("AppShell — drop overlay mount", () => {
  it("dragenter on window mounts the DropOverlay armed when no log is active", () => {
    render(<AppShell />);
    const event = new Event("dragenter", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: { types: ["Files"], getData: () => "" },
      configurable: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getByRole("region", { name: /drop a log file/i })).toBeInTheDocument();
  });
});
