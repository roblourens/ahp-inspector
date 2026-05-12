import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiFileToast } from "./MultiFileToast.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MultiFileToast", () => {
  it("renders the locked copy with singular form when N === 1", () => {
    render(<MultiFileToast basename="tiny.jsonl" ignoredCount={1} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain(
      "Opened tiny.jsonl. Ignored 1 other file.",
    );
    expect(screen.getByRole("status").textContent).not.toContain("Ignored 1 other files.");
  });

  it("renders plural form when N > 1", () => {
    render(<MultiFileToast basename="tiny.jsonl" ignoredCount={3} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("Ignored 3 other files.");
  });

  it("does not echo absolute paths — only basename appears", () => {
    render(<MultiFileToast basename="tiny.jsonl" ignoredCount={1} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status").textContent).not.toContain("/");
  });

  it("dismiss button has aria-label and fires onDismiss", () => {
    const onDismiss = vi.fn();
    render(<MultiFileToast basename="tiny.jsonl" ignoredCount={1} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss notice/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses after 5 seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<MultiFileToast basename="tiny.jsonl" ignoredCount={1} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("Esc keypress on the toast dismisses early", () => {
    const onDismiss = vi.fn();
    render(<MultiFileToast basename="tiny.jsonl" ignoredCount={1} onDismiss={onDismiss} />);
    const status = screen.getByRole("status");
    (status as HTMLElement).focus();
    fireEvent.keyDown(status, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });
});
