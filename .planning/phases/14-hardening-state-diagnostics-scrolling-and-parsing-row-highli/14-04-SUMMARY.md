# Phase 14 Plan 04 Summary

**Plan:** Search ergonomics — Enter/Shift+Enter + scroll-to-current-match (HARDEN-04)

## Changes

- `packages/ui/src/components/filters/SearchInput.tsx`: added `onKeyDown` that dispatches the existing `ahp-search-nav` CustomEvent on Enter (next) / Shift+Enter (previous) when the query is non-empty.
- `packages/ui/src/components/timeline/TimelineList.tsx`: added a `useEffect` that finds the virtual index of `selectedIdx` and calls `v.scrollToIndex(targetVi, { align: "center" })`, disabling tail-follow.
- `packages/ui/src/components/filters/FilterBar.test.tsx`: two new cases — Enter/Shift+Enter dispatches `ahp-search-nav` with the right direction, and Enter with empty query is a no-op.

## Verification

`FilterBar.test.tsx` 30/30, `TimelineList.virt.test.tsx` 4/4, `TimelineRegion.test.tsx` 12/12 pass; full suite green.

## Notes

Reuses the existing `window.addEventListener("ahp-search-nav", ...)` listener already wired in `TimelineRegion`. No state or prop additions.
