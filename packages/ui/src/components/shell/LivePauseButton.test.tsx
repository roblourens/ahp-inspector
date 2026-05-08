import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../state/store.js";
import { LivePauseButton } from "./LivePauseButton.js";

beforeEach(() => {
  useAppStore.setState({ livePaused: false, pendingNewCount: 0 });
});

afterEach(() => {
  cleanup();
  useAppStore.setState({ livePaused: false, pendingNewCount: 0 });
});

describe("LivePauseButton — Plan 04-06 Task 1", () => {
  it("renders 'Pause' with aria-label 'Pause live follow' and aria-pressed=false initially", () => {
    render(<LivePauseButton />);
    const btn = screen.getByRole("button", { name: "Pause live follow" });
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.textContent).toContain("Pause");
    // Lucide icon rendered
    expect(btn.querySelector("svg")).not.toBeNull();
  });

  it("clicking toggles store.livePaused → label/aria switch to Resume", () => {
    render(<LivePauseButton />);
    fireEvent.click(screen.getByRole("button", { name: "Pause live follow" }));
    expect(useAppStore.getState().livePaused).toBe(true);
    const btn = screen.getByRole("button", { name: "Resume live follow" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.textContent).toContain("Resume");
    expect(btn.querySelector("svg")).not.toBeNull();
  });

  it("re-click toggles back to Pause / false", () => {
    render(<LivePauseButton />);
    fireEvent.click(screen.getByRole("button", { name: "Pause live follow" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume live follow" }));
    expect(useAppStore.getState().livePaused).toBe(false);
    expect(screen.getByRole("button", { name: "Pause live follow" })).toBeInTheDocument();
  });

  it("when paused, inline style uses color-mix accent background and accent text color", () => {
    useAppStore.setState({ livePaused: true });
    render(<LivePauseButton />);
    const btn = screen.getByRole("button", { name: "Resume live follow" }) as HTMLButtonElement;
    expect(btn.style.background).toContain(
      "color-mix(in srgb, var(--color-accent) 15%, var(--color-surface))",
    );
    expect(btn.style.color).toBe("var(--color-accent)");
  });

  it("when live-following, inline style uses surface-raised background and text color", () => {
    render(<LivePauseButton />);
    const btn = screen.getByRole("button", { name: "Pause live follow" }) as HTMLButtonElement;
    expect(btn.style.background).toBe("var(--color-surface-raised)");
    expect(btn.style.color).toBe("var(--color-text)");
  });
});
