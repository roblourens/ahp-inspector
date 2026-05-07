import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LatencyCell } from "./LatencyCell.js";

describe("LatencyCell — UI-SPEC §5.6", () => {
  afterEach(() => cleanup());

  it("renders ms for ms < 1000", () => {
    render(<LatencyCell ms={12} band="fast" />);
    const cell = screen.getByTestId("latency-cell");
    expect(cell.textContent).toBe("12ms");
    expect(screen.getByTestId("latency-bar")).toBeTruthy();
  });

  it("renders seconds (1 decimal) for ms >= 1000", () => {
    render(<LatencyCell ms={1500} band="slow" />);
    const cell = screen.getByTestId("latency-cell");
    expect(cell.textContent).toBe("1.5s");
    expect(screen.getByTestId("latency-bar")).toBeTruthy();
  });

  it("renders em-dash and no bar when ms is null", () => {
    render(<LatencyCell ms={null} band={null} />);
    const cell = screen.getByTestId("latency-cell");
    expect(cell.textContent).toBe("—");
    expect(screen.queryByTestId("latency-bar")).toBeNull();
  });
});
