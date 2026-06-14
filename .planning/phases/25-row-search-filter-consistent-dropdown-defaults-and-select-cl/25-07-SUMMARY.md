---
phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
plan: 07
subsystem: persistence
tags: [migration, filters, preferences, regression-test]
requires:
  - phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
    provides: "Versioned v1-to-v2 filter preference migration"
provides:
  - "Lossless migration of valid v1 categorical hidden-value preferences"
  - "Regression coverage for custom hidden Method values"
affects: [per-log-preferences, filter-defaults, schema-migration]
key-files:
  created: []
  modified:
    - packages/ui/src/state/persistence.ts
    - packages/ui/src/state/persistence.test.ts
key-decisions:
  - "Preserve every valid v1 categorical string array exactly; use app defaults only for missing or invalid fields."
  - "Apply the Method data-loss fix consistently to direction, kind, actionType, session, turn and status."
patterns-established:
  - "Schema migration validates each persisted categorical array before preserving it."
requirements-completed: []
completed: 2026-05-31
---

# Phase 25 Plan 07: Preserve v1 Hidden Method Preferences Summary

**Made the v1-to-v2 preference migration lossless for valid categorical hidden-value arrays and locked the behavior with a custom-Method regression test.**

## Accomplishments

- Updated `migrateV1Filters()` to validate and preserve all valid v1 categorical string arrays.
- Retained fresh-install defaults for categorical fields that are absent or invalid.
- Added a regression test proving custom hidden Method values survive migration unchanged.
- Corrected the existing migration expectation so it validates preservation rather than the prior data-losing fallback behavior.

## Verification

Reconciled against the current implementation on 2026-06-13:

- `pnpm exec vitest run packages/ui/src/components/filters/SearchPopover.test.tsx packages/ui/src/components/filters/SearchTrigger.test.tsx packages/ui/src/components/filters/FilterBar.test.tsx packages/ui/src/state/persistence.test.ts` — **88 tests passed**, including all 11 persistence tests.
- `pnpm --filter @ahp-inspector/ui typecheck` — **passed**.
- Current source confirms `migrateV1Filters()` preserves direction, kind, method, actionType, session, turn and status through validated array extraction.

## Task Commits

- `3871d4f` — preserve legacy categorical filter arrays during v1-to-v2 migration
- `c87d3b9` — add regression test for custom hidden Method array preservation
- `ff691ec` — fix the existing test expectation to validate legacy filter preservation

## Decisions Made

- Valid persisted preferences take precedence over app defaults during migration.
- The narrow Method bug was resolved for every categorical filter because they shared the same data-loss mechanism.
- Invalid or missing persisted values still fall back to app defaults, preserving migration safety.

## Deviations from Plan

- None. The implementation applies the requested validation-and-preservation behavior to every categorical array and adds the specified regression coverage.

## Issues Encountered

- An existing migration expectation encoded the old fallback behavior and required a focused follow-up correction after the preservation fix landed.

## Self-Check: PASSED

- Implementation and regression-test commits exist and match the plan's acceptance criteria.
- Focused persistence tests and UI typecheck pass on the current `main` branch.

---
*Phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl*
*Completed: 2026-05-31*
