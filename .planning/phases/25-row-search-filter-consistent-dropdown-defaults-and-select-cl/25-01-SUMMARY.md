---
phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
plan: 01
subsystem: ui-state
tags: [react, zustand, filters, vitest]
requires:
  - phase: 12-search-rather-than-filter
    provides: "Search result metadata stays separate from visible-row filtering"
provides:
  - "Literal projected-row text filtering through FilterState.rowText"
  - "Uniform hidden-value semantics for all categorical facet arrays"
  - "Selector and timeline regressions preserving independent Search navigation"
affects: [filters, timeline, persistence, search]
tech-stack:
  added: []
  patterns: ["bounded literal projection filtering", "categorical hidden-value exclusions"]
key-files:
  created: []
  modified:
    - packages/ui/src/state/filters.ts
    - packages/ui/src/state/selectors.test.ts
    - packages/ui/src/components/timeline/TimelineRegion.test.tsx
key-decisions:
  - "FilterState categorical arrays uniformly contain hidden values; an empty array leaves that facet visible."
  - "Filter rows uses a 256-character lowercase literal substring predicate over published EventRow projection fields only."
  - "Raw Search match metadata remains independent from visibility and is only intersected for navigation over visible matches."
patterns-established:
  - "Use applyFacets for local row visibility without consuming bounded server Search results."
  - "Protect Search-versus-filter separation with selector and rendered-timeline regressions."
requirements-completed: [FILTER-25-01, FILTER-25-02]
duration: 32 min
completed: 2026-05-29
---

# Phase 25 Plan 01: Row Filter State Contract Summary

**Bounded projected-row text filtering and uniform hidden-value facets while Search stays highlight/navigation metadata.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-05-29T21:16:00Z
- **Completed:** 2026-05-29T21:48:41Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `rowText` to the portable filter state and applied literal case-insensitive matching only to published timeline row projection fields.
- Converted Direction, Kind, Action, Channel, Turn and Status filtering to the same hidden-value invariant already used for Method, preserving default-hidden `ping`.
- Added selector and rendered timeline tests proving `Filter rows` narrows rows while existing Search matches continue to navigate only surviving visible matches.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Define hidden facet and row-text filter behavior** - `9166f1a` (test)
2. **Task 1 GREEN: Implement hidden facets and bounded row filter predicate** - `34b069e` (feat)
3. **Task 2: Protect independent row filtering and search navigation** - `b7fcb04` (test)

## Files Created/Modified

- `packages/ui/src/state/filters.ts` - Defines `rowText`, uniform categorical exclusion semantics and the bounded literal projection predicate.
- `packages/ui/src/state/selectors.test.ts` - Proves hidden facet behavior, row-text matching, cap behavior and visible Search match intersection.
- `packages/ui/src/components/timeline/TimelineRegion.test.tsx` - Proves rendered row filtering remains separate from a live Search query.

## Decisions Made

- Use one checked-visible storage contract for all categorical facets: stored values are hidden values, with `method: ["ping"]` remaining the application default.
- Limit Filter rows to a trimmed, lowercase, 256-character `String.prototype.includes` predicate over display projection values; it never interprets regex/HTML or fetches raw event content.
- Preserve Phase 12 behavior by leaving Search metadata outside visible-row filtering and testing only its intersection for navigation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first combined Vitest verification run stalled during test import/startup and reported an approximately ten-minute selector-file duration. Targeted isolation showed the new regression itself completed in 8ms, and rerunning the exact focused suite completed in about one second with all 37 tests passing; no product or test-code defect remained.

## Verification

- `pnpm exec vitest run packages/ui/src/state/selectors.test.ts packages/ui/src/components/timeline/TimelineRegion.test.tsx` - passed (37 tests).
- `pnpm --filter @ahp-inspector/ui typecheck` - passed.
- Acceptance checks confirmed `rowText: string`, application-default `method: ["ping"]`, no regex predicate, non-filtering `searchMatches`, and row-text/rendered-row coverage.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 25-02 can safely version persisted filters against the new hidden-value contract.
- Plan 25-03 can translate checked menu state to hidden arrays and mount the independent Filter rows input.

## Self-Check: PASSED

- Required source changes and regression tests are committed.
- Plan verification and acceptance criteria pass.
- Pending Phase 24 filter-bar and timeline-list edits were not touched by this plan.

---
*Phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl*
*Completed: 2026-05-29*