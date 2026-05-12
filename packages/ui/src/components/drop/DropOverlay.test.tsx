import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DropOverlay } from "./DropOverlay.js";

afterEach(() => cleanup());

describe("DropOverlay", () => {
  it("renders nothing in idle state", () => {
    render(<DropOverlay state={{ kind: "idle" }} onDismiss={vi.fn()} />);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("renders armed copy when no active log is present", () => {
    render(<DropOverlay state={{ kind: "armed", replacing: false }} onDismiss={vi.fn()} />);
    expect(screen.getByText("Drop a .jsonl file to open.")).toBeTruthy();
    expect(screen.getByText("Drag from Finder, Explorer, or VS Code's file tree.")).toBeTruthy();
  });

  it("renders replacing copy when armed-replacing", () => {
    render(<DropOverlay state={{ kind: "armed", replacing: true }} onDismiss={vi.fn()} />);
    expect(screen.getByText("Drop to replace the active log.")).toBeTruthy();
    expect(
      screen.getByText("The current log will close and the new file will start tailing."),
    ).toBeTruthy();
  });

  it('renders error message inside role="alert" and a Dismiss button', () => {
    const message =
      "That drop didn't include a file path. Try dragging from Finder or VS Code's file tree, or paste a path in the picker below.";
    render(<DropOverlay state={{ kind: "error", message }} onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeTruthy();
  });

  it("clicking Dismiss fires onDismiss", () => {
    const onDismiss = vi.fn();
    render(<DropOverlay state={{ kind: "error", message: "x" }} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("pressing Escape fires onDismiss in error state", () => {
    const onDismiss = vi.fn();
    render(<DropOverlay state={{ kind: "error", message: "x" }} onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("pressing Escape does NOT fire onDismiss in armed state", () => {
    const onDismiss = vi.fn();
    render(<DropOverlay state={{ kind: "armed", replacing: false }} onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('outer container exposes role="region" and aria-label', () => {
    render(<DropOverlay state={{ kind: "armed", replacing: false }} onDismiss={vi.fn()} />);
    expect(screen.getByRole("region", { name: /drop a log file/i })).toBeTruthy();
  });
});
