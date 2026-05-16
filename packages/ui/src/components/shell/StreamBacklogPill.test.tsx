import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StreamBacklogPill } from "./StreamBacklogPill.js";

afterEach(() => cleanup());

describe("StreamBacklogPill", () => {
  it("renders singular passive backlog status", () => {
    render(<StreamBacklogPill count={1} />);
    const pill = screen.getByTestId("stream-backlog-pill");
    expect(pill.textContent).toContain("1 stream event queued");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders plural backlog status", () => {
    render(<StreamBacklogPill count={42} />);
    expect(screen.getByTestId("stream-backlog-pill").textContent).toContain("42 stream events queued");
  });

  it("caps large backlog counts compactly", () => {
    render(<StreamBacklogPill count={1234} />);
    const text = screen.getByTestId("stream-backlog-pill").textContent ?? "";
    expect(text).toContain("99+ stream events queued");
    expect(text).not.toContain("1234");
  });
});
