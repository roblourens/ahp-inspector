import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("App smoke", () => {
  it("mounts the AppShell with timeline region stub", () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId("app-shell")).toBeInTheDocument();
    expect(getByTestId("timeline-region")).toBeInTheDocument();
  });
});
