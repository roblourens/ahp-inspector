---
phase: 03-detail-search-and-filtering
plan: "03"
subsystem: ui-filters
tags: [react, zustand, filter-bar, facet-chips, no-results-states, accessibility]
dependency_graph:
  requires: ["03-02"]
  provides: ["FilterBar component", "ActiveFilterChips component", "FacetPopover", "GroupToggleChip", "NoResultsState", "SearchingIndicator", "SearchTruncatedBanner"]
  affects: ["03-05"]
tech_stack:
  added: []
  patterns:
    - "FacetPopover closes on mousedown outside via document event listener"
    - "100-option cap with '…and N more' footer in FacetPopover (T-03-03-02 DoS mitigation)"
    - "input[type=radio]+label pattern in GroupToggleChip (biome semantic elements rule)"
    - "All styling via CSS variables only — no raw hex literals"
key_files:
  created:
    - packages/ui/src/components/filters/SearchInput.tsx
    - packages/ui/src/components/filters/FacetChip.tsx
    - packages/ui/src/components/filters/FacetPopover.tsx
    - packages/ui/src/components/filters/TimeRangePopover.tsx
    - packages/ui/src/components/filters/GroupToggleChip.tsx
    - packages/ui/src/components/filters/ResultCounter.tsx
    - packages/ui/src/components/filters/FilterBar.tsx
    - packages/ui/src/components/filters/ActiveChip.tsx
    - packages/ui/src/components/filters/ActiveFilterChips.tsx
    - packages/ui/src/components/filters/index.ts
    - packages/ui/src/components/states/NoResultsState.tsx
    - packages/ui/src/components/states/SearchingIndicator.tsx
    - packages/ui/src/components/states/SearchTruncatedBanner.tsx
    - packages/ui/src/components/filters/FilterBar.test.tsx
  modified: []
decisions:
  - "Moved Task 2 component implementations into Task 1 to satisfy barrel export compilation requirement — ActiveFilterChips/ActiveChip needed to exist for index.ts to type-check; TDD RED/GREEN collapsed into one commit cycle"
  - "Replaced button[role=radio] with input[type=radio]+label in GroupToggleChip — biome useSemanticElements rule; same a11y semantics, no behavior change"
  - "Removed autoFocus from FacetPopover search input — biome noAutofocus rule; keyboard users still reach it via Tab"
  - "100-option cap with '…and N more' footer implements T-03-03-02 DoS mitigation"
metrics:
  duration: "15min"
  completed: "2026-05-07"
  tasks: 2
  files: 14
---

# Phase 03 Plan 03: Filter Bar UI Components Summary

**One-liner:** FilterBar chrome (SearchInput + 8 FacetChips + GroupToggleChip + ResultCounter), ActiveFilterChips row, NoResultsState 4-variant, SearchingIndicator, SearchTruncatedBanner — 14 files, 22 tests, 0 hex literals.

## What Was Built

### Task 1: FilterBar + Facet chips + Group toggle + Result counter

**`SearchInput.tsx`** — controlled `<input type="text">` with:
- `placeholder="Search method, id, session, payload…"`
- lucide `Search` icon (16px) as left adornment
- lucide `X` icon (14px) as clear button when value non-empty
- Dispatches `setSearchQuery` on change; full-width, min 280px, max 480px

**`FacetChip.tsx`** — button chip with active-count badge and chevron:
- Background switches from `--color-chip-bg` → `--color-chip-bg-active` when popover is open
- Disabled state uses `--color-text-disabled`

**`FacetPopover.tsx`** — checkbox list `role="listbox"`:
- Closes on mousedown outside via document event listener
- Optional `searchable` prop renders an inner filter input
- Capped at 100 visible options with "…and N more" footer (T-03-03-02 mitigation)
- `z-index: 200`

**`TimeRangePopover.tsx`** — two `datetime-local` inputs:
- "From" / "To" labels; "Apply range" applies and closes; "Clear selection" resets

**`GroupToggleChip.tsx`** — styled chip opening a radio-button popover:
- `<input type="radio">` + `<label>` pattern (semantic HTML)
- Calls `window.scrollTo(0, 0)` when switching away from "none"

**`ResultCounter.tsx`** — tabular-nums display:
- Unfiltered: `"{total} events"` in `--color-text-muted`
- Filtered: `"{visible}/{total} events"` in `--color-text-muted`
- Zero results: `"0/{total}"` in `--color-warning`

**`FilterBar.tsx`** — 40px chrome row wiring all 8 facets:
- Direction, Kind, Method (searchable), Action, Session (searchable), Turn (searchable, disabled when no session), Status, Time
- GroupToggleChip right-aligned via `marginLeft: auto`
- ResultCounter last

**`ActiveChip.tsx`** — dismissable chip with X button:
- Dismiss button hover: `--color-chip-dismiss` → `--color-destructive`

**`ActiveFilterChips.tsx`** — active-chips row reading store:
- Hidden when `isFiltersEmpty(filters) && searchQuery === ""`
- Search chip first (Search icon + label truncated at 40 chars)
- One chip per active facet value with aria dismiss label
- "Clear all" right-aligned, aria-label `"Clear all filters and search"`

### Task 2 (TDD): State components + Tests

**`NoResultsState.tsx`** — 4-variant empty state:
- `filters`: "No events match your filters" / "Try removing a filter…" / "Clear all filters"
- `search`: "No events match your search" / case-insensitive substring copy / "Clear search"
- `combined`: "No events match your search and filters" / "Try removing…" / "Clear all"
- `search-error`: "Search failed" / `errorMessage` / "Retry search" → `onRetry`

**`SearchingIndicator.tsx`** — `Loader2` spinner + "Searching {N} events…"

**`SearchTruncatedBanner.tsx`** — "Showing first {shown} of {total}+ matches…" in `--color-warning`

**`FilterBar.test.tsx`** — 22 jsdom tests covering all behavior items.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm -F @ahp-inspector/ui test src/components/filters/ src/components/states/NoResultsState` | ✅ 22/22 tests passed |
| `pnpm -F @ahp-inspector/ui build` | ✅ 226 KB bundle, no errors |
| Hex-literal grep in filters/ | ✅ 0 results |
| Hex-literal grep in state components | ✅ 0 results |
| `pnpm typecheck` | ✅ All packages clean |
| `pnpm lint` | ✅ Clean after auto-fixes |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2 components implemented before tests**
- **Found during:** Task 1 — barrel `index.ts` needed `ActiveFilterChips` export to compile
- **Issue:** The plan's barrel spec includes `ActiveFilterChips` which is a Task 2 component; without the file, TypeScript would fail the Task 1 build gate
- **Fix:** Created full implementations of `ActiveFilterChips`, `ActiveChip`, `NoResultsState`, `SearchingIndicator`, `SearchTruncatedBanner` in Task 1; Task 2 proceeded as test-writing phase (all 22 tests passed immediately)
- **Files modified:** All Task 2 component files created in Task 1

**2. [Rule 1 - Bug] biome `useSemanticElements` — `button[role=radio]` in GroupToggleChip**
- **Found during:** Task 1 lint pass
- **Issue:** Plan prescribed `<button role="radio">` pattern; biome rejects this, requiring semantic `<input type="radio">` elements
- **Fix:** Replaced with `<label><input type="radio" />{label}</label>` pattern; same a11y semantics
- **Files modified:** `packages/ui/src/components/filters/GroupToggleChip.tsx`

**3. [Rule 1 - Bug] biome `noAutofocus` — autoFocus on FacetPopover search input**
- **Found during:** Task 1 lint pass
- **Issue:** `autoFocus` on the filter-within-list input violates biome's noAutofocus rule
- **Fix:** Removed `autoFocus`; keyboard users reach the input via Tab, no behavior regression
- **Files modified:** `packages/ui/src/components/filters/FacetPopover.tsx`

**4. [Rule 1 - Bug] biome `noUnusedVariables`, `useTemplate`, `organizeImports` across all files**
- **Found during:** Task 1/2 lint pass
- **Issue:** Unused `FACET_LABELS` constant, string concatenation where template literals required, import ordering inconsistencies
- **Fix:** Removed unused constant, substituted template literals, ran `pnpm lint --write`
- **Files modified:** `ActiveFilterChips.tsx`, `FilterBar.test.tsx`, + 11 files with import ordering

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-03-03-01 (XSS in FacetPopover) | Option values are EventRow field values rendered as React text children — auto-escaped | ✅ Accepted |
| T-03-03-02 (DoS: 10k sessions in FacetPopover) | 100-option cap with "…and N more" footer + searchable inner input | ✅ Mitigated |
| T-03-03-03 (Accessibility) | FacetChip `<button>` + FacetPopover `<input type="checkbox">` + GroupToggleChip `<input type="radio">` + label | ✅ Mitigated |

## Commits

| Hash | Message |
|------|---------|
| `e6e65e0` | feat(03-03): FilterBar + FacetChips + GroupToggle + ResultCounter + filter components |
| `ee5d34a` | test(03-03): FilterBar.test.tsx - ActiveFilterChips, NoResultsState, SearchingIndicator, SearchTruncatedBanner |
| `803a0cd` | fix(03-03): biome lint/format fixes - import order, template literals, semantic elements |

## Self-Check: PASSED
