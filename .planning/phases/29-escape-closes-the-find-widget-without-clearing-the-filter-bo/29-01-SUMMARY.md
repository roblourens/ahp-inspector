---
phase: 29-escape-closes-the-find-widget-without-clearing-the-filter-bo
plan: 01
type: execute
status: COMPLETE
requirements: [UX-ESC-NO-CLEAR-FILTER, UX-ESC-CLOSE-FIND]
files_modified:
  - packages/ui/src/state/store.ts
  - packages/ui/src/state/store.test.ts
  - packages/ui/src/components/filters/FilterBar.tsx
  - packages/ui/src/components/filters/FilterBar.test.tsx
  - packages/ui/src/components/filters/RowFilterInput.tsx
  - packages/ui/src/components/filters/RowFilterInput.test.tsx
  - packages/ui/src/components/timeline/TimelineRegion.tsx
  - packages/ui/src/components/timeline/TimelineRegion.test.tsx
  - e2e/phase29.spec.ts
---

# Phase 29 · Plan 01 — Summary

## Objective

When the row filter box (`RowFilterInput`) has text and the user opens the find
widget (`SearchPopover`) with Cmd+F / Ctrl+F, pressing Escape must dismiss the
find widget only. Escape clears the row filter box only while focus is inside it;
when focus is outside the box, Escape must never clear any filter — neither the
row-text filter box nor the facet filters — so a returning user keeps their
filter state intact after dismissing find.

## Root Cause

Two document-level Escape listeners coexisted. `SearchPopover`'s own Escape
handler calls `onClose()` (correct). The global Escape handler in
`TimelineRegion` ran `searchQuery ? clearSearch : !isFiltersEmpty ? clearFilters() : clearSelection`.
With filter text present and the find widget open, `searchQuery` was empty, so
Escape fell into `clearFilters()` and wiped `filters.rowText` + facets while the
popover closed.

## Changes

- **packages/ui/src/state/store.ts** — added a shared `searchPopoverOpen: boolean`
  flag (default `false`) plus `setSearchPopoverOpen(open)` action, so the find
  widget's open state lives in the store instead of `FilterBar` local state. This
  lets the timeline Escape handler know when the find widget is open.
- **packages/ui/src/components/filters/FilterBar.tsx** — routed the popover
  open-state through the store (`searchPopoverOpen` / `setSearchPopoverOpen`)
  instead of `useState`. `openSearch`, the trigger close path, and
  `SearchPopover.onClose` now drive the store flag.
- **packages/ui/src/components/timeline/TimelineRegion.tsx** — rewrote the Escape
  branch: if the find widget is open, do nothing (the `SearchPopover` dismisses
  itself); else if there is a search query, clear the search; else clear the
  selection. Removed the `clearFilters()` branch entirely so Escape can never
  clear a filter. Dropped the now-unused `isFiltersEmpty` import, `filters` and
  `clearFilters` store selectors, and their effect deps.
- **Tests** — added a store test for `setSearchPopoverOpen`; reset
  `searchPopoverOpen` in both `store.test.ts`, `FilterBar.test.tsx`, and the new
  timeline tests' `beforeEach` (the open-state is now global); added 4
  `TimelineRegion` tests proving Escape preserves the row filter box, preserves a
  facet filter, no-ops when the find widget is open, and still clears search when
  the widget is closed.
- **e2e/phase29.spec.ts** (new) — Playwright coverage: typing into "Filter rows",
  opening find with Cmd+F, then Escape dismisses the popover while the filter text
  survives; Escape with focus inside the box clears it; plus a facet-filter case
  proving Escape never clears an active Method facet from outside the box.

## Amendment — focus-aware Escape

After the initial merge, the behavior was refined: Escape should clear the row
filter box **only when focus is inside it**, and never when focus is outside.
`RowFilterInput` now has a local `onKeyDown` that, on Escape, clears the box (when
non-empty) and calls `stopPropagation()` so the global timeline Escape handler —
which still never clears a filter — does not also act. Added `RowFilterInput.test.tsx`
(3 tests) and an e2e case for the focus-inside path.

## Verification

- `pnpm -F @ahp-inspector/ui exec vitest run` — 58 files, 448 tests pass.
- `pnpm -F @ahp-inspector/ui exec tsc --noEmit` — no type errors.
- `pnpm exec playwright test e2e/phase29.spec.ts` — 2 tests pass.
- Visual: `screenshots/phase29/01-filter-survives-escape.png` (fixture data only)
  shows the "Filter rows" box still populated after Escape dismissed the find
  widget.

## Must-Haves

- ✅ Escape dismisses the find widget when it is open.
- ✅ Escape clears the row filter box when focus is inside it.
- ✅ Escape never clears the row filter box when focus is outside it.
- ✅ Escape never clears facet filters.
- ✅ Escape still clears search query / selection when the find widget is closed.
- ✅ Clearing a filter from outside the box requires an explicit action (the "Clear all filters" button).
