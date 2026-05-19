# Phase 23: Hacker theme CRT overhaul - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 8 likely new/modified implementation and verification surfaces
**Analogs found:** 7 / 8

Phase 23 is unusually concentrated. The context, research, and UI contract all point at the existing Hacker theme path rather than a new subsystem: extend Hacker-only tokens, evolve the shared global compositing layers, optionally mount a single shared SVG filter-definitions surface from the shell, and add fixture-backed verification. The existing theme picker contract stays intact.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/ui/src/styles/tokens.css` | config | transform | `packages/ui/src/styles/tokens.css` existing Hacker token block | exact |
| `packages/ui/src/styles/global.css` | config | transform | `packages/ui/src/styles/global.css` existing Hacker overlays, animations, reduced-motion block | exact |
| `packages/ui/src/components/shell/AppShell.tsx` | component | event-driven | `packages/ui/src/components/shell/AppShell.tsx` shell + fixed drawer/picker/drop/toast ownership | exact |
| `packages/ui/src/components/shell/CrtFilterDefs.tsx` | component | transform | none; nearest mount/integration context is `AppShell.tsx` | no analog |
| `packages/ui/src/styles/theme-tokens.test.ts` | test | transform | existing theme token inventory + Hacker effect bounds tests | exact |
| `packages/ui/src/styles/reduced-motion-css.test.ts` | test | transform | existing reduced-motion CSS contract test | exact |
| `e2e/phase23.spec.ts` | test | event-driven | `e2e/phase5.spec.ts` fixture CLI launch, theme switching, drawer screenshots, safe screenshot folder | role/data-flow match |
| `packages/extension/src/__test__/webviewHtml.test.ts` or parity-equivalent extension test | test | request-response | `packages/extension/src/__test__/webviewHtml.test.ts`, with `packages/extension/src/extension.test.ts` as panel-level parity option | role-match |

## Pattern Assignments

### `packages/ui/src/styles/tokens.css` (config, transform)

**Analog:** `packages/ui/src/styles/tokens.css`

**Hacker scoping pattern** (lines 277-400):
```css
[data-theme="hacker"] {
  --color-scheme: dark;

  --color-bg: #020704;
  --color-surface: #06120a;
  --color-surface-raised: #0a1b10;
  --color-border: #12351d;
  --color-border-strong: #1f6b34;
  --color-accent: #39ff88;
  --color-accent-foreground: #020704;

  --effect-scanline-opacity: 0.12;
  --effect-grid-opacity: 0.08;
  --effect-noise-opacity: 0.04;
  --effect-glow: 0 0 10px color-mix(in srgb, var(--color-accent) 34%, transparent);
  --effect-glow-strong: 0 0 18px color-mix(in srgb, var(--color-accent) 48%, transparent);
}
```

**Copy-forward rule:** New CRT tuning tokens belong beside the current `--effect-*` tokens inside the Hacker block. Dark and Light currently set the same effect tokens to neutral values (`0`/`none`, lines 143-147 and 268-272); preserve that neutral-surface pattern if new tokens must exist across all themes.

**Dark/Light neutral contract** (lines 143-147 and 268-272):
```css
--effect-scanline-opacity: 0;
--effect-grid-opacity: 0;
--effect-noise-opacity: 0;
--effect-glow: none;
--effect-glow-strong: none;
```

---

### `packages/ui/src/styles/global.css` (config, transform)

**Analog:** `packages/ui/src/styles/global.css`

**Pointer-transparent whole-screen overlay pattern** (lines 825-860):
```css
[data-theme="hacker"] body::before,
[data-theme="hacker"] body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

[data-theme="hacker"] body::before {
  background: repeating-linear-gradient(
    to bottom,
    color-mix(in srgb, var(--color-accent) 100%, transparent) 0,
    color-mix(in srgb, var(--color-accent) 100%, transparent) 1px,
    transparent 1px,
    transparent 4px
  );
  opacity: var(--effect-scanline-opacity);
  animation: ahp-scanline-drift 12s linear infinite;
}
```

**Effect emphasis pattern** (lines 862-879):
```css
[data-theme="hacker"] #root {
  position: relative;
  z-index: 1;
  box-shadow: inset 0 0 120px color-mix(in srgb, var(--color-accent) 10%, transparent);
}

[data-theme="hacker"] header,
[data-theme="hacker"] .detail-rail,
[data-theme="hacker"] .detail-drawer,
[data-theme="hacker"] [data-testid="filter-bar"] {
  box-shadow: var(--effect-glow);
}
```

**Ambient motion + comfort pattern** (lines 882-910):
```css
@keyframes ahp-scanline-drift {
  from {
    background-position-y: 0;
  }
  to {
    background-position-y: 32px;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-theme="hacker"] body::before,
  [data-theme="hacker"] body::after,
  [data-theme="hacker"] #root,
  [data-theme="hacker"] [data-selected="true"] {
    animation: none;
    transition: none;
  }
}
```

**Fixed overlay hazard to preserve while choosing filter placement** (lines 732-765):
```css
.detail-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
  background: var(--overlay-backdrop);
}

.detail-drawer {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(88vw, 720px);
  height: 100%;
}
```

**Copy-forward rule:** Put new glass, rim, fringe, scan/noise, and glitch choreography beside the existing Hacker-only body/root patterns. Keep decorative layers `pointer-events: none`. Reduced motion should remove temporal behavior only; the static CRT selectors should remain present.

---

### `packages/ui/src/components/shell/AppShell.tsx` (component, event-driven)

**Analog:** `packages/ui/src/components/shell/AppShell.tsx`

**Shared shell import style** (lines 1-24):
```tsx
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { usePersistEffect } from "../../persistence/persist-effect.js";
import { WatchErrorBanner } from "../banners/WatchErrorBanner.js";
import { DetailPanel } from "../detail/index.js";
import { DropOverlay } from "../drop/DropOverlay.js";
import { MultiFileToast } from "../drop/MultiFileToast.js";
import { HeaderBar } from "./HeaderBar.js";
```

**Whole UI surface ownership** (lines 204-298):
```tsx
return (
  <div
    data-testid="app-shell"
    className="app-shell"
    style={{ display: "flex", flexDirection: "column", height: "100%" }}
  >
    <HeaderBar version={__APP_VERSION__} />
    {/* source, filters, timeline, desktop detail rail */}
    {!isDetailDesktop && selectedIdx !== null && (
      <div className="detail-drawer-backdrop" data-testid="detail-drawer-backdrop">
        <div className="detail-drawer" role="dialog" aria-label="Event detail" data-testid="detail-drawer">
          {/* close control + detail panel */}
        </div>
      </div>
    )}
    <StatusBar />
    <LogPickerPanel />
    <DropOverlay state={overlayState} onDismiss={dismissError} />
    {toast !== null && <MultiFileToast />}
  </div>
);
```

**Copy-forward rule:** If Phase 23 adds a CRT display wrapper or mounts filter definitions, place it so the full app presentation named by D-02 remains visually coherent: shell, drawer, picker, drop overlay, and toast. The shell is also the place to validate whether the filter surface accidentally changes current fixed backdrop semantics.

---

### `packages/ui/src/components/shell/CrtFilterDefs.tsx` (component, transform)

**Analog:** No close local analog.

**Nearest local integration conventions:** Use the component/module style seen at the top of `AppShell.tsx` (lines 1-24): `.js` relative imports, `type JSX` imports, and a small named exported component mounted from shell code when needed.

**Research/UI contract to follow:** `23-RESEARCH.md` recommends one noninteractive, in-bundle or inline same-document SVG filter-definition surface; `23-UI-SPEC.md` requires no remote textures/maps and no interaction capture. The planner should not invent a runtime renderer or a new control system for this file.

**No copied implementation excerpt:** The codebase does not currently define same-document SVG filter definitions or CRT displacement components. Treat this as the phase's feasibility surface and borrow only local component style from `AppShell.tsx`.

---

### `packages/ui/src/styles/theme-tokens.test.ts` (test, transform)

**Analog:** `packages/ui/src/styles/theme-tokens.test.ts`

**Token inventory pattern** (lines 1-95):
```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cssPath = existsSync("src/styles/tokens.css")
  ? "src/styles/tokens.css"
  : "packages/ui/src/styles/tokens.css";
const css = readFileSync(cssPath, "utf8");

export const REQUIRED_THEME_TOKENS = [
  "--effect-scanline-opacity",
  "--effect-grid-opacity",
  "--effect-noise-opacity",
  "--effect-glow",
  "--effect-glow-strong",
] as const;
```

**Hacker-specific contract pattern** (lines 97-107):
```ts
describe("hacker effect token bounds", () => {
  it("keeps CRT effect opacity within UI-SPEC limits", () => {
    const block = blockFor('[data-theme="hacker"]');
    const valueFor = (token: string): number => {
      const match = block.match(new RegExp(`${token}:\\s*([0-9.]+)`));
      return Number(match?.[1] ?? Number.NaN);
    };
    expect(valueFor("--effect-scanline-opacity")).toBeLessThanOrEqual(0.14);
  });
});
```

**Copy-forward rule:** Expand `REQUIRED_THEME_TOKENS` for any new tokenized CRT tuning surface. The old opacity ceilings are explicitly stale per research; preserve the style of reading CSS contract blocks, but update the assertions to Phase 23's new design contract rather than protecting Phase 5's old intensity caps.

---

### `packages/ui/src/styles/reduced-motion-css.test.ts` (test, transform)

**Analog:** `packages/ui/src/styles/reduced-motion-css.test.ts`

**Static CSS contract test pattern** (lines 1-19):
```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cssPath = existsSync("src/styles/global.css")
  ? "src/styles/global.css"
  : "packages/ui/src/styles/global.css";
const css = readFileSync(cssPath, "utf8");

describe("reduced motion CSS", () => {
  it("disables hacker CRT animations when reduced motion is requested", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    const reducedBlockStart = css.indexOf("@media (prefers-reduced-motion: reduce)");
    const reducedBlock = css.slice(reducedBlockStart);
    expect(reducedBlock).toContain('[data-theme="hacker"]');
    expect(reducedBlock).toContain("animation: none");
  });
});
```

**Copy-forward rule:** New Phase 23 keyframes/selectors should be represented in this test exactly like `ahp-scanline-drift` and `ahp-crt-pulse` are today. This is the right analog for asserting animated drift/glitch beats are removed while Hacker's CSS identity still exists.

---

### `e2e/phase23.spec.ts` (test, event-driven)

**Analog:** `e2e/phase5.spec.ts`

**Fixture-driven CLI + screenshot directory pattern** (lines 1-94):
```ts
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve("screenshots/phase5");

async function assertNoPathLeak(page: Page): Promise<void> {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\/Users\//);
  expect(body).not.toMatch(/\/home\//);
  expect(body).not.toMatch(/[A-Za-z]:\\/);
}
```

**Theme + screenshot + interaction flow pattern** (lines 96-176):
```ts
await page.getByRole("button", { name: /Theme picker/ }).click();
await page.getByRole("menuitemradio", { name: "Hacker" }).click();
await expect(page.locator("html")).toHaveAttribute("data-theme", "hacker");
await page.screenshot({ path: join(SCREENSHOT_DIR, "03-hacker-desktop.png"), fullPage: true });

await page.setViewportSize({ width: 1366, height: 768 });
await expect(page.getByRole("button", { name: "Close details" })).toBeVisible();
await page.screenshot({
  path: join(SCREENSHOT_DIR, "05-laptop-drawer-hacker.png"),
  fullPage: true,
});
```

**Copy-forward rule:** Phase 23 should make `SCREENSHOT_DIR` `screenshots/phase23`, keep fixture-only data setup, and extend this flow for the locked CRT hit-target checks: theme menu, timeline row click, search focus/typing, drawer close, and one representative overlay/picker. The Phase 5 file also supplies useful desktop, laptop drawer, narrow, wide, ultrawide, and error-state screenshot sequencing.

---

### `packages/extension/src/__test__/webviewHtml.test.ts` or parity-equivalent extension test (test, request-response)

**Primary analog:** `packages/extension/src/__test__/webviewHtml.test.ts`

**CSP/parity assertion style** (lines 1-47):
```ts
import { describe, expect, it } from "vitest";
import { renderWebviewHtml } from "../webviewHtml.js";

const baseOpts = {
  scriptUri: "vscode-webview://abc/main.js",
  stylesheetUri: "vscode-webview://abc/main.css",
  nonce: "deadbeefcafef00d",
  cspSource: "vscode-webview://abc",
};

describe("renderWebviewHtml", () => {
  it("loopbackOrigin widens connect-src CSP", () => {
    const html = renderWebviewHtml({ ...baseOpts, loopbackOrigin: "http://localhost:51234" });
    expect(html).toContain("connect-src vscode-webview://abc http://localhost:51234");
  });
});
```

**Secondary panel-level analog:** `packages/extension/src/extension.test.ts` lines 170-176 check generated webview HTML after `openViewer(...)`, which is useful if the chosen parity hook is viewer-level rather than raw HTML-level.

**Copy-forward rule:** If Phase 23 needs an extension/webview regression guard for inline SVG/filter resources or bundled CSS presence, use these string-level HTML/CSP assertion patterns. Keep the assertion focused on parity or CSP viability; do not turn the extension test into a visual CRT test.

## Shared Patterns

### Hacker Scope Stays Token + Global CSS Driven
**Sources:** `packages/ui/src/styles/tokens.css` lines 277-400; `packages/ui/src/styles/global.css` lines 825-910
**Apply to:** `tokens.css`, `global.css`, CRT static/motion contracts
```css
[data-theme="hacker"] body::before,
[data-theme="hacker"] body::after {
  pointer-events: none;
}
```
Dark and Light remain clean because the implementation is anchored under `[data-theme="hacker"]` and neutral effect values elsewhere.

### Existing Theme Activation Contract Must Remain Unchanged
**Sources:** `packages/ui/src/theme/theme.ts` lines 1-36; `packages/ui/src/components/shell/HeaderBar.tsx` lines 46-50 and 96-153
**Apply to:** Planning constraints, E2E activation path
```ts
export function applyTheme(theme: ThemeId, root: Element = document.documentElement): void {
  root.setAttribute("data-theme", theme);
}

export function persistTheme(
  theme: ThemeId,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable; the in-page theme still applies.
  }
}
```
Phase 23 should reuse this activation path. No new slider, preset, toggle, or Hacker-only runtime control belongs in the plan.

### Filter Placement Must Respect Existing Fixed/Overlay Ownership
**Sources:** `packages/ui/src/components/shell/AppShell.tsx` lines 253-297; `packages/ui/src/styles/global.css` lines 732-765
**Apply to:** `AppShell.tsx`, `CrtFilterDefs.tsx`, Phase 23 E2E
```tsx
<LogPickerPanel />
<DropOverlay state={overlayState} onDismiss={dismissError} />
{toast !== null && <MultiFileToast />}
```
The planner should explicitly verify that any filtered display surface keeps drawer backdrop coverage, picker/drop/toast layering, and close/dismiss behavior honest.

### Verification Screenshots Stay Fixture-Only
**Source:** `e2e/phase5.spec.ts` lines 13, 68-94, 96-176
**Apply to:** `e2e/phase23.spec.ts`, `screenshots/phase23/`
```ts
const SCREENSHOT_DIR = resolve("screenshots/phase5");
await mkdir(SCREENSHOT_DIR, { recursive: true });
```
Copy the pattern, change the phase folder, and continue using generated safe fixtures/temp files rather than real logs.

### Extension Parity Is a Contract Test, Not a Forked Theme Runtime
**Sources:** `packages/extension/src/webviewHtml.ts` lines 58-117; `packages/extension/src/__test__/webviewHtml.test.ts` lines 11-47
**Apply to:** Chosen Phase 23 parity hook
```ts
const csp = [
  "default-src 'none'",
  `img-src ${cspSource} data:`,
  `font-src ${cspSource}`,
  `style-src ${cspSource} 'unsafe-inline'`,
  `script-src 'nonce-${nonce}'`,
  `connect-src ${connectSrc}`,
].join("; ");
```
Any parity evidence should preserve the existing local-only CSP posture and avoid remote filter maps/textures.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/ui/src/components/shell/CrtFilterDefs.tsx` | component | transform | No current UI component emits same-document SVG filter definitions or image-space displacement primitives. Use `AppShell.tsx` only for local component/mount style and follow the research feasibility slice for filter contents. |

## Metadata

**Analog search scope:** `packages/ui/src/styles`, `packages/ui/src/components/shell`, `packages/ui/src/theme`, `e2e`, `packages/extension/src`
**Files scanned/read for concrete patterns:** 13 (`23-CONTEXT.md`, `23-RESEARCH.md`, `23-UI-SPEC.md`, five UI implementation files, five verification/parity files)
**Pattern extraction date:** 2026-05-17
