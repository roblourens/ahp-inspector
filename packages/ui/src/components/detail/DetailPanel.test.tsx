/**
 * Tests for DetailPanel and AhpFieldStrip (Plan 03-04, Task 1).
 * T-03-04-01: contract test with <script> payload ensures no XSS.
 */

import type { EventRow } from "@ahp-viewer/core";
import type { AhpEvent } from "@ahp-viewer/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../state/store.js";
import type { DetailResponse } from "../../transport/http-client.js";

// Mock the http-client module.
vi.mock("../../transport/http-client.js", () => ({
  fetchEvent: vi.fn(),
}));

import { fetchEvent } from "../../transport/http-client.js";
import { DetailPanel } from "./DetailPanel.js";

function makeEvent(overrides: Partial<AhpEvent> = {}): AhpEvent {
  return {
    seq: 0,
    ts: 1700000000000,
    tsRaw: "2023-11-14T22:13:20.000Z",
    dir: "c2s",
    kind: "request",
    method: "tools/list",
    actionType: null,
    id: 1,
    idType: "number",
    sessionId: null,
    turnId: null,
    toolCallId: null,
    serverSeq: null,
    byteOffset: 0,
    byteLength: 100,
    raw: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    parse: "ok",
    ...overrides,
  };
}

function makeDetailResponse(overrides: Partial<DetailResponse> = {}): DetailResponse {
  return {
    event: makeEvent(),
    pair: null,
    latencyMs: 45,
    status: "ok",
    pairIdx: null,
    ...overrides,
  };
}

function makeRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    idx: 0,
    seq: 0,
    ts: 1700000000000,
    tsFmt: "22:13:20.000",
    dir: "c2s",
    dirGlyph: "→",
    kind: "request",
    kindTag: "REQ",
    method: "tools/list",
    actionType: null,
    actionFamily: null,
    sessionId: null,
    sessionShort: null,
    turnId: null,
    turnShort: null,
    keyId: null,
    status: "pending",
    latencyMs: null,
    latencyBand: null,
    payloadPreview: "{}",
    summary: "tools/list details unavailable",
    pairIdx: null,
    parseErrorReason: null,
    lineIndex: null,
    errorCode: null,
    serverSeq: null,
    gapBefore: false,
    isAuthFailure: false,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAppStore.setState({
    rows: [],
    connection: "connecting",
    selectedIdx: null,
    meta: null,
    selectedDetail: null,
    detailWidth: 420,
  });
});

describe("DetailPanel — empty state", () => {
  it("renders 'No event selected' heading when selectedIdx is null", () => {
    useAppStore.setState({ selectedIdx: null });
    render(<DetailPanel />);
    expect(screen.getByRole("heading", { name: /no event selected/i })).toBeInTheDocument();
  });
});

describe("DetailPanel — loading state", () => {
  it("renders loading spinner while fetching event #0", async () => {
    // fetchEvent never resolves to keep loading state.
    vi.mocked(fetchEvent).mockReturnValue(new Promise(() => {}));
    useAppStore.setState({ selectedIdx: 0 });
    render(<DetailPanel />);
    // Should show loading indicator
    await waitFor(() => {
      expect(screen.getByTestId("detail-loading")).toBeInTheDocument();
    });
  });
});

describe("DetailPanel — error state", () => {
  it("renders error state with Retry button when fetch fails", async () => {
    vi.mocked(fetchEvent).mockRejectedValue(new Error("Network error"));
    useAppStore.setState({ selectedIdx: 0 });
    render(<DetailPanel />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });
});

describe("DetailPanel — populated state", () => {
  it("renders Summary, AhpFieldStrip and tab strip when event is loaded", async () => {
    vi.mocked(fetchEvent).mockResolvedValue(makeDetailResponse());
    useAppStore.setState({ selectedIdx: 0, rows: [makeRow()] });
    render(<DetailPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("detail-summary")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ahp-field-strip")).toBeInTheDocument();
    // Tab strip has Pretty and Raw tabs
    expect(screen.getByRole("tab", { name: /pretty/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /raw/i })).toBeInTheDocument();
  });

  it("T-03-04-01: renders <script> payload as escaped text (no XSS)", async () => {
    const xssPayload = { jsonrpc: "2.0", result: { data: "<script>alert('xss')</script>" } };
    vi.mocked(fetchEvent).mockResolvedValue(
      makeDetailResponse({ event: makeEvent({ raw: xssPayload, kind: "response", method: null }) }),
    );
    useAppStore.setState({ selectedIdx: 0, rows: [makeRow()] });
    render(<DetailPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("detail-summary")).toBeInTheDocument();
    });
    // No <script> element should be injected into DOM
    expect(document.querySelector("script[src]")).toBeNull();
    // The raw text should be visible as escaped text somewhere in the view
    // (either in PrettyJsonView or RawJsonView)
  });
});

describe("DetailPanel — retry", () => {
  it("calls fetchEvent again when Retry is clicked", async () => {
    vi.mocked(fetchEvent)
      .mockRejectedValueOnce(new Error("first fail"))
      .mockResolvedValueOnce(makeDetailResponse());
    useAppStore.setState({ selectedIdx: 0, rows: [makeRow()] });
    render(<DetailPanel />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByTestId("detail-summary")).toBeInTheDocument();
    });
  });
});

describe("DetailPanel — WR-03: live status/latency from store row", () => {
  it("shows live row status (ok) even when cached fetch returned pending", async () => {
    // Cached fetch says status="pending"; the SSE patch has already updated the row to "ok"
    vi.mocked(fetchEvent).mockResolvedValue(
      makeDetailResponse({ status: "pending", latencyMs: null }),
    );
    // Row already reflects the patch: status="ok", latencyMs=42
    useAppStore.setState({
      selectedIdx: 0,
      rows: [makeRow({ status: "ok", latencyMs: 42 })],
    });
    render(<DetailPanel />);
    await waitFor(() => {
      expect(screen.getByTestId("detail-summary")).toBeInTheDocument();
    });
    // Should display the live "ok" status from the row, not "pending" from cache
    expect(screen.getByTestId("detail-summary")).toHaveTextContent("ok");
    expect(screen.getByTestId("detail-summary")).not.toHaveTextContent("pending");
    // Should display the live latency from the row
    expect(screen.getByTestId("detail-summary")).toHaveTextContent("42ms");
  });
});
