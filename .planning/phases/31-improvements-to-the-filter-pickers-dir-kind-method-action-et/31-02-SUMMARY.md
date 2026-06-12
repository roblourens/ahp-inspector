---
phase: 31-improvements-to-the-filter-pickers-dir-kind-method-action-et
plan: 02
subsystem: ui
tags: [playwright, filters, popovers, css-anchors, privacy]
requires:
  - phase: 31-improvements-to-the-filter-pickers-dir-kind-method-action-et
    provides: contextual facet behavior, deterministic ordering, and local border-box geometry
provides:
  - fixture-only browser proof across desktop, narrow, Dark, Light, and Hacker surfaces
  - unclipped narrow popovers through CSS anchor positioning with a trigger-relative fallback
  - mutually exclusive facet and Group picker open state
  - updated Phase 25 compatibility contract
  - synthetic visual evidence for Phase 31
affects: [filter-bar, facet-popover, grouping-picker, browser-verification]
tech-stack:
  added: []
  patterns: [feature-detected CSS anchor positioning, fixture-only screenshot evidence, shared picker-open owner]
key-files:
  created:
    - e2e/phase31.spec.ts
    - packages/ui/src/components/filters/popoverPosition.ts
    - packages/ui/src/components/filters/popoverPosition.test.ts
    - screenshots/phase31/01-dark-method-desktop.png
    - screenshots/phase31/02-light-method-desktop.png
    - screenshots/phase31/03-hacker-method-desktop.png
    - screenshots/phase31/04-dark-method-narrow.png
    - screenshots/phase31/05-dark-group-session.png
  modified:
    - e2e/phase25.spec.ts
    - packages/ui/src/components/filters/FacetPopover.tsx
    - packages/ui/src/components/filters/FilterBar.tsx
    - packages/ui/src/components/filters/GroupToggleChip.tsx
    - packages/ui/src/components/filters/FilterBar.test.tsx
key-decisions:
  - "Use feature-detected native CSS anchors to escape narrow toolbar clipping without JavaScript geometry measurement, with absolute trigger-relative positioning as the compatibility fallback."
  - "Facet and Group pickers share FilterBar's openPopover owner so direct picker switching cannot leave two menus open."
  - "Saved browser evidence is generated only from PHASE5_BASE_JSONL plus explicitly synthetic Phase 31 rows and is path-leak checked before every capture."
patterns-established:
  - "Floating filter surfaces use feature-detected CSS anchors with a no-measurement fallback."
  - "Visual evidence tests assert painted viewport visibility in addition to bounding-box containment."
requirements-completed: []
duration: 28min
completed: 2026-06-11
---

# Phase 31 Plan 02: Fixture-Only Browser Proof Summary

**Filter pickers now have fixture-backed desktop, narrow, all-theme, and Group-row proof, including unclipped narrow menus and a compatibility-safe positioning fallback.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-06-12T01:22:42Z
- **Completed:** 2026-06-12T01:50:00Z
- **Tasks:** 1
- **Files modified:** 16

## Accomplishments
- Added a synthetic-only Phase 31 Playwright workflow that proves default-hidden `ping`, the contextual complete-set action under a local query, alphabetical rows with counts, no visible Close, desktop/narrow containment, Group: Session containment, all themes, and path privacy.
- Kept narrow facet and Group menus visibly painted outside the horizontally scrolling toolbar through native CSS anchors, while retaining an unsupported-browser absolute-position fallback with focused tests.
- Made facet and Group menu ownership mutually exclusive and made complete-set selection checks linear for high-cardinality facets.
- Revised only the stale Phase 25 visible footer contract while preserving its Search/Filter independence, row visibility, narrow containment, screenshots, and privacy assertions.
- Generated and inspected all five Phase 31 fixture-only screenshots.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prove picker behavior, responsive geometry, themes, and privacy with synthetic browser evidence** - `70ae5fd`

## Files Created/Modified
- `e2e/phase31.spec.ts` - Exercises the final visible contract and creates fixture-only evidence.
- `e2e/phase25.spec.ts` - Retains historical browser coverage with the contextual footer contract.
- `packages/ui/src/components/filters/popoverPosition.ts` - Provides native CSS anchor positioning with an unsupported-browser fallback.
- `packages/ui/src/components/filters/popoverPosition.test.ts` - Covers native-anchor and fallback positioning branches.
- `packages/ui/src/components/filters/FacetPopover.tsx` - Uses feature-detected positioning and linear complete-selection membership.
- `packages/ui/src/components/filters/FilterBar.tsx` - Owns mutually exclusive facet and Group picker state.
- `packages/ui/src/components/filters/GroupToggleChip.tsx` - Uses controlled open state and shared positioning behavior.
- `packages/ui/src/components/filters/FilterBar.test.tsx` - Covers direct facet/Group picker switching.
- `screenshots/phase31/*.png` - Captures Dark default state, Light, Hacker, narrow Method, and selected Group: Session evidence.

## Decisions Made
- Native CSS anchors satisfy narrow painted visibility without violating the approved no-JavaScript-measurement geometry contract.
- The fallback intentionally preserves the prior trigger-relative absolute behavior for runtimes without CSS anchor support.
- Phase 25 screenshots were regenerated because its retained E2E workflow remains part of the required compatibility proof.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Narrow menus had layout rectangles but were clipped from painted output**
- **Found during:** Visual review of Phase 31 screenshots.
- **Issue:** The narrow toolbar's horizontal overflow clipped absolutely positioned child menus even though bounding-box assertions passed.
- **Fix:** Added feature-detected native CSS anchor positioning, an unsupported-browser fallback, and `toBeInViewport()` browser assertions.
- **Files modified:** `popoverPosition.ts`, `popoverPosition.test.ts`, `FacetPopover.tsx`, `FilterBar.tsx`, `GroupToggleChip.tsx`, `FilterBar.test.tsx`, `e2e/phase31.spec.ts`.
- **Verification:** Final screenshots visibly include the narrow Method and Group surfaces; focused component/browser gates pass.
- **Committed in:** `70ae5fd`

**2. [Rule 1 - Bug] Facet and Group menus could remain open together**
- **Found during:** Independent code review.
- **Issue:** Facet and Group pickers used separate open-state owners and trigger mousedown propagation stops.
- **Fix:** Controlled Group open state from FilterBar's shared `openPopover` discriminator and added a direct-switch regression.
- **Files modified:** `FilterBar.tsx`, `GroupToggleChip.tsx`, `FilterBar.test.tsx`.
- **Verification:** Focused regression and browser gates pass.
- **Committed in:** `70ae5fd`

**3. [Rule 1 - Performance] Complete-set state used quadratic array membership**
- **Found during:** Independent code review.
- **Issue:** `options.every(selected.includes)` scaled quadratically for high-cardinality facets.
- **Fix:** Built a `Set` once and used linear membership checks.
- **Files modified:** `FacetPopover.tsx`.
- **Verification:** Existing query/cap/contextual action regressions pass.
- **Committed in:** `70ae5fd`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 performance issue)
**Impact on plan:** All fixes were necessary to make the planned browser evidence truthful and the picker contract robust; no network, dependency, persistence, server, host, protocol, Escape, or ARIA scope was added.

## Issues Encountered
- The literal root `pnpm lint` command is obstructed by an unrelated untracked nested Biome root and the tracked repository has 42 pre-existing formatting errors. The Phase 31 scoped Biome check passes with only two pre-existing FilterBar unused-code warnings.
- jsdom's expected `Window.scrollTo()` not-implemented warnings remain non-failing.

## User Setup Required

None - no external service configuration required.

## Verification
- `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx packages/ui/src/components/filters/popoverPosition.test.ts` - 60/60 passed.
- `pnpm --filter @ahp-inspector/ui typecheck` - passed.
- `pnpm --filter @ahp-inspector/ui build` - passed.
- `pnpm exec playwright test e2e/phase31.spec.ts e2e/phase25.spec.ts --project=chromium` - 3/3 passed.
- `pnpm test` - 107 files, 1,368 tests passed.
- `pnpm typecheck` - all packages passed.
- Scoped Phase 31 Biome check - passed with two pre-existing warnings.
- Final independent code review - no findings.
- Final goal verification - every Phase 31 functional, UI, evidence, and privacy criterion passed; only unrelated repository lint debt remains.

## Self-Check: PASSED

## Next Phase Readiness
- Phase 31 is functionally complete, reviewed, and verified.
- No Phase 31 blockers remain; repository-wide Biome formatting debt is explicitly unrelated.

---
*Phase: 31-improvements-to-the-filter-pickers-dir-kind-method-action-et*
*Completed: 2026-06-11*
