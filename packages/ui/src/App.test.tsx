import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { useAppStore } from "./state/store.js";

beforeEach(() => {
  // Stub fetch with a never-resolving promise so the App's probe effect
  // doesn't transition the store and doesn't trigger a real network call
  // inside jsdom. Tests assert the synchronous initial render only.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
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
    const { getByTestId } = render(<App />);
    expect(getByTestId("app-shell")).toBeInTheDocument();
    // With connection=connecting and no rows, TimelineRegion renders LoadingState.
    expect(getByTestId("state-loading")).toBeInTheDocument();
  });

  it("routes to ServerNotRunningState when connection is no-server", () => {
    useAppStore.setState({ connection: "no-server" });
    const { getByTestId, queryByTestId } = render(<App />);
    expect(getByTestId("state-server-not-running")).toBeInTheDocument();
    expect(queryByTestId("app-shell")).toBeNull();
  });

  it("treats a non-JSON meta response as no-server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
        ),
      ),
    );
    const { getByTestId, queryByTestId } = render(<App />);

    await waitFor(() => expect(getByTestId("state-server-not-running")).toBeInTheDocument());
    expect(queryByTestId("app-shell")).toBeNull();
  });
});
