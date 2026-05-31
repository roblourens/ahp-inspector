/**
 * Tests for FilterBar, ActiveFilterChips, NoResultsState, SearchingIndicator, SearchTruncatedBanner.
 * Environment: jsdom (packages/ui/vitest.config.ts)
 */

import type { EventRow } from "@ahp-inspector/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_DEFAULT_FILTERS, EMPTY_FILTERS } from "../../state/filters.js";
import { useAppStore } from "../../state/store.js";
import { NoResultsState } from "../states/NoResultsState.js";
import { SearchingIndicator } from "../states/SearchingIndicator.js";
import { SearchTruncatedBanner } from "../states/SearchTruncatedBanner.js";
import { ActiveFilterChips } from "./ActiveFilterChips.js";
import { FilterBar } from "./FilterBar.js";

function makeRow(overrides: Partial<EventRow> = {}): EventRow {
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
    sessionId: "session-a",
    sessionShort: "ssion-a",
    turnId: null,
    turnShort: null,
    keyId: "1",
    status: "ok",
    latencyMs: 10,
    latencyBand: "fast",
    payloadPreview: "{}",
    parseErrorReason: null,
    lineIndex: null,
    errorCode: null,
    serverSeq: null,
    previousServerSeq: null,
    gapBefore: false,
    isAuthFailure: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  useAppStore.setState({
    rows: [],
    filters: EMPTY_FILTERS,
    searchQuery: "",
    searchMatches: null,
    searchTotal: 0,
    searchTruncated: false,
    searchStatus: "idle",
    searchError: null,
    grouping: "none",
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── FilterBar ─────────────────────────────────────────────────────────────────

describe("FilterBar", () => {
  it("renders the filter bar container", () => {
    render(<FilterBar />);
    expect(screen.getByTestId("filter-bar")).toBeTruthy();
  });

  it("renders a SearchTrigger button and SearchPopover on demand", () => {
    render(<FilterBar />);
    // SearchTrigger should be visible
    const trigger = screen.getByRole("button", { name: "Open search" });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("title")).toBe("Press / to open search");
    
    // SearchPopover should not be visible initially
    expect(screen.queryByTestId("search-popover")).toBeFalsy();
    
    // Click trigger to open popover
    fireEvent.click(trigger);
    
    // SearchPopover and input should now be visible
    expect(screen.getByTestId("search-popover")).toBeTruthy();
    const input = screen.getByPlaceholderText("all JSON payloads, methods, ids, sessions...");
    expect(input).toBeTruthy();
    expect(input.getAttribute("aria-label")).toBe("Search all events");
  });

  it("opens the search popover and focuses the input on cmd+f", () => {
    render(<FilterBar />);
    expect(screen.queryByTestId("search-popover")).toBeFalsy();

    const result = fireEvent.keyDown(document, { key: "f", metaKey: true });

    // fireEvent returns false when a handler called preventDefault.
    expect(result).toBe(false);
    expect(screen.getByTestId("search-popover")).toBeTruthy();
    vi.advanceTimersByTime(0);
    const input = screen.getByPlaceholderText("all JSON payloads, methods, ids, sessions...");
    expect(document.activeElement).toBe(input);
  });

  it("opens the search popover on ctrl+f", () => {
    render(<FilterBar />);
    expect(screen.queryByTestId("search-popover")).toBeFalsy();

    fireEvent.keyDown(document, { key: "f", ctrlKey: true });

    expect(screen.getByTestId("search-popover")).toBeTruthy();
  });

  it("does not open the search popover on a plain 'f' keypress", () => {
    render(<FilterBar />);
    fireEvent.keyDown(document, { key: "f" });
    expect(screen.queryByTestId("search-popover")).toBeFalsy();
  });

  it("opens the popover and focuses the input when the trigger is clicked", () => {
    render(<FilterBar />);
    const trigger = screen.getByRole("button", { name: "Open search" });

    fireEvent.click(trigger);

    expect(screen.getByTestId("search-popover")).toBeTruthy();
    vi.advanceTimersByTime(0);
    const input = screen.getByPlaceholderText("all JSON payloads, methods, ids, sessions...");
    expect(document.activeElement).toBe(input);
  });

  it("still opens the search popover on the '/' shortcut", () => {
    render(<FilterBar />);
    expect(screen.queryByTestId("search-popover")).toBeFalsy();

    fireEvent.keyDown(document, { key: "/" });

    expect(screen.getByTestId("search-popover")).toBeTruthy();
  });

  it("renders Filter rows as a separate local timeline input", () => {
    render(<FilterBar />);
    const input = screen.getByLabelText("Filter rows") as HTMLInputElement;
    expect(input.placeholder).toBe("Filter visible rows...");

    fireEvent.change(input, { target: { value: "tool/call" } });

    expect(useAppStore.getState().filters.rowText).toBe("tool/call");
    expect(useAppStore.getState().searchQuery).toBe("");
  });

  it("clears Filter rows without clearing Search", () => {
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, rowText: "needle" },
      searchQuery: "payload search",
    });
    render(<FilterBar />);

    fireEvent.click(screen.getByRole("button", { name: "Clear row filter" }));

    expect(useAppStore.getState().filters.rowText).toBe("");
    expect(useAppStore.getState().searchQuery).toBe("payload search");
  });

  it("renders all 8 facet chips", () => {
    render(<FilterBar />);
    // Each FacetChip renders as a button with aria-haspopup
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-haspopup") === "listbox");
    // 8 facets + group toggle = 9 buttons with aria-haspopup
    expect(buttons.length).toBeGreaterThanOrEqual(8);
  });

  it("renders GroupToggleChip", () => {
    render(<FilterBar />);
    expect(screen.getByText(/Group:/)).toBeTruthy();
  });

  it("renders ResultCounter with total events", () => {
    useAppStore.setState({ rows: [makeRow(), makeRow({ idx: 1 })] });
    render(<FilterBar />);
    expect(screen.getByText("2 events")).toBeTruthy();
  });

  it("shows the focused search result position and navigation controls when query has results", () => {
    useAppStore.setState({
      searchQuery: "initialize",
      searchMatches: new Set([0, 2]),
      searchTotal: 2,
      searchStatus: "ready",
      selectedIdx: 2,
    });
    render(<FilterBar />);
    // Open the SearchPopover to see search status and navigation controls
    const trigger = screen.getByRole("button", { name: "Open search" });
    fireEvent.click(trigger);
    
    expect(screen.getByTestId("search-status").textContent).toContain("2 of 2 matches");
    expect(screen.getByRole("button", { name: "Previous search match" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next search match" })).toBeTruthy();
  });

  it("opens FacetPopover when Dir chip is clicked", () => {
    render(<FilterBar />);
    const dirChip = screen.getByRole("button", { name: /Dir/i });
    fireEvent.click(dirChip);
    // popover role="listbox" should appear
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("closes an open facet popover when its chip is clicked again", () => {
    render(<FilterBar />);
    const dirChip = screen.getByRole("button", { name: /Dir/i });
    fireEvent.click(dirChip);
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.mouseDown(dirChip);
    fireEvent.click(dirChip);

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not clip facet popovers behind the timeline", () => {
    render(<FilterBar />);
    const bar = screen.getByTestId("filter-bar");
    expect(bar.className).toContain("filter-bar");
    expect(bar.style.position).toBe("relative");
    expect(Number(bar.style.zIndex)).toBeGreaterThan(0);
  });

  it("uses readable labels for long channel facet values", () => {
    useAppStore.setState({
      rows: [
        makeRow({
          sessionId: "copilot:/session/frontend-polish-2026-05-07",
          sessionShort: "frontend-polish",
        }),
      ],
    });
    render(<FilterBar />);
    fireEvent.click(screen.getByRole("button", { name: /Channel/i }));

    expect(screen.getByText("frontend-polish")).toBeTruthy();
  });

  it("opens Method with discovered methods checked except ping by default", () => {
    useAppStore.setState({
      rows: [makeRow({ idx: 0, method: "initialize" }), makeRow({ idx: 1, method: "ping" })],
      filters: APP_DEFAULT_FILTERS,
    });
    render(<FilterBar />);
    fireEvent.click(screen.getByRole("button", { name: /Method/i }));

    const initialize = screen.getByRole("checkbox", { name: /initialize/i }) as HTMLInputElement;
    const ping = screen.getByRole("checkbox", { name: /ping/i }) as HTMLInputElement;
    expect(initialize.checked).toBe(true);
    expect(ping.checked).toBe(false);
  });

  it("unchecking a Method option adds it to hidden methods", () => {
    useAppStore.setState({
      rows: [makeRow({ idx: 0, method: "initialize" }), makeRow({ idx: 1, method: "ping" })],
      filters: APP_DEFAULT_FILTERS,
    });
    render(<FilterBar />);
    fireEvent.click(screen.getByRole("button", { name: /Method/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /initialize/i }));

    expect(useAppStore.getState().filters.method).toEqual(["ping", "initialize"]);
  });

  it("uses checked-visible behavior for Direction and stores unchecked values as hidden", () => {
    useAppStore.setState({
      rows: [makeRow({ idx: 0, dir: "c2s" }), makeRow({ idx: 1, dir: "s2c" })],
      filters: EMPTY_FILTERS,
    });
    render(<FilterBar />);
    fireEvent.click(screen.getByRole("button", { name: /Dir/i }));

    const clientToServer = screen.getByRole("checkbox", { name: /c2s/i }) as HTMLInputElement;
    const serverToClient = screen.getByRole("checkbox", { name: /s2c/i }) as HTMLInputElement;
    expect(clientToServer.checked).toBe(true);
    expect(serverToClient.checked).toBe(true);

    fireEvent.click(clientToServer);
    expect(useAppStore.getState().filters.direction).toEqual(["c2s"]);
  });

  it("provides Select all and Uncheck all commands over complete facet options", () => {
    useAppStore.setState({
      rows: [makeRow({ idx: 0, method: "initialize" }), makeRow({ idx: 1, method: "ping" })],
      filters: APP_DEFAULT_FILTERS,
    });
    render(<FilterBar />);
    fireEvent.click(screen.getByRole("button", { name: /Method/i }));

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(useAppStore.getState().filters.method).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Uncheck all" }));
    expect(useAppStore.getState().filters.method).toEqual(["initialize", "ping"]);
  });

  it("keeps Turn operable while every Channel is visible", () => {
    useAppStore.setState({
      rows: [makeRow({ turnId: "turn-a", turnShort: "turn-a" })],
      filters: EMPTY_FILTERS,
    });
    render(<FilterBar />);

    const turn = screen.getByRole("button", { name: /Turn/i }) as HTMLButtonElement;
    expect(turn.disabled).toBe(false);
    fireEvent.click(turn);
    expect(screen.getByRole("checkbox", { name: /turn-a/i })).toBeTruthy();
  });

  it("clicking GroupToggleChip opens a popover with grouping options", () => {
    render(<FilterBar />);
    const groupBtn = screen.getByRole("button", { name: /Group:/i });
    fireEvent.click(groupBtn);
    expect(screen.getByRole("radio", { name: "Session" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Session \+ Turn/i })).toBeTruthy();
  });

  it("closes the grouping popover when GroupToggleChip is clicked again", () => {
    render(<FilterBar />);
    const groupBtn = screen.getByRole("button", { name: /Group:/i });
    fireEvent.click(groupBtn);
    expect(screen.getByRole("radio", { name: "Session" })).toBeTruthy();

    fireEvent.mouseDown(groupBtn);
    fireEvent.click(groupBtn);

    expect(screen.queryByRole("radio", { name: "Session" })).toBeNull();
  });

  it("selecting a grouping mode dispatches setGrouping", () => {
    render(<FilterBar />);
    const groupBtn = screen.getByRole("button", { name: /Group:/i });
    fireEvent.click(groupBtn);
    const sessionOption = screen.getByRole("radio", { name: "Session" });
    fireEvent.click(sessionOption);
    expect(useAppStore.getState().grouping).toBe("session");
  });

  it("Enter in the search input dispatches ahp-search-nav next", () => {
    useAppStore.setState({ searchQuery: "initialize" });
    render(<FilterBar />);
    // Open the SearchPopover first
    const trigger = screen.getByRole("button", { name: "Open search" });
    fireEvent.click(trigger);
    
    const input = screen.getByPlaceholderText("all JSON payloads, methods, ids, sessions...");
    const events: ("previous" | "next")[] = [];
    const onNav = (e: Event): void => {
      events.push((e as CustomEvent<"previous" | "next">).detail);
    };
    window.addEventListener("ahp-search-nav", onNav);
    try {
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    } finally {
      window.removeEventListener("ahp-search-nav", onNav);
    }
    expect(events).toEqual(["next", "previous"]);
  });

  it("Enter with empty query does not dispatch ahp-search-nav", () => {
    useAppStore.setState({ searchQuery: "" });
    render(<FilterBar />);
    // Open the SearchPopover first
    const trigger = screen.getByRole("button", { name: "Open search" });
    fireEvent.click(trigger);
    
    const input = screen.getByPlaceholderText("all JSON payloads, methods, ids, sessions...");
    const events: string[] = [];
    const onNav = (e: Event): void => {
      events.push((e as CustomEvent<"previous" | "next">).detail);
    };
    window.addEventListener("ahp-search-nav", onNav);
    try {
      fireEvent.keyDown(input, { key: "Enter" });
    } finally {
      window.removeEventListener("ahp-search-nav", onNav);
    }
    expect(events).toEqual([]);
  });
});

// ── ActiveFilterChips ─────────────────────────────────────────────────────────

describe("ActiveFilterChips", () => {
  it("renders nothing when no filters or search", () => {
    const { container } = render(<ActiveFilterChips />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the chips row when direction filter is active", () => {
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, direction: ["c2s"] },
    });
    render(<ActiveFilterChips />);
    expect(screen.getByTestId("active-filter-chips")).toBeTruthy();
    expect(screen.getByText("Hidden Dir: c2s")).toBeTruthy();
  });

  it("does not render a search chip when searchQuery is non-empty", () => {
    useAppStore.setState({ searchQuery: "initialize" });
    render(<ActiveFilterChips />);
    expect(screen.queryByTestId("active-filter-chips")).toBeNull();
  });

  it("keeps search text out of filter chips", () => {
    const longQuery = "a".repeat(50);
    useAppStore.setState({ searchQuery: longQuery });
    render(<ActiveFilterChips />);
    expect(screen.queryByText(`${"a".repeat(40)}…`)).toBeNull();
  });

  it("dismissing a hidden direction chip makes it visible again", () => {
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, direction: ["c2s"] },
    });
    render(<ActiveFilterChips />);
    const dismissBtn = screen.getByRole("button", { name: /Show Dir: c2s/i });
    fireEvent.click(dismissBtn);
    expect(useAppStore.getState().filters.direction).toEqual([]);
  });

  it("renders method exclusions as hidden Method chips and dismissing them shows the method", () => {
    useAppStore.setState({ filters: APP_DEFAULT_FILTERS });
    render(<ActiveFilterChips />);
    expect(screen.getByText("Hidden Method: ping")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Show Method: ping/i }));
    expect(useAppStore.getState().filters.method).toEqual([]);
  });

  it("renders row-text and hidden Channel constraints without exposing Search", () => {
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, session: ["channel-a"], rowText: "tool result" },
      searchQuery: "raw payload query",
    });
    render(<ActiveFilterChips />);

    expect(screen.getByText("Rows contain: tool result")).toBeTruthy();
    expect(screen.getByText("Hidden Channel: channel-a")).toBeTruthy();
    expect(screen.queryByText(/raw payload query/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear row filter" }));
    expect(useAppStore.getState().filters.rowText).toBe("");
    expect(useAppStore.getState().searchQuery).toBe("raw payload query");
  });

  it("Clear all button calls clearFilters()", () => {
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, direction: ["c2s"] },
    });
    render(<ActiveFilterChips />);
    const clearBtn = screen.getByRole("button", { name: /Clear all filters/i });
    fireEvent.click(clearBtn);
    const state = useAppStore.getState();
    expect(state.filters.direction).toEqual([]);
  });

  it("Clear all button does not clear search", () => {
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, direction: ["c2s"] },
      searchQuery: "foo",
      searchMatches: new Set([0]),
    });
    render(<ActiveFilterChips />);
    fireEvent.click(screen.getByRole("button", { name: /Clear all filters/i }));
    const state = useAppStore.getState();
    expect(state.filters.direction).toEqual([]);
    expect(state.searchQuery).toBe("foo");
    expect(state.searchMatches).toEqual(new Set([0]));
  });

  it("clear-all button is visible whenever chips row is rendered", () => {
    useAppStore.setState({ filters: { ...EMPTY_FILTERS, direction: ["c2s"] } });
    render(<ActiveFilterChips />);
    expect(screen.getByRole("button", { name: /Clear all filters/i })).toBeTruthy();
  });
});

// ── NoResultsState ────────────────────────────────────────────────────────────

describe("NoResultsState", () => {
  it("renders filters variant with correct heading", () => {
    render(<NoResultsState kind="filters" onClear={vi.fn()} />);
    expect(screen.getByText("No events match your filters")).toBeTruthy();
    expect(screen.getByText("Try removing a filter or expanding the time range.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeTruthy();
  });

  it("renders search variant with correct copy", () => {
    render(<NoResultsState kind="search" onClear={vi.fn()} />);
    expect(screen.getByText("No events match your search")).toBeTruthy();
    expect(screen.getByText(/Try a shorter or different query/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeTruthy();
  });

  it("renders combined variant with correct copy", () => {
    render(<NoResultsState kind="combined" onClear={vi.fn()} />);
    expect(screen.getByText("No events match your search and filters")).toBeTruthy();
    expect(screen.getByText("Try removing a filter or shortening your query.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();
  });

  it("renders search-error variant with error message", () => {
    const retry = vi.fn();
    render(
      <NoResultsState
        kind="search-error"
        onClear={vi.fn()}
        onRetry={retry}
        errorMessage="Connection refused"
      />,
    );
    expect(screen.getByText("Search failed")).toBeTruthy();
    expect(screen.getByText("Connection refused")).toBeTruthy();
    const btn = screen.getByRole("button", { name: "Retry search" });
    fireEvent.click(btn);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("onClear is called when action button is clicked (filters kind)", () => {
    const clear = vi.fn();
    render(<NoResultsState kind="filters" onClear={clear} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(clear).toHaveBeenCalledTimes(1);
  });
});

// ── SearchingIndicator ────────────────────────────────────────────────────────

describe("SearchingIndicator", () => {
  it("renders with candidate count", () => {
    render(<SearchingIndicator candidateCount={1234} />);
    expect(screen.getByTestId("searching-indicator")).toBeTruthy();
    expect(screen.getByText(/Searching 1234 events/)).toBeTruthy();
  });
});

// ── SearchTruncatedBanner ─────────────────────────────────────────────────────

describe("SearchTruncatedBanner", () => {
  it("renders shown and total", () => {
    render(<SearchTruncatedBanner shown={5000} total={12431} />);
    expect(screen.getByTestId("search-truncated-banner")).toBeTruthy();
    expect(screen.getByText(/Showing first 5,000 of 12,431\+ matches/)).toBeTruthy();
  });
});
