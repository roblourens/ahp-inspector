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
  it("keeps theme names inside a compact picker menu", () => {
    render(<HeaderBar version="0.1.0" />);
    expect(screen.getByRole("button", { name: /theme picker/i })).toBeInTheDocument();
    expect(screen.queryByText("Dark")).toBeNull();
    expect(screen.queryByText("Light")).toBeNull();
    expect(screen.queryByText("Hacker")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /theme picker/i }));

    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Hacker" })).toBeInTheDocument();
  });

  it("applies and persists the selected light theme", () => {
    render(<HeaderBar version="0.1.0" />);
    fireEvent.click(screen.getByRole("button", { name: /theme picker/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Light" }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("ahp-theme")).toBe("light");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: /theme picker/i })).toHaveAccessibleName(
      "Theme picker (Light)",
    );
  });

  it("closes the theme menu when the picker is clicked again", () => {
    render(<HeaderBar version="0.1.0" />);
    const picker = screen.getByRole("button", { name: /theme picker/i });

    fireEvent.click(picker);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(picker);
    fireEvent.click(picker);

    expect(screen.queryByRole("menu")).toBeNull();
  });
});
