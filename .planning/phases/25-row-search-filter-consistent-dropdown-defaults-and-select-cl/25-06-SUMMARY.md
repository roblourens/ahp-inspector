---
phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
plan: 06
subsystem: ui
tags: [search, popover, filter-toolbar, responsive-layout]
requires:
  - phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
    provides: "Phase 25 filter behavior and the visual-review gap from Plan 25-05"
provides:
  - "Compact Search trigger with SearchPopover-hosted search controls"
  - "Filter rows as the primary flexible toolbar input"
  - "Responsive fixture-only browser evidence for the revised toolbar"
affects: [filter-toolbar, search-navigation, browser-evidence]
key-files:
  created:
    - packages/ui/src/components/filters/SearchInputCore.tsx
    - packages/ui/src/components/filters/SearchPopover.tsx
    - packages/ui/src/components/filters/SearchPopover.test.tsx
    - packages/ui/src/components/filters/SearchTrigger.tsx
    - packages/ui/src/components/filters/SearchTrigger.test.tsx
  modified:
    - packages/ui/src/components/filters/FilterBar.tsx
    - packages/ui/src/components/filters/FilterBar.test.tsx
    - packages/ui/src/components/filters/RowFilterInput.tsx
    - packages/ui/src/components/filters/SearchInput.tsx
    - e2e/phase25.spec.ts
key-decisions:
  - "Keep row filtering as the always-visible primary toolbar input and place timeline search behind a compact trigger and popover."
  - "Extract SearchInputCore so the popover can reuse search behavior without inheriting the old toolbar wrapper layout."
  - "Constrain the popover with viewport-aware CSS and prove the 600px layout with fixture-only E2E evidence."
patterns-established:
  - "Search UI state remains owned by FilterBar/store while SearchPopover composes the reusable SearchInputCore."
requirements-completed: []
completed: 2026-05-31
---

# Phase 25 Plan 06: SearchPopover/SearchTrigger UI Refactor + Toolbar Layout Summary

**Replaced the rejected side-by-side Search and Filter rows composition with a primary row-filter input and a compact, responsive Search popover.**

## Accomplishments

- Added compact `SearchTrigger` and reusable `SearchPopover` components with active-state, match-status, navigation and Escape-close behavior.
- Extracted `SearchInputCore` from the legacy Search input wrapper so the complete search interaction could live inside the popover.
- Refactored `FilterBar` so Filter rows is the sole flexible primary input and the Search trigger opens and focuses the popover, including the `/` shortcut.
- Added focused component tests, updated Phase 25 E2E coverage and generated fixture-only desktop and 600px evidence.

## Verification

Reconciled against the current implementation on 2026-06-13:

- `pnpm exec vitest run packages/ui/src/components/filters/SearchPopover.test.tsx packages/ui/src/components/filters/SearchTrigger.test.tsx packages/ui/src/components/filters/FilterBar.test.tsx packages/ui/src/state/persistence.test.ts` — **88 tests passed** across the combined Phase 25 gap surfaces.
- `pnpm --filter @ahp-inspector/ui typecheck` — **passed**.
- Historical implementation includes Phase 25 browser evidence in `e2e/phase25.spec.ts` and fixture screenshots under `screenshots/phase25/`.

## Task Commits

- `1c1ce1b` — create SearchPopover and SearchTrigger components
- `205873a` — refactor FilterBar layout with SearchPopover and SearchTrigger
- `d1b7475` — extract SearchInputCore and refactor SearchInput for reuse
- `45c0625` — add SearchPopover and SearchTrigger unit tests
- `21bf9ea` — update E2E tests for the new SearchPopover layout
- `3414f30` — harden SearchPopover positioning and E2E constraints

## Decisions Made

- Search remains independent from row filtering, but its controls are hidden behind a compact trigger until needed.
- FilterBar/store owns popover visibility and focus behavior so keyboard shortcuts and timeline Escape priority have one source of truth.
- Responsive containment is implemented with CSS constraints and verified at a narrow fixture viewport.

## Deviations from Plan

- The approved gap-closure plan described Filter rows as the primary visible input, despite the earlier Plan 25-05 feedback suggesting a toggle-revealed row filter. The implemented Search-trigger design follows the revised UI-SPEC and was the final accepted composition.
- The implementation was split across six focused commits rather than the plan's task labels; all acceptance surfaces were covered.

## Issues Encountered

- Initial popover placement and E2E constraints needed a follow-up hardening commit so the menu remained contained and the fixture evidence exercised the intended state.

## Self-Check: PASSED

- Implementation files, focused tests, E2E coverage and historical commits all exist.
- Focused tests and UI typecheck pass on the current `main` branch.

---
*Phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl*
*Completed: 2026-05-31*
