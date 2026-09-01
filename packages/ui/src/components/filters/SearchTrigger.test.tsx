import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SearchTrigger } from "./SearchTrigger.js";

afterEach(cleanup);

describe("SearchTrigger", () => {
  it("renders an icon-only button with no visible text label", () => {
    render(<SearchTrigger isActive={false} onClick={() => {}} />);
    const button = screen.getByRole("button", { name: "Open search" });
    expect(button).toBeTruthy();
    // The redundant "Search" text label is removed; the icon is sufficient.
    expect(button.textContent).not.toContain("Search");
    // The Search icon (an svg) is still rendered.
    expect(button.querySelector("svg")).toBeTruthy();
  });

  it("has correct aria-label for accessibility", () => {
    render(<SearchTrigger isActive={false} onClick={() => {}} />);
    const button = screen.getByRole("button", { name: "Open search" });
    expect(button.getAttribute("aria-label")).toBe("Open search");
  });

  it("has title attribute with keyboard shortcut hint", () => {
    render(<SearchTrigger isActive={false} onClick={() => {}} />);
    const button = screen.getByRole("button", { name: "Open search" });
    expect(button.getAttribute("title")).toBe("Press / to open search");
  });

  it("calls onClick handler when clicked", () => {
    let wasClicked = false;
    const onClick = (): void => {
      wasClicked = true;
    };

    render(<SearchTrigger isActive={false} onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Open search" });
    fireEvent.click(button);
    expect(wasClicked).toBe(true);
  });

  it("applies active styling when isActive is true", () => {
    const { rerender } = render(<SearchTrigger isActive={false} onClick={() => {}} />);
    let button = screen.getByRole("button", { name: "Open search" });

    rerender(<SearchTrigger isActive={true} onClick={() => {}} />);
    button = screen.getByRole("button", { name: "Open search" });
    // The active state should change the background and border color
    // We check that the styling was applied (the component sets different styles for isActive)
    expect(button.style.background).toContain("var(--color-chip-bg-active)");
    expect(button.style.border).toContain("var(--color-accent)");
  });

  it("applies inactive styling when isActive is false", () => {
    render(<SearchTrigger isActive={false} onClick={() => {}} />);
    const button = screen.getByRole("button", { name: "Open search" });
    // The inactive state uses default chip styling
    expect(button.style.background).toContain("var(--color-chip-bg)");
    expect(button.style.border).toContain("var(--color-chip-border)");
  });

  it("supports focus with outline styling", () => {
    render(<SearchTrigger isActive={false} onClick={() => {}} />);
    const button = screen.getByRole("button", { name: "Open search" });
    fireEvent.focus(button);
    expect(button.style.outline).toBe("2px solid var(--color-accent)");
  });

  it("removes outline on blur", () => {
    render(<SearchTrigger isActive={false} onClick={() => {}} />);
    const button = screen.getByRole("button", { name: "Open search" });
    fireEvent.focus(button);
    fireEvent.blur(button);
    expect(button.style.outline).toBe("none");
  });
});
