---
phase: 12-search-rather-than-filter
plan: 02
subsystem: ui
tags: [react, timeline, search, navigation, filters]
requires:
  - phase: 12-search-rather-than-filter
    provides: "volatile search metadata and visible search match selector"
provides:
  - "Search status, match count, and previous/next controls in the filter bar"
  - "Timeline row marking and keyboard/custom-event search navigation"
  - "Facet chips no longer represent or clear search queries"
affects: [timeline, filter-bar, active-filter-chips, keyboard-navigation]
tech-stack:
  added: []
  patterns: ["search as navigation", "search row marking", "filters-only active chips"]
key-files:
  created: []
  modified:
    - packages/ui/src/components/filters/FilterBar.tsx
    - packages/ui/src/components/filters/ActiveFilterChips.tsx
    - packages/ui/src/components/shell/AppShell.tsx
    - packages/ui/src/components/timeline/TimelineRegion.tsx
    - packages/ui/src/components/timeline/TimelineList.tsx
    - packages/ui/src/components/timeline/EventRow.tsx
    - packages/ui/src/components/filters/FilterBar.test.tsx
    - packages/ui/src/components/timeline/TimelineRegion.test.tsx
    - packages/ui/src/components/timeline/TimelineList.virt.test.tsx
    - packages/ui/src/components/timeline/EventRow.columns.test.tsx
key-decisions:
  - "Search appears as status/count/navigation controls, not as an active filter chip."
  - "Filter clear-all clears only facets; Escape still clears search before facets."
patterns-established:
  - "Dispatch ahp-search-nav custom events from controls and handle them in TimelineRegion."
  - "Use data-search-match for tested visual row state while preserving nonmatching context rows."
requirements-completed: [SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04]
duration: "not recorded"
completed: 2026-05-09
---

# Phase 12 Plan 02 Summary

**The timeline now treats search as match highlighting and navigation while filters remain the row-narrowing controls.**

## Accomplishments

- Added search status text, match counts, truncated indicator, and Prev/Next controls to the filter bar.
- Removed search query rendering from active filter chips and changed filter clear-all to preserve search.
- Marked matching rows with `data-search-match` and a distinct row treatment without removing nonmatching rows.
- Added F3, Shift+F3, and button-triggered navigation across visible search matches.
- Fixed navigation to read current selected state from the store so repeated navigation events advance correctly.

## Verification

- `pnpm --filter @ahp-viewer/ui test -- TimelineRegion.test.tsx FilterBar.test.tsx TimelineList.virt.test.tsx EventRow.columns.test.tsx AppShell.test.tsx`
- Included in focused suite: `pnpm --filter @ahp-viewer/ui test -- selectors.test.ts store.test.ts search-client.test.ts TimelineRegion.test.tsx FilterBar.test.tsx TimelineList.virt.test.tsx EventRow.columns.test.tsx AppShell.test.tsx persistence.test.ts persist-effect.test.ts`

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

A unit test caught stale selected-row state during repeated search navigation. `TimelineRegion` now reads `selectedIdx` from `useAppStore.getState()` inside the navigation callback before selecting the next match.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03 can persist only durable search input and verify browser behavior with the new search/navigation UI.

---
*Phase: 12-search-rather-than-filter*
*Completed: 2026-05-09*
