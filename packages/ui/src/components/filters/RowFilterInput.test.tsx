/**
 * Tests for RowFilterInput — Escape clears the box only when focus is inside it.
 * Environment: jsdom (packages/ui/vitest.config.ts)
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RowFilterInput } from "./RowFilterInput.js";

afterEach(() => {
  cleanup();
});

describe("RowFilterInput — Escape behavior", () => {
  it("clears the box on Escape when it has text", () => {
    const onClear = vi.fn();
    render(<RowFilterInput value="ping" onChange={() => {}} onClear={onClear} />);
    const input = screen.getByLabelText("Filter rows");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("does not call onClear on Escape when the box is empty", () => {
    const onClear = vi.fn();
    render(<RowFilterInput value="" onChange={() => {}} onClear={onClear} />);
    const input = screen.getByLabelText("Filter rows");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClear).not.toHaveBeenCalled();
  });

  it("stops Escape from propagating to ancestor listeners", () => {
    const onClear = vi.fn();
    const ancestorEscape = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test harness wrapper to observe propagation.
      <div
        onKeyDown={(e) => {
          if (e.key === "Escape") ancestorEscape();
        }}
      >
        <RowFilterInput value="ping" onChange={() => {}} onClear={onClear} />
      </div>,
    );
    const input = screen.getByLabelText("Filter rows");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(ancestorEscape).not.toHaveBeenCalled();
  });
});
