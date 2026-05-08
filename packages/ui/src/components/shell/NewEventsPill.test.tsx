import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewEventsPill } from "./NewEventsPill.js";

afterEach(() => {
  cleanup();
});

describe("NewEventsPill — Plan 04-06 Task 1 / UI-SPEC §5", () => {
  it("count=1 renders singular '1 new event' + 'Resume Following'", () => {
    render(<NewEventsPill count={1} onClick={() => {}} />);
    const btn = screen.getByTestId("new-events-pill");
    expect(btn.textContent).toContain("1 new event");
    expect(btn.textContent).not.toContain("new events");
    expect(btn.textContent).toContain("Resume Following");
  });

  it("count=42 renders '42 new events'", () => {
    render(<NewEventsPill count={42} onClick={() => {}} />);
    expect(screen.getByTestId("new-events-pill").textContent).toContain("42 new events");
  });

  it("count=99 renders '99 new events'", () => {
    render(<NewEventsPill count={99} onClick={() => {}} />);
    expect(screen.getByTestId("new-events-pill").textContent).toContain("99 new events");
  });

  it("count=100 caps as '99+ new events' (NOT '100')", () => {
    render(<NewEventsPill count={100} onClick={() => {}} />);
    const txt = screen.getByTestId("new-events-pill").textContent ?? "";
    expect(txt).toContain("99+ new events");
    expect(txt).not.toMatch(/\b100\b/);
  });

  it("count=1234 still shows '99+ new events' (cap applies)", () => {
    render(<NewEventsPill count={1234} onClick={() => {}} />);
    const txt = screen.getByTestId("new-events-pill").textContent ?? "";
    expect(txt).toContain("99+ new events");
    expect(txt).not.toContain("1234");
  });

  it("'Resume Following' span uses var(--color-accent) inline color", () => {
    render(<NewEventsPill count={3} onClick={() => {}} />);
    const span = screen.getByText("Resume Following") as HTMLSpanElement;
    expect(span.style.color).toBe("var(--color-accent)");
  });

  it("clicking calls onClick exactly once", () => {
    const fn = vi.fn();
    render(<NewEventsPill count={5} onClick={fn} />);
    fireEvent.click(screen.getByTestId("new-events-pill"));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
