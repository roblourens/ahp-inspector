// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  isThemeId,
  persistTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
} from "./theme.js";

describe("theme helpers", () => {
  it("validates known theme ids", () => {
    expect(isThemeId("dark")).toBe(true);
    expect(isThemeId("light")).toBe(true);
    expect(isThemeId("hacker")).toBe(true);
    expect(isThemeId("raw-green")).toBe(false);
  });

  it("reads valid stored themes and falls back to dark for invalid or missing values", () => {
    expect(readStoredTheme({ getItem: () => "light" })).toBe("light");
    expect(readStoredTheme({ getItem: () => "hacker" })).toBe("hacker");
    expect(readStoredTheme({ getItem: () => "unknown" })).toBe("dark");
    expect(readStoredTheme({ getItem: () => null })).toBe("dark");
  });

  it("falls back to dark when storage throws", () => {
    expect(
      readStoredTheme({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe("dark");
  });

  it("applies and persists themes while ignoring write errors", () => {
    const root = document.createElement("html");
    applyTheme("hacker", root);
    expect(root.getAttribute("data-theme")).toBe("hacker");

    const setItem = vi.fn();
    persistTheme("light", { setItem });
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "light");

    expect(() =>
      persistTheme("dark", {
        setItem: () => {
          throw new Error("quota");
        },
      }),
    ).not.toThrow();
  });
});
