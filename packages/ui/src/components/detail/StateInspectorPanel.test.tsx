// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchStateAt,
  type StateAtResourceMetadata,
  type StateAtSuccessResponse,
} from "../../transport/state-client.js";
import { StateInspectorPanel } from "./StateInspectorPanel.js";

vi.mock("../../transport/state-client.js", () => ({
  fetchStateAt: vi.fn(),
}));

const sessionResource: StateAtResourceMetadata = {
  kind: "session",
  uri: "copilot:/session/1",
  confidence: "complete",
  baselineEventIdx: 1,
  lastAppliedEventIdx: 7,
  baselineFromSeq: 0,
  lastServerSeq: 3,
  diagnosticCount: 0,
};

const rootResource: StateAtResourceMetadata = {
  kind: "root",
  uri: "root://workspace",
  confidence: "partial",
  baselineEventIdx: 0,
  lastAppliedEventIdx: 4,
  baselineFromSeq: null,
  lastServerSeq: 1,
  diagnosticCount: 1,
};

const terminalResource: StateAtResourceMetadata = {
  kind: "terminal",
  uri: "terminal://session 1/pty/2",
  confidence: "partial",
  baselineEventIdx: 2,
  lastAppliedEventIdx: 7,
  baselineFromSeq: 0,
  lastServerSeq: 4,
  diagnosticCount: 2,
};

const metadataResponse: StateAtSuccessResponse = {
  logKey: "log-A",
  targetIndex: 7,
  totalEvents: 10,
  confidence: "complete",
  diagnostics: [],
  resources: [sessionResource],
  selectedResource: null,
  intents: [],
  cache: { hit: false, size: 1, maxEntries: 25 },
};

const selectedResponse: StateAtSuccessResponse = {
  ...metadataResponse,
  selectedResource: {
    ...sessionResource,
    diagnostics: [],
    state: {
      sessionId: "session-1",
      turns: [{ id: "turn-1", status: "complete" }],
      nested: { ok: true },
    },
  },
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
    vi.mocked(fetchStateAt)
      .mockResolvedValueOnce(metadataResponse)
      .mockResolvedValueOnce(selectedResponse);
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
    await waitFor(() => {
      expect(fetchStateAt).toHaveBeenCalledWith(7, {
        logKey: "log-A",
        resourceKind: "session",
        resourceUri: "copilot:/session/1",
        signal: expect.any(AbortSignal),
      });
    });
  });

  it("renders retryable metadata errors without hiding the action", async () => {
    vi.mocked(fetchStateAt)
      .mockRejectedValueOnce(new Error("active log changed (409)"))
      .mockResolvedValueOnce(metadataResponse)
      .mockResolvedValueOnce(selectedResponse);
    render(<StateInspectorPanel idx={7} logKey="log-A" />);

    fireEvent.click(screen.getByRole("button", { name: /state at this point/i }));

    await waitFor(() => {
      expect(screen.getByTestId("state-inspector-error")).toHaveTextContent("active log changed");
    });
    fireEvent.click(screen.getByRole("button", { name: /retry state lookup/i }));
    await waitFor(() => {
      expect(screen.getByTestId("state-inspector-metadata")).toHaveTextContent("complete");
    });
    expect(fetchStateAt).toHaveBeenCalledTimes(3);
  });

  it("defaults to the first complete resource, otherwise the first selectable resource", async () => {
    const partialFirstMetadata: StateAtSuccessResponse = {
      ...metadataResponse,
      resources: [rootResource, sessionResource],
    };
    vi.mocked(fetchStateAt)
      .mockResolvedValueOnce(partialFirstMetadata)
      .mockResolvedValueOnce(selectedResponse);
    render(<StateInspectorPanel idx={7} logKey="log-A" />);

    fireEvent.click(screen.getByRole("button", { name: /state at this point/i }));

    await waitFor(() => {
      expect(fetchStateAt).toHaveBeenLastCalledWith(7, {
        logKey: "log-A",
        resourceKind: "session",
        resourceUri: "copilot:/session/1",
        signal: expect.any(AbortSignal),
      });
    });
    expect(screen.getByRole("button", { name: /session copilot:\/session\/1/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("falls back to the first listed resource when none are complete", async () => {
    const partialMetadata: StateAtSuccessResponse = {
      ...metadataResponse,
      resources: [rootResource, { ...sessionResource, confidence: "unknown" }],
    };
    vi.mocked(fetchStateAt)
      .mockResolvedValueOnce(partialMetadata)
      .mockResolvedValueOnce({
        ...partialMetadata,
        selectedResource: {
          ...rootResource,
          diagnostics: [],
          state: { root: true },
        },
      });
    render(<StateInspectorPanel idx={7} logKey="log-A" />);

    fireEvent.click(screen.getByRole("button", { name: /state at this point/i }));

    await waitFor(() => {
      expect(fetchStateAt).toHaveBeenLastCalledWith(7, {
        logKey: "log-A",
        resourceKind: "root",
        resourceUri: "root://workspace",
        signal: expect.any(AbortSignal),
      });
    });
  });

  it("does not fetch selected state when metadata has no resources", async () => {
    vi.mocked(fetchStateAt).mockResolvedValue({ ...metadataResponse, resources: [] });
    render(<StateInspectorPanel idx={7} logKey="log-A" />);

    fireEvent.click(screen.getByRole("button", { name: /state at this point/i }));

    await waitFor(() => {
      expect(screen.getByTestId("state-inspector-empty")).toHaveTextContent(
        "No reconstructed resources",
      );
    });
    expect(fetchStateAt).toHaveBeenCalledTimes(1);
  });

  it("selects a different resource with the exact resource kind and URI", async () => {
    const metadataWithTwo: StateAtSuccessResponse = {
      ...metadataResponse,
      resources: [sessionResource, terminalResource],
    };
    vi.mocked(fetchStateAt)
      .mockResolvedValueOnce(metadataWithTwo)
      .mockResolvedValueOnce(selectedResponse)
      .mockResolvedValueOnce({
        ...metadataWithTwo,
        selectedResource: {
          ...terminalResource,
          diagnostics: [],
          state: { terminalId: "pty/2" },
        },
      });
    render(<StateInspectorPanel idx={7} logKey="log-A" />);

    fireEvent.click(screen.getByRole("button", { name: /state at this point/i }));
    await screen.findByTestId("state-summary-view");
    fireEvent.click(
      screen.getByRole("button", { name: /terminal terminal:\/\/session 1\/pty\/2/i }),
    );

    await waitFor(() => {
      expect(fetchStateAt).toHaveBeenLastCalledWith(7, {
        logKey: "log-A",
        resourceKind: "terminal",
        resourceUri: "terminal://session 1/pty/2",
        signal: expect.any(AbortSignal),
      });
    });
  });

  it("shows selected state in summary, pretty json, and raw json tabs", async () => {
    vi.mocked(fetchStateAt)
      .mockResolvedValueOnce(metadataResponse)
      .mockResolvedValueOnce(selectedResponse);
    render(<StateInspectorPanel idx={7} logKey="log-A" />);

    fireEvent.click(screen.getByRole("button", { name: /state at this point/i }));

    expect(await screen.findByTestId("state-summary-view")).toHaveTextContent(
      "object with 3 top-level keys",
    );
    fireEvent.click(screen.getByRole("tab", { name: /pretty json/i }));
    expect(screen.getByTestId("pretty-json-view")).toHaveTextContent("sessionId");
    fireEvent.click(screen.getByRole("tab", { name: /raw json/i }));
    expect(screen.getByTestId("raw-json-view")).toHaveTextContent('"sessionId": "session-1"');
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
