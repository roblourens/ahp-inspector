import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PrettyJsonView } from "./PrettyJsonView.js";

afterEach(() => cleanup());

describe("PrettyJsonView", () => {
  it("uses AHP themed JSON classes instead of library defaults", () => {
    const { container } = render(<PrettyJsonView data={{ method: "initialize", ok: true }} />);

    expect(screen.getByTestId("pretty-json-view")).toBeInTheDocument();
    expect(container.querySelector(".ahp-json-container")).toBeTruthy();
    expect(container.querySelector(".ahp-json-label")).toBeTruthy();
    expect(container.querySelector(".ahp-json-boolean")).toBeTruthy();
  });
});
