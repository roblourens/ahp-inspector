import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyToast } from "./CopyToast.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CopyToast", () => {
  it("restarts its dismissal timer when a stable toast id changes", () => {
    vi.useFakeTimers();
    const { rerender } = render(<CopyToast key={1} message="Copied" kind="success" />);

    act(() => vi.advanceTimersByTime(1_000));
    rerender(<CopyToast key={2} message="Copied" kind="success" />);
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByTestId("copy-toast")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(900));
    expect(screen.queryByTestId("copy-toast")).toBeNull();
  });
});
