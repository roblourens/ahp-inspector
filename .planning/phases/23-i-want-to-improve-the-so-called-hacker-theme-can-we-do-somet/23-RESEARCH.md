# Phase 23: Hacker theme CRT overhaul - Research

**Researched:** 2026-05-16 [VERIFIED: `date +%F`]
**Domain:** Whole-screen Hacker-only CRT compositing, visual displacement, and fixture-driven UI verification. [VERIFIED: `23-CONTEXT.md`; `packages/ui/src/styles/global.css`; `e2e/phase5.spec.ts`]
**Confidence:** MEDIUM. The project integration points are clear and the browser primitives are documented, but the selected displacement-map authoring path remains execution-gated in the app and extension webview before final tuning is treated as settled. [VERIFIED: codebase reads] [CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement]

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Screen warp character
- **D-01:** Hacker mode should use a visibly curved-glass whole-screen CRT warp, not merely stronger overlays on a flat UI.
- **D-02:** The curved-glass treatment applies to the entire app surface: header, timeline, detail panel/drawer, menus, and shared overlays should read as part of one CRT display.
- **D-03:** The display should include a dark glass/tube edge treatment so the viewport feels physically enclosed.
- **D-04:** Start aggressive. Distortion should be felt across the full screen, not only at the corners; the team can reduce intensity later if the result overshoots.

### Artifact intensity mix
- **D-05:** Use a full analog stack: curvature, stronger scanlines, vignette/glass shading, phosphor glow, subtle noise, and color fringe should work together.
- **D-06:** Prefer a stylized-first result over near-neutral legibility. Hacker should feel dramatically transformed, while remaining a usable inspection mode rather than an unreadable novelty.
- **D-07:** Chromatic/RGB separation should be present but weighted toward the display edges rather than splitting every character equally across the whole viewport.
- **D-08:** The surface should feel alive and imperfect through fine noise and occasional analog instability, without turning into constant broadcast grit.

### Motion and comfort
- **D-09:** Default motion should feel like a restless analog screen: continuous low-level drift with occasional stronger signal beats.
- **D-10:** Momentary glitches should be visibly noticeable, not merely subliminal, but should remain occasional rather than relentless.
- **D-11:** `prefers-reduced-motion: reduce` keeps the static CRT identity but removes animated drift, pulses, and glitches.
- **D-12:** CRT motion should remain mostly ambient. Hover, scrolling, selection, and focus retain their existing product feedback instead of stirring a new interaction-reactive effect system.

### Theme controls and scope
- **D-13:** CRT treatment belongs to Hacker only. Dark and Light stay visually clean.
- **D-14:** The CRT effect is Hacker's default identity. Selecting Hacker enables the full treatment; switching themes is the immediate escape hatch.
- **D-15:** Do not add an intensity slider, Calm/Bold/Extreme preset, or other configuration surface in this phase. Ship one bold curated treatment first.
- **D-16:** The shared UI should render the same Hacker CRT identity in both the standalone browser viewer and the VS Code extension webview.

### the agent's Discretion
- Decide the exact CSS/SVG/filter/compositing technique that best creates the warp and analog stack while fitting the existing app structure.
- Decide the precise timing, opacity, transform, and keyframe values that implement the locked aggressive direction.
- Decide how to balance the bold visual direction against the existing Phase 22 responsiveness posture during implementation and verification.

### Deferred Ideas (OUT OF SCOPE)
- User-adjustable CRT intensity controls or presets can be reconsidered later if the bold default needs productized tuning.
- Applying CRT effects to Dark/Light, or introducing a theme-independent display-effects mode, is intentionally out of Phase 23 scope.
</user_constraints>

## Summary

Use a CSS/SVG hybrid rather than a new rendering engine. Keep the analog stack in Hacker-only tokens and shared global CSS, then add one shared SVG filter-definition surface that can displace the rendered UI as a group. CSS overlays should continue to own scanlines, glass vignette, tube rim, phosphor glow, edge-weighted fringe, and signal-beat opacity/transform animation because the repo already implements Hacker overlays at the document level and already disables their motion under reduced-motion. [VERIFIED: `packages/ui/src/styles/tokens.css`; `packages/ui/src/styles/global.css`] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/filter]

The hardest planning question is not scanlines; it is the curved-glass warp. Filter Effects applies filters after layout, can warp an element image buffer, does not alter hit-testing, creates a stacking context, and creates a containing block for fixed descendants when attached below the document root. That matters here because `AppShell` contains a fixed detail-drawer backdrop, menus, drop overlays, and picker surfaces that D-02 requires to stay visually coherent. The implementation plan should therefore start with a bounded feasibility slice that proves the chosen displacement placement across desktop, drawer, theme menu, and webview before committing the full analog stack. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] [VERIFIED: `packages/ui/src/components/shell/AppShell.tsx`; `packages/ui/src/styles/global.css`]

**Primary recommendation:** Plan Phase 23 as a three-step CSS/SVG implementation: first prove whole-surface displacement and interaction/layout safety, then expand Hacker tokens and overlay layers, then add fixture-backed screenshot/performance/reduced-motion verification in standalone plus extension coverage. [VERIFIED: codebase verification surfaces] [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty]

## Project Constraints (from copilot-instructions.md)

- Runtime viewing remains local-only: no telemetry, CDN assets, or outbound viewing dependencies may be introduced for the CRT treatment. [VERIFIED: `.github/copilot-instructions.md`; `.planning/PROJECT.md`]
- The standalone app and VS Code webview share the same UI runtime; Phase 23 should keep the CRT implementation in shared UI code unless a hard platform constraint is demonstrated. [VERIFIED: `.github/copilot-instructions.md`; `packages/extension/src/extension.ts`; `packages/extension/src/webviewHtml.ts`]
- Theme divergence belongs in tokens and shared global styling, not bespoke component conditionals. This is already the Phase 5 pattern and matches the Phase 23 context. [VERIFIED: `.planning/STATE.md`; `tokens.css`; `global.css`; `23-CONTEXT.md`]
- Saved verification screenshots must use fixture JSONL data and live under a phase screenshot folder, never real user logs. [VERIFIED: `.github/copilot-instructions.md`]
- Large and growing logs must remain responsive; Phase 23 visual work should not casually undo Phase 22's interaction-responsiveness posture. [VERIFIED: `.planning/PROJECT.md`; `22-CONTEXT.md`; `23-CONTEXT.md`]
- `.planning/REQUIREMENTS.md` is absent in this repo state, so this research uses roadmap/context/project/state and existing automated validation surfaces rather than formal Phase 23 requirement IDs. [VERIFIED: user prompt; `gsd-sdk query init.phase-op 23`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Hacker CRT tokens and default scope | Browser / Client | - | Theme identity is currently controlled by `data-theme="hacker"` plus CSS variables in the shared UI package. [VERIFIED: `theme.ts`; `tokens.css`] |
| Whole-screen visual displacement | Browser / Client | - | CSS/SVG filters operate on rendered client content; no server, CLI, or protocol change is needed. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] |
| Analog overlay stack | Browser / Client | - | Existing scanline/grid/vignette layers already live in global CSS body pseudo-elements. [VERIFIED: `global.css`] |
| Reduced-motion static CRT fallback | Browser / Client | - | Existing implementation already has a Hacker reduced-motion CSS block and a focused test file. [VERIFIED: `global.css`; `reduced-motion-css.test.ts`] |
| Standalone and extension parity | Browser / Client | Frontend host HTML | The extension loads the bundled UI stylesheet/script into its webview, so shared UI implementation is the common path; CSP must keep any new assets local/in-bundle. [VERIFIED: `packages/extension/src/extension.ts`; `webviewHtml.ts`] |
| Verification and regression guardrails | Browser / Client | Test harness | Playwright fixture flows already capture Hacker screenshots across desktop, drawer, ultrawide, and error states. [VERIFIED: `e2e/phase5.spec.ts`] |

## Standard Stack

### Core

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| CSS custom properties and shared global CSS | Browser primitive; repo-owned | Hacker token expansion, overlays, animation gates, edge treatments | Existing theme architecture already centralizes theme effects here, so this keeps Dark/Light untouched and avoids component-level scattering. [VERIFIED: `tokens.css`; `global.css`] |
| SVG Filter Effects (`filter: url(#...)`, `<filter>`, `<feDisplacementMap>`, likely `<feTurbulence>`) | Browser primitive | Actual rendered-surface displacement plus optional analog instability | The spec defines image-buffer warping for CSS/SVG content, and MDN reports broad support for CSS `filter` and `<feDisplacementMap>`. [CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/filter] [CITED: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap] |
| Existing React shared shell | 19.2.6 in repo | Mount one reusable noninteractive SVG filter-definitions surface if implementation needs DOM-local filter IDs | The shared `AppShell` renders in standalone and extension contexts, and repo UI package already pins React 19.2.6. [VERIFIED: `packages/ui/package.json`; `AppShell.tsx`] |

### Supporting

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| Vitest | repo `^4.1.5`; registry `4.1.6`, modified 2026-05-11 | CSS/token contract tests and theme persistence/static fallback assertions | Retain existing test style; update old Hacker opacity-limit assertions when the phase intentionally changes the visual contract. [VERIFIED: `package.json`; npm registry query; `theme-tokens.test.ts`; `reduced-motion-css.test.ts`] |
| Playwright | repo `^1.59.1`; registry `1.60.0`, modified 2026-05-17 | Fixture screenshots, visual smoke checks, click/keyboard interaction checks under Hacker | Extend existing Phase 5 fixture E2E rather than starting an unrelated browser harness. [VERIFIED: `package.json`; npm registry query; `e2e/phase5.spec.ts`] |
| Vite UI bundle | repo `8.0.10`; registry `8.0.13`, modified 2026-05-14 | Ships shared CSS/SVG markup into standalone and extension UI bundle | No dependency change is required merely to add CSS/SVG CRT treatment. [VERIFIED: `packages/ui/package.json`; npm registry query] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVG displacement on rendered DOM | CSS-only vignette, border-radius, perspective, and transforms | CSS-only sells a tube shell cheaply, but it cannot guarantee the visible pixel-level warp requested by D-01; use it as framing, not as the only warp. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] [ASSUMED] |
| SVG displacement on rendered DOM | Canvas/WebGL full-screen post-processing | A shader can do true barrel distortion, but rebuilding a live, text-heavy, interactive DOM viewer through a canvas layer would be a disproportionate architecture shift and creates a new accessibility/input problem. [ASSUMED] |
| Existing CSS keyframes and media queries | JavaScript animation loop for drift/glitches | CSS animations already match the current Hacker pattern and reduced-motion CSS can zero them without new runtime scheduling work. [VERIFIED: `global.css`; `reduced-motion-css.test.ts`] |

**Installation:**
```bash
# No runtime package install is recommended for Phase 23.
# Keep the CRT treatment within existing shared UI CSS/SVG and existing test tools.
```
[VERIFIED: `package.json`; `packages/ui/package.json`; local-only project posture]

**Version verification:** Registry checks on 2026-05-16 environment reported `@playwright/test@1.60.0`, `vite@8.0.13`, and `vitest@4.1.6`; the repo remains pinned to its existing compatible versions and Phase 23 does not need a package-bump plan. [VERIFIED: npm registry query; `package.json`; `packages/ui/package.json`]

## Architecture Patterns

### System Architecture Diagram

```text
Theme picker / stored ahp-theme
              |
              v
documentElement[data-theme="hacker"]
              |
              +------------------------------+
              |                              |
              v                              v
Hacker-only token expansion          Shared CRT filter defs
in tokens.css                         mounted once in UI DOM
              |                              |
              v                              v
global.css overlay stack              filtered app display surface
scanlines / glass / rim /             whole-screen bounded displacement
noise / fringe / beats                         |
              |                                v
              +----------------------> visually unified CRT shell
                                               |
                                               v
header + timeline + detail drawer + menus + overlays
                                               |
                                               v
fixture Playwright + Vitest + webview parity checks
```

The diagram keeps data-flow ownership in the Browser / Client tier; no protocol, server, or file-ingest path participates in the CRT effect. [VERIFIED: `theme.ts`; `AppShell.tsx`; `global.css`; `.planning/PROJECT.md`]

### Recommended Project Structure

```text
packages/ui/src/
├── styles/tokens.css                 # Hacker CRT tuning tokens and static fallback values
├── styles/global.css                 # Hacker-only compositing, overlays, keyframes, reduced-motion block
├── components/shell/AppShell.tsx     # Mount shared shell and, if needed, one noninteractive filter-definitions node
└── components/shell/CrtFilterDefs.tsx # Optional tiny shared SVG defs component if inline defs are chosen

e2e/
└── phase23.spec.ts                   # Focused fixture screenshots and interaction/perf smoke

screenshots/phase23/
└── *.png                             # Fixture-only verification evidence
```

This structure is prescriptive for planning, but `CrtFilterDefs.tsx` should only become a file if the feasibility slice proves inline same-document SVG defs are the chosen implementation surface. [VERIFIED: current UI structure] [ASSUMED]

### Pattern 1: Separate Displacement From Decorative Overlays

**What:** Apply one bounded pixel-displacement path to the display surface, then keep scanlines, vignette, rim, noise, and fringe in pointer-transparent CSS layers. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] [VERIFIED: `global.css`]

**When to use:** Always for Phase 23. The D-01 warp needs a true rendered-surface distortion path, while the rest of D-05 maps more cheaply and predictably to CSS overlays. [VERIFIED: `23-CONTEXT.md`] [CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement]

**Example:**
```tsx
// Source: Filter Effects spec + project shell pattern; exact map authoring must be prototyped.
export function CrtFilterDefs(): JSX.Element {
  return (
    <svg className="crt-filter-defs" aria-hidden="true" focusable="false">
      <defs>
        <filter id="ahp-crt-warp" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.012"
            numOctaves="1"
            seed="23"
            result="ambientWarp"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="ambientWarp"
            scale="var(--effect-crt-warp-scale)"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
```
[CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement] [CITED: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap] [ASSUMED]

The example shows the primitive family, not a locked final map. The spec itself notes implementation mismatch for `<feDisplacementMap>`, so the plan should prototype this before final CSS/token tuning. [CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement]

### Pattern 2: Put the Filter on a Carefully Chosen Display Surface

**What:** Prefer a dedicated Hacker-only display wrapper or an equivalent surface that deliberately includes all intended UI, then test fixed descendant behavior. Avoid casually attaching a non-`none` filter to `.app-shell` without auditing the fixed drawer backdrop and overlay layers. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] [VERIFIED: `AppShell.tsx`; `global.css`]

**When to use:** In the first implementation plan. D-02 requires drawers and menus to visually belong to the CRT, but the filter containing-block rule can change fixed-position behavior if placement is wrong. [VERIFIED: `23-CONTEXT.md`; `AppShell.tsx`] [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty]

**Example:**
```css
/* Source: Filter Effects spec; selector names are planning guidance, not final API. */
[data-theme="hacker"] .crt-display-surface {
  filter: url("#ahp-crt-warp") saturate(1.08) contrast(1.05);
  overflow: clip;
}

[data-theme="hacker"] .crt-glass-overlay,
[data-theme="hacker"] .crt-scanline-overlay {
  pointer-events: none;
}
```
[CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events] [ASSUMED]

### Pattern 3: Reduced Motion Removes Temporal Instability, Not Static Identity

**What:** Keep static curvature/frame/vignette/noise/fringe styling in Hacker under reduced motion, while removing keyframe drift, pulse, glitch beats, and any animated filter-map changes. [VERIFIED: `23-CONTEXT.md`; `global.css`] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion]

**When to use:** In every motion-related task; D-11 locks this behavior. [VERIFIED: `23-CONTEXT.md`]

**Example:**
```css
/* Source: MDN prefers-reduced-motion + existing repo reduced-motion pattern. */
@media (prefers-reduced-motion: reduce) {
  [data-theme="hacker"] .crt-display-surface,
  [data-theme="hacker"] body::before,
  [data-theme="hacker"] body::after {
    animation: none;
    transition: none;
  }
}
```
[CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion] [VERIFIED: `global.css`]

### Anti-Patterns to Avoid

- **One giant animated filter graph for every CRT artifact:** `<feDisplacementMap>` can require substantial buffering proportional to displacement scale, and Filter Effects are applied to a grouped image buffer; use the filter for displacement, not every glow/noise detail. [CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement] [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty]
- **Filtering the shell without testing fixed overlays:** A non-`none` filter below the document root creates containing-block semantics for fixed descendants, while this app currently uses fixed drawer/backdrop layers. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] [VERIFIED: `global.css`; `AppShell.tsx`]
- **Assuming visual warp remaps clicks:** The Filter Effects spec states filter application does not affect hit-testing, so strong visual displacement can make controls appear offset from their interaction boxes. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty]
- **Fetching filter maps or textures at runtime:** Local-only posture and webview CSP both argue for in-bundle CSS/SVG, not outbound assets. [VERIFIED: `.planning/PROJECT.md`; `webviewHtml.ts`; `.github/copilot-instructions.md`]
- **Keeping Phase 5 Hacker opacity-bound tests unchanged:** `theme-tokens.test.ts` currently enforces old Phase 5 intensity caps that Phase 23 intentionally revisits; the plan must update the contract rather than fight it. [VERIFIED: `packages/ui/src/styles/theme-tokens.test.ts`; `23-CONTEXT.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Whole-screen CRT raster warp | Canvas copy of the DOM or a custom WebGL UI renderer | Browser SVG filter displacement on the existing DOM surface, after a feasibility proof | Phase 23 is a theme overhaul, not a renderer rewrite; current app value depends on native selectable/focusable DOM controls. [ASSUMED] [VERIFIED: `AppShell.tsx`] |
| Ambient analog motion | JavaScript timers or pointer-reactive animation engine | CSS keyframes plus `prefers-reduced-motion` overrides | Existing Hacker motion already lives in CSS and the reduced-motion test expects a CSS contract. [VERIFIED: `global.css`; `reduced-motion-css.test.ts`] |
| Interaction escape controls | New intensity sliders, presets, or runtime settings | Existing Hacker theme picker and immediate switch to Dark/Light | D-14 and D-15 lock the control surface. [VERIFIED: `23-CONTEXT.md`; `HeaderBar.tsx`] |
| External CRT textures/maps | Runtime HTTP asset loading or CDN imagery | In-bundle CSS gradients, inline SVG defs, or other locally bundled static assets if the spike requires them | The product posture forbids outbound viewing dependencies, and extension CSP is already scoped to bundled/local sources. [VERIFIED: `.planning/PROJECT.md`; `webviewHtml.ts`] |

**Key insight:** The difficult part is not inventing noise; it is applying enough true image-space displacement to satisfy D-01 without turning hit-testing, fixed overlays, and scroll performance into silent regressions. [VERIFIED: `23-CONTEXT.md`; codebase shell/layout] [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty]

## Common Pitfalls

### Pitfall 1: Visual Warp and Hit Targets Diverge
**What goes wrong:** Buttons, row edges, resize handles, and the drawer close control can look displaced while their browser hit areas stay at the original CSS-box positions. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] [VERIFIED: `AppShell.tsx`]
**Why it happens:** Filter Effects alter paint, not CSS box geometry or hit-testing. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty]
**How to avoid:** Bound displacement scale, test clicks on theme menu, row selection, drawer close, search input focus, and filter controls under Hacker, and treat any meaningful mismatch as a blocker. [ASSUMED] [VERIFIED: `e2e/phase5.spec.ts` existing relevant flow]
**Warning signs:** Playwright click targets work only with forced clicks, focus rings look visibly detached, or row hover appears offset from the cursor. [ASSUMED]

### Pitfall 2: Filter Placement Reparents Fixed UI Semantics
**What goes wrong:** Drawer backdrops or overlays that currently cover the viewport can become scoped to a filtered containing block or stack incorrectly. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] [VERIFIED: `global.css`]
**Why it happens:** A non-root filtered element creates a containing block for absolute and fixed descendants and a stacking context. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty]
**How to avoid:** The feasibility plan must test the exact filter attachment point with desktop rail, laptop drawer, picker/menu overlay, and drag/drop overlay before the full artifact stack lands. [ASSUMED] [VERIFIED: `AppShell.tsx`; `e2e/phase5.spec.ts`]
**Warning signs:** Drawer backdrop no longer fills the screen, z-index order changes, or the menu clips unexpectedly. [ASSUMED]

### Pitfall 3: Filter Region Clips the Aggressive Rim or Warp
**What goes wrong:** The tube edge, displaced corners, glow, or glitch pulse gets cropped sharply instead of reading as a curved screen. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterPrimitiveSubRegion] [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty]
**Why it happens:** Filter regions and primitive subregions are clipping rectangles; the spec defaults may be insufficient for aggressive displacement plus glow. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterPrimitiveSubRegion]
**How to avoid:** Set an explicit padded filter region, pair it with a deliberate viewport/tube clipping strategy, and inspect corners at desktop, laptop drawer, narrow, and ultrawide sizes. [ASSUMED] [VERIFIED: `e2e/phase5.spec.ts` viewport coverage]
**Warning signs:** Hard rectangular cutoffs at corners, disappearing fringe near edges, or screenshot-only corner seams. [ASSUMED]

### Pitfall 4: Animating the Expensive Layer Undoes Phase 22 Comfort
**What goes wrong:** Heavy continuous displacement/filter animation competes with virtualized timeline updates and creates visible jank while large logs load or append bursts arrive. [VERIFIED: `22-CONTEXT.md`] [CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement]
**Why it happens:** The spec notes displacement can require substantial buffering; Phase 22 explicitly prioritizes interaction responsiveness over earliest possible row visibility. [CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement] [VERIFIED: `22-CONTEXT.md`]
**How to avoid:** Make static warp the default geometry, place restless motion mostly in cheap opacity/transform overlay layers, and treat animated filter-parameter changes as an opt-in implementation result only if profiling remains acceptable. [ASSUMED]
**Warning signs:** Scroll/tail follow stutters under the long fixture, animation cadence falls apart during append, or browser traces show repeated whole-surface expensive paint work. [ASSUMED]

### Pitfall 5: Webview CSP or URL Semantics Break Filter Resources
**What goes wrong:** A filter map that works in standalone fails or disappears in the extension webview. [ASSUMED] [VERIFIED: `webviewHtml.ts` CSP]
**Why it happens:** The extension emits a strict CSP and asset URIs are transformed through `webview.asWebviewUri`; runtime external fetches are not part of the product posture. [VERIFIED: `packages/extension/src/extension.ts`; `webviewHtml.ts`; `.planning/PROJECT.md`]
**How to avoid:** Prefer inline DOM SVG filter definitions or other in-bundle static resources proven in both standalone and extension HTML; do not rely on remote or filesystem URL filters. [ASSUMED] [VERIFIED: `webviewHtml.ts`]
**Warning signs:** Standalone screenshots show warp while extension screenshots show only flat overlays. [ASSUMED]

## Code Examples

Verified patterns from official sources and the current repo:

### CSS Can Reference an SVG Filter by URL
```css
/* Source: MDN CSS filter docs. */
.crt-display-surface {
  filter: url("#ahp-crt-warp");
}
```
[CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/filter]

### Displacement Uses an Input Map and Scale
```xml
<!-- Source: Filter Effects spec and MDN feDisplacementMap docs. -->
<filter id="ahp-crt-warp">
  <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="1" result="warp-map" />
  <feDisplacementMap in="SourceGraphic" in2="warp-map" scale="18" xChannelSelector="R" yChannelSelector="G" />
</filter>
```
[CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement] [CITED: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap]

### Overlay Layers Must Stay Pointer-Transparent
```css
/* Source: MDN pointer-events docs + current repo body pseudo-element pattern. */
[data-theme="hacker"] body::before,
[data-theme="hacker"] body::after {
  pointer-events: none;
}
```
[CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events] [VERIFIED: `global.css`]

### Existing Theme Contract Should Stay Intact
```ts
// Source: current repo theme contract.
export function applyTheme(theme: ThemeId, root: Element = document.documentElement): void {
  root.setAttribute("data-theme", theme);
}
```
[VERIFIED: `packages/ui/src/theme/theme.ts`]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat Hacker overlays only: scanlines, grid/vignette, glow, pulse | Whole-screen CRT should add a real rendered-surface warp while retaining layered overlays | Phase 23 planning target, not implemented yet | Planning must treat filter feasibility as a first-class task rather than just raise opacity tokens. [VERIFIED: `global.css`; `23-CONTEXT.md`] |
| Generic visual polish validation | Fixture screenshot matrix plus interaction checks under exact CRT stress cases | Existing repo pattern from Phase 5; Phase 23 should extend it | Existing E2E flow already covers key screens and can be sharpened for warped hit-testing. [VERIFIED: `e2e/phase5.spec.ts`] |
| Static token bounds from earlier Hacker UI-SPEC | Phase 23 bold curated treatment needs updated token expectations | Phase 23 planning target | Old `--effect-*` cap test becomes a contract to revise, not a source of truth to preserve unchanged. [VERIFIED: `theme-tokens.test.ts`; `23-CONTEXT.md`] |

**Deprecated/outdated for this phase:**
- Treating body pseudo-element overlays alone as “CRT warp” is no longer sufficient; D-01 explicitly demands visible curved-glass distortion. [VERIFIED: `23-CONTEXT.md`; `global.css`]
- Keeping Phase 5's Hacker opacity caps as fixed product law is outdated for Phase 23 because the phase deliberately starts more aggressive. [VERIFIED: `theme-tokens.test.ts`; `23-CONTEXT.md`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CSS-only frame/perspective treatments cannot by themselves satisfy the user's intent for a visible whole-screen warp. | Standard Stack alternatives | Planner might over-invest in SVG displacement if the user would accept fake curvature. |
| A2 | A canvas/WebGL post-process would be disproportionate for this interactive DOM viewer. | Standard Stack alternatives / Don't Hand-Roll | Planner could miss a shader-based option if Rob actually wants a renderer-level experiment. |
| A3 | A dedicated `CrtFilterDefs.tsx` component is a useful implementation shape if inline SVG defs are selected. | Recommended Project Structure | Planner may instead keep defs in `AppShell` or HTML without harming behavior. |
| A4 | The feasibility plan can bound pointer mismatch with visual scale choices rather than needing a custom inverse pointer transform. | Common Pitfalls | If the desired warp is stronger than hit-testing tolerates, scope or architecture must be revisited. |
| A5 | Inline/in-bundle filter resources will be more robust in webview than URL-fetched filter maps. | Common Pitfalls / Security | Extension CSP or implementation quirks could still require a different bundled asset shape. |

## Open Questions (RESOLVED)

1. **Chosen warp strategy: use the bundled same-document SVG displacement path, but treat Plan 23-01 as the execution gate for that choice.**
  - Outcome: Planning should commit to the shared CSS/SVG path described above: an inline or otherwise bundled same-document `<feDisplacementMap>` filter mounted through the shared UI runtime, with the full CRT surface staying Hacker-only. This is the Phase 23 direction because it best matches D-01, D-02, D-04, and D-16 without introducing a renderer rewrite or outbound assets. [VERIFIED: `23-CONTEXT.md`; `23-UI-SPEC.md`] [CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement]
  - Plan 23-01 gate: Before later plans depend on richer analog styling, Plan 23-01 must prove the authored filter renders as an intentionally non-flat shared display surface, the attachment point covers shell content plus the risky overlay ownership set, and ordinary Playwright interactions remain usable with the selected wrapper. [VERIFIED: `23-01-PLAN.md`; `23-UI-SPEC.md`] [ASSUMED]
  - Runtime parity rule: Standalone proof in Plan 23-01 is necessary to proceed; Phase 23 is not complete until Plan 23-03 also confirms the shared bundled delivery path remains compatible with extension webview CSP/local-asset constraints. If that parity gate fails, revise the bundled filter attachment/resource shape rather than creating a forked Hacker runtime. [VERIFIED: `23-03-PLAN.md`; `23-CONTEXT.md`; `23-UI-SPEC.md`]

2. **Chosen displacement policy: start bold, then bound or reduce only when pointer honesty checks fail.**
  - Outcome: Planning should keep the aggressive first-pass displacement posture from D-04, but any strength that makes visible controls feel materially detached from their real hit areas is outside the approved execution envelope. Filters do not move DOM hit-testing, so perceived pointer truth is a gating usability condition, not a later polish note. [VERIFIED: `23-CONTEXT.md`; `23-UI-SPEC.md`] [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty]
  - Plan 23-01 gate: The initial displacement value and attachment point must survive non-forced Theme picker, timeline row, search focus, picker dialog, and responsive drawer-close checks before Plan 23-02 amplifies the Hacker presentation. If those checks expose dishonest target alignment, execution should lower displacement or alter the shared surface strategy while preserving the whole-screen CRT goal. [VERIFIED: `23-01-PLAN.md`; `23-UI-SPEC.md`] [ASSUMED]
  - Later approval rule: Plan 23-03's fixture screenshots and human pointer-honesty checkpoint decide whether the bold result is acceptable as a curated Hacker default; that review may back intensity off, consistent with the locked "start aggressive, tune down later" context. [VERIFIED: `23-03-PLAN.md`; `23-CONTEXT.md`]

3. **Chosen motion policy: ambient instability stays in cheaper overlays by default; displacement animation is not a baseline requirement.**
  - Outcome: Plan the restless CRT identity around static displacement plus CSS overlay opacity/transform beats, scan/noise/glass motion, and reduced-motion removal of temporal effects. This aligns D-08 through D-12 with Phase 22's responsiveness posture. [VERIFIED: `23-CONTEXT.md`; `23-UI-SPEC.md`; `22-CONTEXT.md`] [CITED: https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement]
  - Execution rule: Animated modulation of the displacement map may be attempted only as a bounded enhancement after Plan 23-01 proves the static/shared warp path; it must be dropped or kept static if long-fixture/responsiveness evidence in the later validation plan shows risk. The curated Phase 23 treatment remains valid without animated displacement because visible instability is carried by the cheaper overlay stack. [VERIFIED: `23-03-PLAN.md`; `23-UI-SPEC.md`] [ASSUMED]
  - Reduced-motion rule: Regardless of whether a profiled displacement beat is attempted, `prefers-reduced-motion: reduce` must keep the static CRT identity while removing animated drift, pulses, glitches, and any filter-map modulation. [VERIFIED: `23-CONTEXT.md`; `23-UI-SPEC.md`]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Workspace build/test scripts | Yes | v22.22.1 | - [VERIFIED: terminal audit] |
| pnpm | Workspace scripts | Yes | 9.15.0 | - [VERIFIED: terminal audit] |
| npm CLI | Registry version checks | Yes | 10.9.4 | - [VERIFIED: terminal audit] |
| Browser CSS/SVG Filter Effects | CRT implementation | Available in target standards; exact app/webview composition still needs spike | Browser primitive | CSS-only cosmetic fallback would not fully satisfy D-01. [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/filter] [CITED: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap] [ASSUMED] |

**Missing dependencies with no fallback:**
- None identified for research or planning. [VERIFIED: terminal audit; repo package manifests]

**Missing dependencies with fallback:**
- None identified. [VERIFIED: terminal audit]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest repo `^4.1.5` plus Playwright repo `^1.59.1`; registry currently reports Vitest `4.1.6`, Playwright `1.60.0`. [VERIFIED: `package.json`; npm registry query] |
| Config file | `vitest.config.ts`, `packages/ui/vitest.config.ts`, `playwright.config.ts`. [VERIFIED: workspace tree; file names] |
| Quick run command | `pnpm -F @ahp-inspector/ui test` for focused UI/token tests, or `pnpm exec vitest run packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/reduced-motion-css.test.ts packages/ui/src/theme/theme.test.ts`. [VERIFIED: package scripts; test files] |
| Full suite command | `pnpm test && pnpm e2e` is the existing root validation shape; Phase 23 planning may add a focused `playwright test e2e/phase23.spec.ts` gate. [VERIFIED: `package.json`] [ASSUMED] |

### Phase Behaviors -> Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Hacker remains a normal persisted theme with Dark/Light untouched | unit | `pnpm exec vitest run packages/ui/src/theme/theme.test.ts packages/ui/src/components/shell/HeaderBar.test.tsx` | Yes. [VERIFIED: grep search] |
| Hacker tokens expose the new CRT tuning surface and obsolete Phase 5 caps are updated intentionally | unit | `pnpm exec vitest run packages/ui/src/styles/theme-tokens.test.ts` | Yes, but assertions need Phase 23 revision. [VERIFIED: `theme-tokens.test.ts`] |
| Reduced motion removes animated drift/pulses/glitches while static CRT remains | unit/CSS contract | `pnpm exec vitest run packages/ui/src/styles/reduced-motion-css.test.ts` | Yes, but it should be expanded for new animation names/selectors. [VERIFIED: `reduced-motion-css.test.ts`] |
| Warped Hacker UI keeps theme menu, row click, search focus, drawer close, and overlay layout usable | E2E | `pnpm exec playwright test e2e/phase23.spec.ts` | No, Wave 0/new plan work. [ASSUMED] |
| Fixture screenshots capture desktop, drawer, narrow/wide edges, and extension/webview-sensitive surfaces | E2E/visual evidence | `pnpm exec playwright test e2e/phase23.spec.ts` plus existing fixture launch pattern | No dedicated Phase 23 file; Phase 5 provides a template. [VERIFIED: `e2e/phase5.spec.ts`] |
| CRT effect does not obviously compromise Phase 22 responsive interaction under a long fixture | E2E/manual trace or bounded smoke | `pnpm start:long` plus focused browser verification, or a dedicated Playwright perf smoke if planning judges it reliable | Partial infrastructure only. [VERIFIED: `package.json`; `22-CONTEXT.md`] [ASSUMED] |

### Sampling Rate
- **Per task commit:** Run focused Vitest files that touch tokens/global/theme contracts. [ASSUMED]
- **Per wave merge:** Run focused Phase 23 Playwright scenario once it exists plus UI test package. [ASSUMED]
- **Phase gate:** Full UI/build validation plus fixture screenshots under `screenshots/phase23/`; include reduced-motion and extension/webview parity evidence. [VERIFIED: `.github/copilot-instructions.md`] [ASSUMED]

### Wave 0 Gaps
- [ ] Add a dedicated Phase 23 Playwright scenario for warped interactions and screenshot evidence, likely using the Phase 5 safe fixture pattern. [VERIFIED: `e2e/phase5.spec.ts`] [ASSUMED]
- [ ] Update Hacker effect-token assertions that encode the older UI-SPEC intensity ceiling. [VERIFIED: `theme-tokens.test.ts`; `23-CONTEXT.md`]
- [ ] Expand reduced-motion CSS assertions to mention every new Hacker animation selector/keyframe introduced by Phase 23. [VERIFIED: `reduced-motion-css.test.ts`] [ASSUMED]
- [ ] Implement the resolved extension parity hook in Plan 23-03: retain webview HTML/CSP local-asset checks and inspect the copied extension UI bundle for the shared CRT SVG/filter/compositing surface delivered to the webview path. [VERIFIED: `23-03-PLAN.md`; `packages/extension/src/extension.test.ts`; `webviewHtml.ts`] [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No new auth surface in this visual-only phase. [VERIFIED: phase scope] | Preserve existing app behavior. [VERIFIED: `23-CONTEXT.md`] |
| V3 Session Management | No new session storage or server session behavior. [VERIFIED: phase scope] | Preserve existing `ahp-theme` local-storage-only persistence contract. [VERIFIED: `theme.ts`] |
| V4 Access Control | No new access-control surface. [VERIFIED: phase scope] | Preserve existing local viewer and extension boundaries. [VERIFIED: `.planning/PROJECT.md`] |
| V5 Input Validation | Yes, indirectly for asset/resource posture. [VERIFIED: local-only/CSP context] | Do not accept user-provided filter URLs or map inputs; keep effect definitions code-owned and bundled. [ASSUMED] |
| V6 Cryptography | No. [VERIFIED: phase scope] | Do not add crypto. [VERIFIED: phase scope] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| External filter/texture URL slips into runtime | Information Disclosure / Tampering | Keep CRT assets inline or bundled; maintain webview CSP and no outbound runtime dependencies. [VERIFIED: `.planning/PROJECT.md`; `webviewHtml.ts`] |
| Real log data appears in saved CRT screenshots | Information Disclosure | Use fixture JSONL only and save under `screenshots/phase23/`. [VERIFIED: `.github/copilot-instructions.md`] |
| Aggressive overlays intercept controls | Denial of Service to interaction | Keep visual-only layers `pointer-events: none`; verify focus/click flows. [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events] [ASSUMED] |

## Recommended Plan Split

1. **23-01 Warp feasibility and placement proof:** Mount the smallest possible shared SVG/CSS displacement experiment, pick the filter attachment point, verify fixed drawer/menu/drop-overlay geometry, and decide whether authored radial distortion is viable or whether the phase should use broad bounded displacement plus CRT frame shading. [VERIFIED: `AppShell.tsx`; `global.css`] [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] [ASSUMED]
2. **23-02 Hacker CRT token and overlay overhaul:** Expand Hacker-only tokens, implement tube rim/glass vignette/scanlines/noise/edge fringe/signal beats, preserve Dark/Light, and implement the static reduced-motion version. [VERIFIED: `tokens.css`; `global.css`; `23-CONTEXT.md`]
3. **23-03 Validation and responsiveness evidence:** Update token/reduced-motion tests, add fixture Playwright screenshots and hit-target interactions, include an extension/webview parity check, and smoke long-fixture responsiveness so Phase 22's posture is not casually regressed. [VERIFIED: `e2e/phase5.spec.ts`; `theme-tokens.test.ts`; `reduced-motion-css.test.ts`; `22-CONTEXT.md`] [ASSUMED]

This split is recommended because Plan 23-01 can disconfirm the riskiest assumption before detailed values, screenshot baselines, and motion choreography are built on top of a bad filter placement. [CITED: https://drafts.csswg.org/filter-effects-1/#FilterProperty] [ASSUMED]

## Sources

### Primary (HIGH confidence)
- `23-CONTEXT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md` - locked phase intent, Phase 22 posture, product/local-only constraints. [VERIFIED: direct reads]
- `packages/ui/src/styles/tokens.css`, `packages/ui/src/styles/global.css`, `packages/ui/src/theme/theme.ts`, `HeaderBar.tsx`, `AppShell.tsx` - existing theme architecture and shell/layout surfaces. [VERIFIED: direct reads]
- https://drafts.csswg.org/filter-effects-1/#FilterProperty - filter paint model, containing-block/stacking-context effects, hit-testing caveat. [CITED]
- https://drafts.csswg.org/filter-effects-1/#feDisplacementMapElement - displacement formula, scale semantics, buffering/performance caveat, implementation mismatch issue. [CITED]
- https://drafts.csswg.org/filter-effects-1/#FilterPrimitiveSubRegion - filter-region clipping model. [CITED]

### Secondary (MEDIUM confidence)
- https://developer.mozilla.org/en-US/docs/Web/CSS/filter - CSS filter URL syntax and compatibility summary, page modified Apr 20, 2026. [CITED]
- https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap - `<feDisplacementMap>` attributes/example and compatibility summary, page modified Oct 27, 2025. [CITED]
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion - reduced-motion meaning and compatibility summary, page modified Apr 20, 2026. [CITED]
- https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events - pointer-transparent overlays and compatibility summary, page modified Apr 20, 2026. [CITED]
- npm registry version queries for `@playwright/test`, `vite`, `vitest`. [VERIFIED: npm registry]

### Tertiary (LOW confidence)
- No external unverified community sources were used. Open assumptions are listed explicitly in the Assumptions Log. [VERIFIED: research process]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - it reuses the repo's current CSS/React/test stack and relies on documented platform primitives rather than new dependencies. [VERIFIED: package manifests; direct code reads] [CITED: Filter Effects spec]
- Architecture: MEDIUM - shared shell integration is clear, but filter attachment and displacement-map authoring need the recommended feasibility plan. [VERIFIED: `AppShell.tsx`; `global.css`] [CITED: Filter Effects spec]
- Pitfalls: HIGH - containing-block, hit-testing, clipping, and displacement buffering caveats are directly documented or visible in current code structure. [CITED: Filter Effects spec] [VERIFIED: current shell/global CSS]

**Research date:** 2026-05-16 [VERIFIED: `date +%F`]
**Valid until:** 2026-06-15 for planning guidance, with browser-filter spike results overriding the assumptions immediately once available. [ASSUMED]
