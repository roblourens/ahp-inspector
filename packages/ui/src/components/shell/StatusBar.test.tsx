import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusBar } from "./StatusBar.js";

describe("StatusBar — UI-SPEC §10 verbatim copy", () => {
  afterEach(() => cleanup());

  it("connected · N events", () => {
    render(<StatusBar connection="connected" eventCount={5} />);
    expect(screen.getByTestId("status-label").textContent).toBe("Connected · 5 events");
  });

  it("connected with selected row", () => {
    render(<StatusBar connection="connected" eventCount={5} selectedRowIndex={3} />);
    expect(screen.getByTestId("status-label").textContent).toBe(
      "Connected · 5 events · selected #3",
    );
  });

  it("connecting", () => {
    render(<StatusBar connection="connecting" eventCount={0} />);
    expect(screen.getByTestId("status-label").textContent).toBe("Connecting…");
  });

  it("disconnected", () => {
    render(<StatusBar connection="disconnected" eventCount={5} />);
    expect(screen.getByTestId("status-label").textContent).toBe("Disconnected");
  });

  it("no-server", () => {
    render(<StatusBar connection="no-server" eventCount={0} />);
    expect(screen.getByTestId("status-label").textContent).toBe("No server");
  });
});
