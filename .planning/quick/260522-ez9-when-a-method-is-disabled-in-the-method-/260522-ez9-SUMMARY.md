---
quick_id: 260522-ez9
status: complete
date: 2026-05-22
commit: 478a9ba
---

# Quick Task 260522-ez9 Summary

## Completed

- Made Method facet filtering pair-aware in `useFilteredRows()` and `useVisibleSearchMatches()`.
- Preserved `applyFacets()` as the row-local predicate while adding selector-level handling for response rows whose request method is available through `pairIdx`.
- Added coverage for default `ping` hiding, additional unchecked methods, unpaired null-method responses, and search match visibility.

## Verification

- `pnpm -F @ahp-inspector/ui test -- selectors.test.ts` passed.
- `pnpm -F @ahp-inspector/ui typecheck` passed.

## Code Commit

- `478a9ba` — `fix(260522-ez9): hide responses for excluded methods`