import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DirectionGlyph } from "./DirectionGlyph.js";

describe("DirectionGlyph — UI-SPEC §5.1", () => {
  afterEach(() => cleanup());

  it.each([
    ["c2s", "→"],
    ["s2c", "←"],
    ["unknown", "·"],
  ] as const)("renders %s as %s", (direction, glyph) => {
    render(<DirectionGlyph direction={direction} />);
    const el = screen.getByTestId("dir-glyph");
    expect(el.textContent).toBe(glyph);
    expect(el.getAttribute("data-direction")).toBe(direction);
  });
});
