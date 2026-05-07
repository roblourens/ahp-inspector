/**
 * Tests for FilterBar, ActiveFilterChips, NoResultsState, SearchingIndicator, SearchTruncatedBanner.
 * Environment: jsdom (packages/ui/vitest.config.ts)
 */

import type { EventRow } from "@ahp-viewer/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "../../state/filters.js";
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
    gapBefore: false,
    isAuthFailure: false,
    ...overrides,
  };
}

beforeEach(() => {
  useAppStore.setState({
    rows: [],
    filters: EMPTY_FILTERS,
    searchQuery: "",
    searchMatches: null,
    grouping: "none",
  });
});

afterEach(() => cleanup());

// ── FilterBar ─────────────────────────────────────────────────────────────────

describe("FilterBar", () => {
  it("renders the filter bar container", () => {
    render(<FilterBar />);
    expect(screen.getByTestId("filter-bar")).toBeTruthy();
  });

  it("renders a prominent SearchInput with placeholder and shortcut hint", () => {
    render(<FilterBar />);
    expect(screen.getByText("Search")).toBeTruthy();
    const input = screen.getByPlaceholderText("all JSON payloads, methods, ids, sessions...");
    expect(input).toBeTruthy();
    expect(input.getAttribute("aria-label")).toBe("Search all events");
    expect(screen.getByTitle("Press / to focus search")).toBeTruthy();
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

  it("opens FacetPopover when Dir chip is clicked", () => {
    render(<FilterBar />);
    const dirChip = screen.getByRole("button", { name: /Dir/i });
    fireEvent.click(dirChip);
    // popover role="listbox" should appear
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("does not clip facet popovers behind the timeline", () => {
    render(<FilterBar />);
    const bar = screen.getByTestId("filter-bar");
    expect(bar.style.overflow).toBe("visible");
    expect(bar.style.position).toBe("relative");
    expect(Number(bar.style.zIndex)).toBeGreaterThan(0);
  });

  it("uses readable labels for long session facet values", () => {
    useAppStore.setState({
      rows: [
        makeRow({
          sessionId: "copilot:/session/frontend-polish-2026-05-07",
          sessionShort: "frontend-polish",
        }),
      ],
    });
    render(<FilterBar />);
    fireEvent.click(screen.getByRole("button", { name: /Session/i }));

    expect(screen.getByText("frontend-polish")).toBeTruthy();
  });

  it("clicking GroupToggleChip opens a popover with grouping options", () => {
    render(<FilterBar />);
    const groupBtn = screen.getByRole("button", { name: /Group:/i });
    fireEvent.click(groupBtn);
    expect(screen.getByRole("radio", { name: "Session" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Session \+ Turn/i })).toBeTruthy();
  });

  it("selecting a grouping mode dispatches setGrouping", () => {
    render(<FilterBar />);
    const groupBtn = screen.getByRole("button", { name: /Group:/i });
    fireEvent.click(groupBtn);
    const sessionOption = screen.getByRole("radio", { name: "Session" });
    fireEvent.click(sessionOption);
    expect(useAppStore.getState().grouping).toBe("session");
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
    expect(screen.getByText("Dir: c2s")).toBeTruthy();
  });

  it("renders a search chip when searchQuery is non-empty", () => {
    useAppStore.setState({ searchQuery: "initialize" });
    render(<ActiveFilterChips />);
    expect(screen.getByText("initialize")).toBeTruthy();
  });

  it("truncates search chip label at 40 chars", () => {
    const longQuery = "a".repeat(50);
    useAppStore.setState({ searchQuery: longQuery });
    render(<ActiveFilterChips />);
    expect(screen.getByText(`${"a".repeat(40)}…`)).toBeTruthy();
  });

  it("dismissing a direction chip calls patchFilter('direction', [])", () => {
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, direction: ["c2s"] },
    });
    render(<ActiveFilterChips />);
    const dismissBtn = screen.getByRole("button", { name: /Remove filter Dir: c2s/i });
    fireEvent.click(dismissBtn);
    expect(useAppStore.getState().filters.direction).toEqual([]);
  });

  it("Clear all button calls clearFilters()", () => {
    useAppStore.setState({
      filters: { ...EMPTY_FILTERS, direction: ["c2s"] },
    });
    render(<ActiveFilterChips />);
    const clearBtn = screen.getByRole("button", { name: /Clear all filters and search/i });
    fireEvent.click(clearBtn);
    const state = useAppStore.getState();
    expect(state.filters.direction).toEqual([]);
    expect(state.searchQuery).toBe("");
  });

  it("clear-all button is visible whenever chips row is rendered", () => {
    useAppStore.setState({ searchQuery: "foo" });
    render(<ActiveFilterChips />);
    expect(screen.getByRole("button", { name: /Clear all filters and search/i })).toBeTruthy();
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
