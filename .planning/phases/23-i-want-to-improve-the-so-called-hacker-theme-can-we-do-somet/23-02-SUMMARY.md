---
phase: 23-i-want-to-improve-the-so-called-hacker-theme-can-we-do-somet
plan: 02
subsystem: ui
tags: [hacker-theme, crt, css, reduced-motion, design-tokens]
requires:
  - phase: 23-i-want-to-improve-the-so-called-hacker-theme-can-we-do-somet
    provides: verified shared CRT displacement surface from Plan 23-01
provides:
  - Exact Hacker CRT tuning tokens with neutral non-Hacker defaults
  - Whole-screen CRT frame, glass, vignette, fringe, and ambient signal CSS
  - Reduced-motion contract tests that keep static CRT identity while disabling animation
affects: [ui-theme, crt-verification, screenshots-phase23, webview-parity]
tech-stack:
  added: []
  patterns: [tokenized visual intensity, css-only ambient CRT motion, reduced-motion selector contract]
key-files:
  created: []
  modified:
    - packages/ui/src/styles/tokens.css
    - packages/ui/src/styles/global.css
    - packages/ui/src/styles/theme-tokens.test.ts
    - packages/ui/src/styles/reduced-motion-css.test.ts
key-decisions:
  - "Phase 23 Hacker CRT intensity is encoded as exact theme tokens, with Dark and Light carrying explicit neutral values to prevent effect leakage."
  - "Whole-surface CRT ambience may animate opacity and overlays, but not continuous geometric transforms that make ordinary controls fail click-stability checks."
patterns-established:
  - "CRT CSS motion remains ambient and CSS-only, while reduced-motion tests explicitly enumerate every new animation-bearing selector."
  - "Wave-level Playwright smoke remains the arbiter for whether aggressive Hacker styling still preserves ordinary interaction behavior."
requirements-completed: []
duration: 4min
completed: 2026-05-17
---

# Phase 23 Plan 02: Hacker CRT Analog Stack Summary

**Hacker now ships an aggressively tokenized CRT frame, glass, fringe, scanline, and signal-beat visual stack, with reduced-motion protection and click-stability preserved.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-17T18:14:49Z
- **Completed:** 2026-05-17T18:18:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced the old restrained Hacker-effect bounds with exact Phase 23 CRT token contracts and neutral Dark/Light defaults.
- Built the framed CRT shell, denser scanlines, glass/vignette/noise body layer, edge-weighted cyan/magenta fringe, and occasional signal-beat keyframes in shared CSS.
- Expanded reduced-motion coverage so the static Hacker CRT selectors remain represented while Phase 23 temporal effects are disabled.
- Rebuilt the CLI-served UI and kept the fixture-backed `CRT smoke` ordinary-click drawer/picker flow green after the stronger visual stack landed.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: CRT token contract tests** - `242b862` (test)
2. **Task 1 GREEN: exact CRT theme tokens** - `dedc060` (feat)
3. **Task 2 RED: reduced-motion CRT selector contract** - `7b11708` (test)
4. **Task 2 GREEN: analog CRT compositing CSS** - `c2464dd` (feat)
5. **Formatting cleanup: token contract test** - `4473732` (style)
6. **Rule 1 fix: preserve click stability under CRT ambience** - `7a8c7d0` (fix)

## Files Created/Modified
- `packages/ui/src/styles/tokens.css` - Exact Hacker CRT tuning values plus neutral CRT defaults outside Hacker.
- `packages/ui/src/styles/global.css` - Frame, scanline, glass, fringe, signal-beat, and reduced-motion CRT styling.
- `packages/ui/src/styles/theme-tokens.test.ts` - Exact CRT token inventory and aggressive/neutral value assertions.
- `packages/ui/src/styles/reduced-motion-css.test.ts` - Reduced-motion selector and animation-name contract for the new analog stack.

## Decisions Made
Hacker's bolder CRT identity remains concentrated in tokens and shared CSS rather than adding component switches or settings. The first whole-surface geometric drift experiment was too interaction-hostile under ordinary Playwright clicks, so the surface animation keeps ambient life through opacity while overlay-level signal/fringe effects carry the more visible analog instability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept CRT surface animation from destabilizing ordinary clicks**
- **Found during:** Wave-level Plan 23-02 browser smoke after Task 2 GREEN
- **Issue:** Continuous geometric animation on `.crt-display-surface` kept descendant timeline rows visually unstable to Playwright, causing an ordinary `row-0` click to time out.
- **Fix:** Retained the planned `ahp-crt-surface-drift` cadence but changed its keyframes from whole-surface transform motion to non-geometric opacity breathing; the more noticeable signal jolt remains on the decorative overlay path.
- **Files modified:** `packages/ui/src/styles/global.css`
- **Verification:** `pnpm exec vitest run packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/reduced-motion-css.test.ts packages/ui/src/theme/theme.test.ts`, `pnpm -F @ahp-inspector/ui build`, and `pnpm exec playwright test e2e/phase23.spec.ts --grep "CRT smoke"` all passed.
- **Committed in:** `7a8c7d0`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** The correction preserves the approved dramatic CRT system while enforcing the previously locked interaction-honesty constraint. No new scope was added.

## Issues Encountered
- The planned post-wave browser smoke surfaced the whole-surface transform click-stability regression immediately; replacing that motion path resolved it without weakening the rest of the tokenized CRT stack.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Plan 23-03 can now focus on final fixture screenshots, broader Phase 23 Playwright evidence, extension webview parity, and the explicit visual review checkpoint over the finished CRT stack.

## Self-Check: PASSED

- Confirmed the summary's modified key files exist on disk.
- Confirmed commits `242b862`, `dedc060`, `7b11708`, `c2464dd`, `4473732`, and `7a8c7d0` exist in git history.

---
*Phase: 23-i-want-to-improve-the-so-called-hacker-theme-can-we-do-somet*
*Completed: 2026-05-17*