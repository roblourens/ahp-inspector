// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailResizeHandle } from "./DetailResizeHandle.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DetailResizeHandle", () => {
  it("removes document drag listeners when unmounted mid-drag", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = render(
      <DetailResizeHandle width={420} min={360} max={720} onResize={() => {}} />,
    );
    fireEvent.mouseDown(screen.getByRole("button", { name: /resize detail panel/i }), {
      clientX: 100,
    });
    unmount();

    expect(addSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("mouseup", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("mouseup", expect.any(Function));
  });
});
