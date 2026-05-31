---
phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
plan: 03
subsystem: ui-filters
tags: [react, accessibility, toolbar, facets]
requires:
  - phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
    provides: "Hidden-value state and persisted rowText from Plans 25-01 and 25-02"
provides:
  - "Distinct Filter rows toolbar input with independent clear action"
  - "Checked-visible categorical popovers with Select all and Uncheck all actions"
  - "Truthful active chips for row-text and hidden-value constraints"
affects: [filters, timeline-toolbar, visual-evidence]
tech-stack:
  added: []
  patterns: ["checked-visible facet adapter", "separate search and visibility controls"]
key-files:
  created:
    - packages/ui/src/components/filters/RowFilterInput.tsx
  modified:
    - packages/ui/src/components/filters/FilterBar.tsx
    - packages/ui/src/components/filters/FacetPopover.tsx
    - packages/ui/src/components/filters/ActiveFilterChips.tsx
    - packages/ui/src/components/filters/FilterBar.test.tsx
key-decisions:
  - "Filter rows is a sibling control to Search and writes only FilterState.rowText."
  - "Facet popovers accept visible checkbox selections while FilterBar translates them to stored hidden values for every categorical facet."
  - "Turn remains operable while Channel has no hidden values because empty exclusions means all channels are visible."
patterns-established:
  - "Active chips describe exclusions as Hidden {label}: {value} and row predicates as Rows contain: {value}."
requirements-completed: [FILTER-25-01, FILTER-25-02, FILTER-25-04]
duration: 5 min
completed: 2026-05-29
---

# Phase 25 Plan 03: Filter Controls Summary

**The workbench now presents Search and Filter rows as separate controls, and categorical checkboxes consistently mean visible rows.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-29T21:54:00Z
- **Completed:** 2026-05-29T21:59:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added a compact token-styled `Filter rows` input with literal copy and a clear button that never clears Search.
- Generalized the checked-visible translation from Method to Direction, Kind, Action, Channel, Turn and Status; added exact `Select all` and `Uncheck all` menu actions.
- Updated active feedback so hidden values and row text are stated truthfully, including `Hidden Channel:` and `Rows contain:` chips.

## Task Commits

Tasks were committed in RED/GREEN pairs:

1. **Task 1 RED: Define independent row filter control** - `da7ffa7` (test)
2. **Task 1 GREEN: Add independent row filter input** - `bd0ad88` (feat)
3. **Task 2 RED: Define checked-visible facet menus** - `0229bbd` (test)
4. **Task 2 GREEN: Make facet menus checked-visible** - `59739e1` (feat)
5. **Task 3 RED: Define truthful active filter chips** - `5092d71` (test)
6. **Task 3 GREEN: Show truthful active filter chips** - `a9af0a9` (feat)

## Files Created/Modified

- `packages/ui/src/components/filters/RowFilterInput.tsx` - Provides the new compact local row-filter input and clear affordance.
- `packages/ui/src/components/filters/FilterBar.tsx` - Hosts independent controls and translates visible selections into hidden-value state.
- `packages/ui/src/components/filters/FacetPopover.tsx` - Exposes explicit full-facet visibility actions.
- `packages/ui/src/components/filters/ActiveFilterChips.tsx` - Presents row text and hidden values as active constraints.
- `packages/ui/src/components/filters/FilterBar.test.tsx` - Covers copy, independence, checkbox truth, bulk actions and chip feedback.

## Decisions Made

- Keep Search as the flexible primary input and render Filter rows at a stable compact width so users can distinguish raw navigation from visible-row reduction.
- Carry hidden values that are not currently present in a facet option list when changing known checkbox selections; later discovered hidden values must remain hidden.
- Use native checkboxes and token-only existing styles so all supported themes retain their established treatment.

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

- `FilterBar.tsx`, `FilterBar.test.tsx` and `ActiveFilterChips.tsx` already held compatible pending Channel/Search-feedback edits when execution began. Those edits were preserved in place while the Phase 25 changes extended the same toolbar behavior; unrelated pending timeline files remain untouched.
- Existing FilterBar test output prints jsdom's `Window.scrollTo()` not-implemented notice from unrelated rendered state behavior, but all assertions pass.

## Verification

- `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx packages/ui/src/state/selectors.test.ts packages/ui/src/components/timeline/TimelineRegion.test.tsx` - passed (76 tests).
- `pnpm --filter @ahp-inspector/ui typecheck` - passed.
- Acceptance inspection confirmed exact UI-SPEC copy for `Filter rows`, `Clear row filter`, `Select all`, `Uncheck all`, `Rows contain:` and `Hidden {label}:`.

## User Setup Required

None - controls are available in the existing local workbench.

## Next Phase Readiness

- Plan 25-04 can now drive the fixture-backed toolbar workflow and collect desktop/narrow evidence.
- Pre-existing pending timeline-list changes and planning config remain outside this plan's committed files and must not be discarded.

## Self-Check: PASSED

- All required UI implementation and component-test changes are committed.
- Focused interaction tests and UI typecheck pass.
- UI-SPEC copy and Search/filter independence contracts are present.

---
*Phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl*
*Completed: 2026-05-29*