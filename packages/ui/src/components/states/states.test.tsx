import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LoadingState } from "./LoadingState.js";
import { EmptyState } from "./EmptyState.js";
import { NoResultsBanner } from "./NoResultsBanner.js";
import { DisconnectedBanner } from "./DisconnectedBanner.js";
import { ServerNotRunningState } from "./ServerNotRunningState.js";

afterEach(() => cleanup());

describe("LoadingState", () => {
  it("renders verbatim copy with filename", () => {
    render(<LoadingState filename="my-log.jsonl" />);
    expect(screen.getByTestId("state-loading")).toBeTruthy();
    expect(screen.getByText("Loading log…")).toBeTruthy();
    expect(screen.getByText(/Reading/)).toBeTruthy();
    expect(screen.getByText("my-log.jsonl")).toBeTruthy();
  });
});

describe("EmptyState", () => {
  it("renders verbatim §10 copy", () => {
    render(<EmptyState />);
    expect(screen.getByText("No events yet")).toBeTruthy();
    expect(
      screen.getByText("This log file is empty. Events will appear as they are written."),
    ).toBeTruthy();
  });
});

describe("NoResultsBanner", () => {
  it("renders heading and body", () => {
    render(
      <NoResultsBanner
        heading="No valid events"
        body="All 5 lines in this file failed to parse. Showing parse errors below."
      />,
    );
    expect(screen.getByText("No valid events")).toBeTruthy();
    expect(
      screen.getByText("All 5 lines in this file failed to parse. Showing parse errors below."),
    ).toBeTruthy();
  });
});

describe("DisconnectedBanner", () => {
  it("renders verbatim copy and Retry connection invokes callback", () => {
    const spy = vi.fn();
    render(<DisconnectedBanner onReconnect={spy} />);
    expect(
      screen.getByText("Disconnected from log stream. Showing last received events."),
    ).toBeTruthy();
    const btn = screen.getByRole("button", { name: "Retry connection" });
    fireEvent.click(btn);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("ServerNotRunningState", () => {
  it("renders heading and run command", () => {
    render(<ServerNotRunningState />);
    expect(screen.getByText("Start the viewer from the CLI")).toBeTruthy();
    expect(screen.getByText("ahp-viewer path/to/log.jsonl")).toBeTruthy();
  });
});
