export const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "hacker", label: "Hacker" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_STORAGE_KEY = "ahp-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return value === "dark" || value === "light" || value === "hacker";
}

export function readStoredTheme(storage: Pick<Storage, "getItem"> = localStorage): ThemeId {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: ThemeId, root: Element = document.documentElement): void {
  root.setAttribute("data-theme", theme);
}

export function persistTheme(theme: ThemeId, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable; the in-page theme still applies.
  }
}

export function labelForTheme(theme: ThemeId): string {
  return THEMES.find((option) => option.id === theme)?.label ?? "Dark";
}
