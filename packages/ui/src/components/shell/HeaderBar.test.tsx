import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HeaderBar } from "./HeaderBar.js";

beforeEach(() => {
  document.documentElement.setAttribute("data-theme", "dark");
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.setAttribute("data-theme", "dark");
});

describe("HeaderBar theme switcher", () => {
  it("renders dark, light, and hacker theme controls", () => {
    render(<HeaderBar version="0.1.0" />);
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hacker" })).toBeInTheDocument();
  });

  it("applies and persists the selected light theme", () => {
    render(<HeaderBar version="0.1.0" />);
    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("ahp-theme")).toBe("light");
    expect(screen.getByRole("button", { name: "Light" }).getAttribute("aria-pressed")).toBe("true");
  });
});
