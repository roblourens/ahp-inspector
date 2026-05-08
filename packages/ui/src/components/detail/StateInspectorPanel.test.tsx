// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStateAt, type StateAtSuccessResponse } from "../../transport/state-client.js";
import { StateInspectorPanel } from "./StateInspectorPanel.js";

vi.mock("../../transport/state-client.js", () => ({
  fetchStateAt: vi.fn(),
}));

const metadataResponse: StateAtSuccessResponse = {
  logKey: "log-A",
  targetIndex: 7,
  totalEvents: 10,
  confidence: "complete",
  diagnostics: [],
  resources: [
    {
      kind: "session",
      uri: "copilot:/session/1",
      confidence: "complete",
      baselineEventIdx: 1,
      lastAppliedEventIdx: 7,
      baselineFromSeq: 0,
      lastServerSeq: 3,
      diagnosticCount: 0,
    },
  ],
  selectedResource: null,
  intents: [],
  cache: { hit: false, size: 1, maxEntries: 25 },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StateInspectorPanel", () => {
  it("does not fetch metadata before the user opens state inspection", () => {
    render(<StateInspectorPanel idx={7} logKey="log-A" />);

    expect(screen.getByRole("button", { name: /state at this point/i })).toBeInTheDocument();
    expect(fetchStateAt).not.toHaveBeenCalled();
  });

  it("fetches metadata for the selected idx and log key on explicit click", async () => {
    vi.mocked(fetchStateAt).mockResolvedValue(metadataResponse);
    render(<StateInspectorPanel idx={7} logKey="log-A" />);

    fireEvent.click(screen.getByRole("button", { name: /state at this point/i }));

    expect(fetchStateAt).toHaveBeenCalledWith(7, {
      logKey: "log-A",
      signal: expect.any(AbortSignal),
    });
    expect(screen.getByTestId("state-inspector-loading")).toHaveTextContent(
      /loading reconstructed state metadata/i,
    );
    await waitFor(() => {
      expect(screen.getByTestId("state-inspector-metadata")).toHaveTextContent("complete");
    });
    expect(screen.getByTestId("state-inspector-metadata")).toHaveTextContent("Resources");
    expect(screen.getByTestId("state-inspector-metadata")).toHaveTextContent("1");
  });

  it("renders retryable metadata errors without hiding the action", async () => {
    vi.mocked(fetchStateAt)
      .mockRejectedValueOnce(new Error("active log changed (409)"))
      .mockResolvedValueOnce(metadataResponse);
    render(<StateInspectorPanel idx={7} logKey="log-A" />);

    fireEvent.click(screen.getByRole("button", { name: /state at this point/i }));

    await waitFor(() => {
      expect(screen.getByTestId("state-inspector-error")).toHaveTextContent("active log changed");
    });
    fireEvent.click(screen.getByRole("button", { name: /retry state lookup/i }));
    await waitFor(() => {
      expect(screen.getByTestId("state-inspector-metadata")).toHaveTextContent("complete");
    });
    expect(fetchStateAt).toHaveBeenCalledTimes(2);
  });

  it("aborts and resets in-flight state lookup when idx changes", async () => {
    vi.mocked(fetchStateAt).mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<StateInspectorPanel idx={7} logKey="log-A" />);
    fireEvent.click(screen.getByRole("button", { name: /state at this point/i }));
    const firstSignal = vi.mocked(fetchStateAt).mock.calls[0]?.[1]?.signal;
    expect(firstSignal?.aborted).toBe(false);

    rerender(<StateInspectorPanel idx={8} logKey="log-A" />);

    expect(firstSignal?.aborted).toBe(true);
    expect(screen.queryByTestId("state-inspector-loading")).toBeNull();
    expect(screen.getByRole("button", { name: /state at this point/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("aborts and resets in-flight state lookup when log key changes", async () => {
    vi.mocked(fetchStateAt).mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<StateInspectorPanel idx={7} logKey="log-A" />);
    fireEvent.click(screen.getByRole("button", { name: /state at this point/i }));
    const firstSignal = vi.mocked(fetchStateAt).mock.calls[0]?.[1]?.signal;

    rerender(<StateInspectorPanel idx={7} logKey="log-B" />);

    expect(firstSignal?.aborted).toBe(true);
    expect(screen.queryByTestId("state-inspector-loading")).toBeNull();
  });
});
