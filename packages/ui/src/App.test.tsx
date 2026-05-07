import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { App } from "./App.js";
import { useAppStore } from "./state/store.js";

afterEach(() => {
  cleanup();
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
});
