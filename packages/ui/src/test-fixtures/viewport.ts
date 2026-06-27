import { DETAIL_DESKTOP_BREAKPOINT } from "../components/detail/detail-layout.js";

/** Drive the jsdom detail breakpoint. width >= 1400 → desktop rail; below → drawer. */
export function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}

export const NARROW_WIDTH = DETAIL_DESKTOP_BREAKPOINT - 34; // 1366
export const DESKTOP_WIDTH = DETAIL_DESKTOP_BREAKPOINT + 40; // 1440
