// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { popoverPosition } from "./popoverPosition.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("popoverPosition", () => {
  it("uses native CSS anchors when supported", () => {
    vi.stubGlobal("CSS", { supports: vi.fn(() => true) });

    expect(popoverPosition("--test-anchor", "end")).toMatchObject({
      position: "fixed",
      positionAnchor: "--test-anchor",
      top: "anchor(bottom)",
      right: "anchor(right)",
    });
  });

  it("falls back to absolute trigger-relative positioning", () => {
    vi.stubGlobal("CSS", { supports: vi.fn(() => false) });

    expect(popoverPosition("--test-anchor", "start")).toEqual({
      position: "absolute",
      top: "calc(100% + 4px)",
      left: 0,
    });
  });
});
