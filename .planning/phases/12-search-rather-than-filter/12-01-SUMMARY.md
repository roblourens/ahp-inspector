---
phase: 12-search-rather-than-filter
plan: 01
subsystem: ui-state
tags: [react, zustand, search, filters, selectors]
requires:
  - phase: 04-live-tail-discovery-persistence
    provides: "per-log state, row selectors, and persistence patterns"
provides:
  - "Search result metadata stored separately from faceted row filtering"
  - "Facet-only visible row selector with visible search match projection"
affects: [search, filters, timeline, persistence]
tech-stack:
  added: []
  patterns: ["volatile search metadata", "facet-only row filtering", "visible-match intersection"]
key-files:
  created: []
  modified:
    - packages/ui/src/state/store.ts
    - packages/ui/src/state/selectors.ts
    - packages/ui/src/components/filters/useSearch.ts
    - packages/ui/src/state/store.test.ts
    - packages/ui/src/state/selectors.test.ts
    - packages/ui/src/transport/search-client.test.ts
key-decisions:
  - "Search results are volatile metadata and do not participate in visible row filtering."
  - "Search match indexes are intersected with rows that pass the active faceted filters."
patterns-established:
  - "Use clearSearchResults for volatile search metadata while preserving searchQuery."
  - "Use useVisibleSearchMatches for navigation/highlighting against currently visible rows."
requirements-completed: [SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04]
duration: "not recorded"
completed: 2026-05-09
---

# Phase 12 Plan 01 Summary

**Search state now supports find/highlight behavior without narrowing the timeline.**

## Accomplishments

- Added `searchTotal`, `searchTruncated`, `searchStatus`, and `searchError` to store server search result metadata separately from faceted filters.
- Changed `useFilteredRows` so only faceted filters narrow visible rows.
- Added `useVisibleSearchMatches` to validate search result indexes against the current visible row set.
- Updated the debounced search hook to set pending/ready/error result metadata and clear volatile results for empty queries.

## Verification

- `pnpm --filter @ahp-viewer/ui test -- selectors.test.ts store.test.ts search-client.test.ts`
- Included in focused suite: `pnpm --filter @ahp-viewer/ui test -- selectors.test.ts store.test.ts search-client.test.ts TimelineRegion.test.tsx FilterBar.test.tsx TimelineList.virt.test.tsx EventRow.columns.test.tsx AppShell.test.tsx persistence.test.ts persist-effect.test.ts`

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02 can consume visible search matches for row highlighting and navigation without changing server search contracts.

---
*Phase: 12-search-rather-than-filter*
*Completed: 2026-05-09*
