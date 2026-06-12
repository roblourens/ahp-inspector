---
phase: 31-improvements-to-the-filter-pickers-dir-kind-method-action-et
plan: 01
subsystem: ui
tags: [react, filters, facets, popovers, vitest]
requires:
  - phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
    provides: checked-visible facet semantics and complete-option bulk actions
provides:
  - one contextual complete-facet action per categorical picker
  - deterministic visible-label ordering across all categorical facets
  - contained searchable inputs and Group rows through local border-box sizing
affects: [filter-bar, facet-popover, grouping-picker, phase31-browser-proof]
tech-stack:
  added: []
  patterns: [derive bulk state from complete options, sort at display projection boundary, local border-box geometry fixes]
key-files:
  created: []
  modified:
    - packages/ui/src/components/filters/FacetPopover.tsx
    - packages/ui/src/components/filters/FilterBar.tsx
    - packages/ui/src/components/filters/GroupToggleChip.tsx
    - packages/ui/src/components/filters/FilterBar.test.tsx
key-decisions:
  - "Contextual bulk state and action derive from complete options, never the filtered or rendered subset."
  - "All categorical facets sort after visible-label formatting, with raw value as the only tie-breaker."
patterns-established:
  - "Facet option ordering belongs at FilterBar.mapToOptions, not in selectors or individual popovers."
  - "Full-width padded picker controls use local border-box sizing without a global reset."
requirements-completed: []
duration: 8min
completed: 2026-06-11
---

# Phase 31 Plan 01: Predictable And Contained Filter Pickers Summary

**Categorical pickers now use one truthful complete-set action, stable visible-label ordering, and locally contained full-width controls.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-12T00:21:00Z
- **Completed:** 2026-06-12T00:29:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced simultaneous Select all, Uncheck all, and Close footer actions with one contextual complete-set action that stays correct under query filtering and the 100-row cap.
- Sorted Dir, Kind, Method, Action, Channel, Turn, and Status by case-insensitive visible label with deterministic raw-value tie-breaking.
- Fixed searchable input and selected Group row overflow with focused local border-box sizing.
- Added component regressions for complete-set behavior, closure, all-facet ordering, count stability, and geometry styles.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make bulk behavior contextual and categorical ordering deterministic** - `ff2fa0b`
2. **Task 2: Contain the searchable input and selected Group row locally** - `07a6859`

## Files Created/Modified
- `packages/ui/src/components/filters/FacetPopover.tsx` - Renders one complete-options contextual action, no visible Close, and a contained searchable input.
- `packages/ui/src/components/filters/FilterBar.tsx` - Sorts shared categorical options after visible-label formatting.
- `packages/ui/src/components/filters/GroupToggleChip.tsx` - Contains each full-width Group row and selected background.
- `packages/ui/src/components/filters/FilterBar.test.tsx` - Locks contextual behavior, ordering, closure, cap/query behavior, and local geometry contracts.

## Decisions Made
- Followed the approved UI-SPEC: no Escape, role/ARIA, state, persistence, server, host, protocol, dependency, global CSS, or token changes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The expected jsdom `Window.scrollTo()` not-implemented warning remains non-failing and pre-existing.

## User Setup Required

None - no external service configuration required.

## Verification
- `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` - 57/57 passed.
- `pnpm --filter @ahp-inspector/ui typecheck` - passed.
- `pnpm --filter @ahp-inspector/ui build` - passed.
- `git diff --exit-code -- packages/ui/src/styles/global.css packages/ui/src/styles/tokens.css` - no changes.

## Self-Check: PASSED

## Next Phase Readiness
- Shared picker behavior and geometry are ready for fixture-backed desktop, narrow, and all-theme browser proof in Plan 31-02.

---
*Phase: 31-improvements-to-the-filter-pickers-dir-kind-method-action-et*
*Completed: 2026-06-11*
