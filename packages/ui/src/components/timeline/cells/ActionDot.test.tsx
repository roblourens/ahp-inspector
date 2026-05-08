import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActionDot } from "./ActionDot.js";

describe("ActionDot — UI-SPEC §5.4", () => {
  afterEach(() => cleanup());

  it("returns null when family is null", () => {
    const { container } = render(<ActionDot family={null} />);
    expect(container.firstChild).toBeNull();
  });

  it.each([
    "text",
    "tool-call",
    "tool-result",
    "status",
    "unknown",
  ] as const)("renders dot for family %s", (family) => {
    render(<ActionDot family={family} />);
    const el = screen.getByTestId("action-dot");
    expect(el.getAttribute("data-family")).toBe(family);
    expect(el.getAttribute("aria-label")).toBe(`Action row family: ${family}`);
    expect(el.getAttribute("title")).toBe(
      `Action row family: ${family}. Only action events show this marker.`,
    );
  });
});
