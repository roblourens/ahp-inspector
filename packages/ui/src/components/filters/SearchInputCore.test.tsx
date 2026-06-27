/**
 * Tests for SearchInputCore focus behavior.
 * Environment: jsdom (packages/ui/vitest.config.ts)
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SearchInputCore } from "./SearchInputCore.js";

afterEach(cleanup);

describe("SearchInputCore", () => {
  it("keeps focus in the input after Enter navigates (D-11)", () => {
    const dispatched: string[] = [];
    const onNav = (e: Event): void => {
      dispatched.push((e as CustomEvent<string>).detail);
    };
    window.addEventListener("ahp-search-nav", onNav);

    render(<SearchInputCore value="initialize" onChange={() => {}} onClear={() => {}} />);

    const input = screen.getByPlaceholderText(
      "all JSON payloads, methods, ids, sessions...",
    ) as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: "Enter" });

    // Enter dispatches navigation but never blurs the input — focus stays put.
    expect(dispatched).toEqual(["next"]);
    expect(document.activeElement).toBe(input);

    window.removeEventListener("ahp-search-nav", onNav);
  });

  it("dispatches previous navigation on Shift+Enter without losing focus (D-11)", () => {
    const dispatched: string[] = [];
    const onNav = (e: Event): void => {
      dispatched.push((e as CustomEvent<string>).detail);
    };
    window.addEventListener("ahp-search-nav", onNav);

    render(<SearchInputCore value="initialize" onChange={() => {}} onClear={() => {}} />);

    const input = screen.getByPlaceholderText(
      "all JSON payloads, methods, ids, sessions...",
    ) as HTMLInputElement;
    input.focus();

    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(dispatched).toEqual(["previous"]);
    expect(document.activeElement).toBe(input);

    window.removeEventListener("ahp-search-nav", onNav);
  });
});
