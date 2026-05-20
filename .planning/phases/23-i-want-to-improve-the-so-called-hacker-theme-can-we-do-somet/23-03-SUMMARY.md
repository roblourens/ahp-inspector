---
phase: 23-i-want-to-improve-the-so-called-hacker-theme-can-we-do-somet
plan: 03
subsystem: ui-verification
tags: [hacker-theme, crt, playwright, webview-parity, webgl]
requires:
  - phase: 23-i-want-to-improve-the-so-called-hacker-theme-can-we-do-somet
    provides: tokenized CRT shell and fixture-backed smoke from Plans 23-01 and 23-02
provides:
  - Fixture-only Phase 23 screenshot matrix plus quick and long-fixture browser smoke
  - Extension copied-bundle parity coverage for local CRT delivery
  - Crash-safe CRT implementation direction replacing production SVG warp attachment with a WebGL glass overlay and foreground analog texture
  - Explicit human visual approval of the final fixture evidence
affects: [phase23-validation, screenshots-phase23, extension-webview-parity, hacker-theme]
tech-stack:
  added: []
  patterns: [fixture-only visual evidence, copied-bundle parity checks, shader overlay fallback for unsafe browser filter effects]
key-files:
  created:
    - packages/ui/src/components/shell/CrtCurvatureCanvas.tsx
  modified:
    - e2e/phase23.spec.ts
    - packages/extension/src/__test__/webviewHtml.test.ts
    - packages/ui/src/components/shell/AppShell.tsx
    - packages/ui/src/components/shell/CrtFilterDefs.tsx
    - packages/ui/src/styles/global.css
    - screenshots/phase23/
key-decisions:
  - "Keep the SVG CRT filter definitions bundled for parity evidence, but detach `url(\"#ahp-crt-warp\")` from production CSS after long-fixture Chromium/Electron crashes proved the whole-screen filter graph unsafe."
  - "Use a theme-gated WebGL canvas for curved-glass edge bloom and let pointer-transparent CSS overlays/text glow carry the more analog foreground character."
  - "After user review, soften the shader background and introduce less regular foreground scanline modulation so the final Hacker treatment reads more CRT than folded interference."
patterns-established:
  - "A hidden visual layer is not enough to save work: theme-gated GPU effects must stop their animation loop outside Hacker."
  - "Phase screenshot evidence stays fixture-only and is paired with browser smoke that fails on page errors, interaction regressions, or remote-path leaks."
requirements-completed: []
duration: iterative visual tuning
completed: 2026-05-19
---

# Phase 23 Plan 03: CRT Evidence, Safety, and Visual Approval Summary

**Phase 23 now has fixture-backed screenshot evidence, extension bundle parity checks, a crash-safe shader/foreground CRT direction, and explicit visual approval.**

## Accomplishments
- Expanded `e2e/phase23.spec.ts` into a quick `CRT smoke`, a five-screenshot fixture matrix, reduced-motion evidence, privacy guards, and a long-realistic fixture stability smoke that fails on page errors.
- Kept extension delivery local and verified copied UI bundle parity through `webviewHtml.test.ts`, including the retained SVG definitions, detached production filter attachment, and WebGL canvas shipping in copied assets.
- Investigated the renderer crashes caused by whole-screen SVG filter attachment, preserved the definitions as inert bundled evidence, and shifted production curvature to a pointer-transparent `CrtCurvatureCanvas` overlay.
- Added foreground CRT character through phosphor text glow, chromatic separation, screen-door texture, moving interference, and reduced-motion-safe animation suppression.
- Tuned the final Hacker presentation from feedback: background glass became calmer, while scanlines gained less mechanical regularity. Rob approved the regenerated fixture screenshots on 2026-05-19.

## Files Created/Modified
- `packages/ui/src/components/shell/CrtCurvatureCanvas.tsx` - Theme-gated WebGL glass/lens overlay with reduced-motion and cleanup handling.
- `packages/ui/src/components/shell/CrtFilterDefs.tsx` - Retained inert same-document SVG filter defs with zero production displacement.
- `packages/ui/src/components/shell/AppShell.tsx` - Mounts the display surface, SVG defs, and curvature canvas together.
- `packages/ui/src/styles/global.css` - Crash-safe Hacker surface, foreground CRT glow/texture/sweep layers, shader canvas placement, and reduced-motion suppression.
- `e2e/phase23.spec.ts` - Fixture smoke, screenshot matrix, reduced-motion proof, path-leak guard, and long-log runtime stability signal.
- `packages/extension/src/__test__/webviewHtml.test.ts` - Local webview delivery and copied-bundle CRT parity assertions.
- `screenshots/phase23/` - Five regenerated fixture-only approval screenshots.

## Decisions Made
The original Phase 23 SVG displacement approach was valuable as a discovery path, but not a production path. Even with displacement scale reduced to zero, keeping the whole-screen filter graph attached could still crash the renderer on realistic pages. The final implementation therefore preserves same-document SVG assets for delivery/parity evidence while production paint uses safer CSS and WebGL layers.

The WebGL overlay is intentionally a material/lens cue rather than a dominant animated shape. After the strongest curved contour bands read as folded background geometry, the final shader was softened and the irregularity moved into foreground scanline modulation where it reads more like imperfect phosphor refresh.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Detached renderer-crashy whole-screen SVG warp filter**
- **Found during:** Long-fixture visual verification while tuning displacement intensity
- **Issue:** Chromium/Electron could crash when Hacker attached the full SVG filter graph to the whole app surface; reducing numeric displacement alone did not make the graph safe.
- **Fix:** Removed the production CSS `url("#ahp-crt-warp")` attachment, preserved bundled inert defs for asset/parity checks, and updated browser/extension assertions around the safe contract.
- **Files modified:** `packages/ui/src/styles/global.css`, `packages/ui/src/components/shell/CrtFilterDefs.tsx`, `e2e/phase23.spec.ts`, `packages/extension/src/__test__/webviewHtml.test.ts`
- **Verification:** `pnpm exec playwright test e2e/phase23.spec.ts`; focused webview HTML parity tests.

**2. [Rule 1 - Bug] Replaced unstable visual curvature experiments with a theme-gated shader overlay**
- **Found during:** Iterative visual evaluation after the SVG path was abandoned
- **Issue:** CSS perspective variants were too subtle or changed fixed overlay geometry, while strong shader bands initially read more like folds than CRT glass.
- **Fix:** Added `CrtCurvatureCanvas`, gated its animation loop by Hacker theme, softened the final shader background, and retained existing drawer geometry behavior.
- **Files modified:** `packages/ui/src/components/shell/CrtCurvatureCanvas.tsx`, `packages/ui/src/components/shell/AppShell.tsx`, `packages/ui/src/styles/global.css`, `e2e/phase23.spec.ts`
- **Verification:** `pnpm exec playwright test e2e/phase23.spec.ts --grep 'CRT smoke'`; full Phase 23 browser suite.

**3. [User feedback] Made foreground content feel more analog without sacrificing readability**
- **Found during:** User review of the early safe shader result
- **Issue:** Text/content still felt too plain, and the regular scan pattern read too evenly.
- **Fix:** Added phosphor/chromatic text glow, foreground screen-door layers, a restrained interference sweep, and uneven scanline modulation, all suppressed under reduced motion.
- **Files modified:** `packages/ui/src/styles/global.css`, `e2e/phase23.spec.ts`, `packages/extension/src/__test__/webviewHtml.test.ts`
- **Verification:** Rebuilt fixture screenshots, reduced-motion evidence, browser smoke, and copied-bundle parity tests.

---

**Total deviations:** 3 handled during execution (2 implementation safety fixes, 1 feedback-driven visual refinement).
**Impact on plan:** The visual target remains a bold Hacker CRT treatment, but the production implementation is safer and more truthful than the original SVG-warp plan.

## Verification
- `pnpm exec playwright test e2e/phase23.spec.ts --grep 'CRT smoke'`
- `pnpm exec playwright test e2e/phase23.spec.ts`
- `pnpm -F @ahp-inspector/ui build`
- `pnpm -F @ahp-inspector/extension build`
- Focused unit/parity tests for `webviewHtml.test.ts` and `AppShell.test.tsx`
- Editor diagnostics for CRT component, CSS, E2E, and extension parity files

All commands listed above passed on 2026-05-19 before this summary was finalized.

## Human Review
Rob approved the regenerated Phase 23 fixture screenshots and current CRT visual direction on 2026-05-19 after the calmer shader background and less regular scanline pass landed.

## Next Phase Readiness
Plan 23-03 is complete from an implementation and approval standpoint. The remaining repository action is to commit this approved follow-up as the next phase-sized change using the repo's one-main-commit-per-phase workflow.

---
*Phase: 23-i-want-to-improve-the-so-called-hacker-theme-can-we-do-somet*
*Completed: 2026-05-19*