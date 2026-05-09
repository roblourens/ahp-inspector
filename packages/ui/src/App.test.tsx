import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { useAppStore } from "./state/store.js";
import type { AhpViewerClient, LogStreamHandle } from "./transport/client.js";
import { AhpViewerClientProvider } from "./transport/transport-context.js";

function fakeClient(overrides: Partial<AhpViewerClient> = {}): AhpViewerClient {
  const noopStream: LogStreamHandle = { close: () => {} };
  const base: AhpViewerClient = {
    probeLogMeta: () => new Promise(() => {}), // never resolves -> stays "connecting"
    fetchCandidates: () => Promise.resolve([]),
    openSessionByCandidate: () => Promise.reject(new Error("not used")),
    openSessionByPath: () => Promise.reject(new Error("not used")),
    connectLogStream: () => noopStream,
    fetchEvent: () => Promise.resolve(null),
    searchEvents: () => Promise.resolve({ matches: [], total: 0, truncated: false }),
    fetchStateAt: () => Promise.resolve(null),
  };
  return { ...base, ...overrides };
}

function renderApp(client: AhpViewerClient): ReturnType<typeof render> {
  return render(
    <AhpViewerClientProvider client={client}>
      <App />
    </AhpViewerClientProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Reset store between tests so connection state doesn't leak.
  useAppStore.setState({
    rows: [],
    connection: "connecting",
    selectedIdx: null,
    meta: null,
  });
});

describe("App smoke", () => {
  it("mounts the AppShell with the loading state on initial connection", () => {
    const { getByTestId } = renderApp(fakeClient());
    expect(getByTestId("app-shell")).toBeInTheDocument();
    // With connection=connecting and no rows, TimelineRegion renders LoadingState.
    expect(getByTestId("state-loading")).toBeInTheDocument();
  });

  it("routes to ServerNotRunningState when connection is no-server", () => {
    useAppStore.setState({ connection: "no-server" });
    const { getByTestId, queryByTestId } = renderApp(fakeClient());
    expect(getByTestId("state-server-not-running")).toBeInTheDocument();
    expect(queryByTestId("app-shell")).toBeNull();
  });

  it("treats a probeLogMeta 'no-server' result as ServerNotRunningState", async () => {
    const client = fakeClient({ probeLogMeta: () => Promise.resolve("no-server") });
    const { getByTestId, queryByTestId } = renderApp(client);

    await waitFor(() => expect(getByTestId("state-server-not-running")).toBeInTheDocument());
    expect(queryByTestId("app-shell")).toBeNull();
  });

  it("treats a probeLogMeta 'no-log' result as the discovery state", async () => {
    const client = fakeClient({
      probeLogMeta: () => Promise.resolve("no-log"),
      fetchCandidates: () => Promise.resolve([]),
    });
    const { container } = renderApp(client);

    await waitFor(() =>
      expect(container.querySelector('form[aria-label="Open log by path"]')).not.toBeNull(),
    );
  });
});
