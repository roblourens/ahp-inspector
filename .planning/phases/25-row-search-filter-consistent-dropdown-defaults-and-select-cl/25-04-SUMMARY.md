---
phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
plan: 04
subsystem: e2e-docs
tags: [playwright, screenshots, fixtures, documentation, responsive]
requires:
  - phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
    provides: "Persisted state and complete filter control surface from Plans 25-02 and 25-03"
provides:
  - "Fixture-only browser proof for Search versus Filter rows and checked-visible menu actions"
  - "Desktop and narrow safe screenshot evidence for Phase 25 review"
  - "User guidance for projected-row filtering, visible facets and default-hidden ping"
  - "Inward-aligned right-side visibility menus at narrow viewport widths"
affects: [e2e, docs, facets, visual-review]
tech-stack:
  added: []
  patterns: ["temporary synthetic fixture browser tests", "viewport-bounded popover alignment"]
key-files:
  created:
    - e2e/phase25.spec.ts
    - screenshots/phase25/01-row-filter-and-facets.png
    - screenshots/phase25/02-row-filter-and-facets-narrow.png
  modified:
    - packages/ui/src/components/filters/FacetPopover.tsx
    - packages/ui/src/components/filters/FilterBar.tsx
    - USER_GUIDE.md
    - README.md
key-decisions:
  - "Visual evidence is generated only from PHASE5_BASE_JSONL plus an in-test synthetic ping event, never from a real session log."
  - "Method and later categorical popovers open inward so right-edge narrow rendering preserves readable actions."
patterns-established:
  - "Screenshot-producing tests assert viewport containment before saving narrow evidence."
requirements-completed: [FILTER-25-01, FILTER-25-02, FILTER-25-03, FILTER-25-04]
duration: 8 min
completed: 2026-05-29
---

# Phase 25 Plan 04: Browser Evidence and Documentation Summary

**A fixture-backed browser workflow proves independent text controls and truthful facet menus, with readable desktop and narrow evidence ready for review.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-29T21:59:00Z
- **Completed:** 2026-05-29T22:07:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added a Playwright workflow that builds a temporary safe JSONL file from `PHASE5_BASE_JSONL` plus one synthetic `ping` row, then proves Search highlighting preserves context while Filter rows hides nonmatches.
- Verified default-checked visible Method options, default-unchecked `ping`, and row-affecting `Uncheck all` / `Select all` commands; captured approved-path desktop and narrow fixture screenshots.
- Documented projected-row filtering, visible-value checkbox meaning, persisted hidden values and default-hidden `ping` in the guide and public capability summary.

## Task Commits

Tasks and necessary verification fix were committed atomically:

1. **Verification fix: Keep visibility menus in narrow viewport** - `8b4c5a8` (fix)
2. **Task 1: Capture fixture-backed row filter workflow** - `8c56851` (test)
3. **Task 2: Explain row filtering and visible facets** - `58f19d9` (docs)

## Files Created/Modified

- `e2e/phase25.spec.ts` - Drives the synthetic browser workflow and saves safe desktop/narrow evidence.
- `screenshots/phase25/01-row-filter-and-facets.png` - Desktop fixture evidence with both controls and Method menu.
- `screenshots/phase25/02-row-filter-and-facets-narrow.png` - Narrow fixture evidence with viewport-contained menu commands.
- `packages/ui/src/components/filters/FacetPopover.tsx` - Supports inward alignment for edge-adjacent menus.
- `packages/ui/src/components/filters/FilterBar.tsx` - Applies inward alignment to right-side categorical popovers.
- `USER_GUIDE.md` - Documents user workflow and checked-visible semantics.
- `README.md` - Distinguishes highlighting Search from projected-row narrowing.

## Decisions Made

- Construct screenshot data in-test from the repository-owned synthetic fixture string and a synthetic `ping` line so the default-hidden behavior is both safe and visible.
- Treat menu clipping found during screenshot review as a product defect: the narrow evidence is accepted only after the open menu remains wholly within the viewport.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented right-side visibility menus from clipping in narrow layouts**
- **Found during:** Task 1 fixture screenshot review at `980px` viewport width.
- **Issue:** Method opened to the right and clipped option text and the `Close` action beyond the narrow viewport edge.
- **Fix:** Added explicit popover alignment support and opened Method, Action, Channel, Turn and Status inward; the E2E now asserts the open menu's bounding box remains in the viewport.
- **Files modified:** `packages/ui/src/components/filters/FacetPopover.tsx`, `packages/ui/src/components/filters/FilterBar.tsx`, `e2e/phase25.spec.ts`.
- **Verification:** Component tests, UI typecheck, built Playwright run and manual screenshot inspection passed.
- **Committed in:** `8b4c5a8`, with its browser assertion in `8c56851`.

---

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** Necessary responsive correction discovered by the planned fixture evidence; no scope expansion beyond filter-surface usability.

## Issues Encountered

- An initial E2E locator matched both the Method facet trigger and the truthful `Show Method: ping` active chip; it was narrowed to the trigger label before the artifacts were committed.
- The full jsdom suite emits existing canvas/scroll not-implemented notices; all assertions complete successfully.

## Verification

- `pnpm --filter @ahp-inspector/ui build && pnpm exec playwright test e2e/phase25.spec.ts --project=chromium` - passed (2 tests), regenerating fixture-only screenshots.
- `pnpm test` - passed (101 test files, 1272 tests).
- `pnpm --filter @ahp-inspector/ui typecheck` - passed.
- Both committed screenshots were visually inspected after regeneration; the narrow menu is fully readable and contained.

## User Setup Required

None - browser evidence and documentation are repository artifacts.

## Next Phase Readiness

- Plan 25-05 can present the two fixture-only screenshots for explicit human approval.
- Pending unrelated timeline-list/config worktree changes remain untouched and outside this plan's commits.

## Self-Check: PASSED

- Fixture-only E2E and both required evidence files are committed.
- User documentation contains the exact Phase 25 concepts and commands.
- Automated and visual checks completed successfully after the responsive fix.

---
*Phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl*
*Completed: 2026-05-29*