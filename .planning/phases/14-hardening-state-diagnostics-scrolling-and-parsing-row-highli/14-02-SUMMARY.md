# Phase 14 Plan 02 Summary

**Plan:** Row highlighting precedence cleanup (HARDEN-02)

## Changes

- `packages/ui/src/components/timeline/EventRow.tsx`:
  - Removed the conflicting `outline` rule for search-match rows.
  - Search-match indication now shows on the rail cell (full-saturation `--color-search-match-bg`) when the row is not selected.
  - Background precedence: selected > pair-highlight > search-match > none.
- `packages/ui/src/components/timeline/EventRow.columns.test.tsx`: added a precedence test that asserts a row marked `selected + search-match + pair-highlight` shows only the selected background and no outline.

## Verification

`EventRow.columns.test.tsx` (8 tests, including new precedence test) and `EventRow.orphan.test.tsx` pass; full suite green.
