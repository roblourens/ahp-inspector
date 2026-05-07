import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PayloadPreview } from "./PayloadPreview.js";

describe("PayloadPreview — UI-SPEC §5", () => {
  afterEach(() => cleanup());

  it("renders text verbatim", () => {
    render(<PayloadPreview text='{"hello":"world"}' />);
    const el = screen.getByTestId("payload-preview");
    expect(el.textContent).toBe('{"hello":"world"}');
  });

  it("applies ellipsis truncation styles", () => {
    render(<PayloadPreview text="some preview" />);
    const el = screen.getByTestId("payload-preview") as HTMLElement;
    expect(el.style.textOverflow).toBe("ellipsis");
    expect(el.style.whiteSpace).toBe("nowrap");
    expect(el.style.overflow).toBe("hidden");
  });
});
