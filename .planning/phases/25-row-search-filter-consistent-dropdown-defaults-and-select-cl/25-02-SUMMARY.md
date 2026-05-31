---
phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
plan: 02
subsystem: persistence
tags: [local-storage, migration, filters, vitest]
requires:
  - phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
    provides: "Hidden-value facets and rowText filter state from Plan 25-01"
provides:
  - "Schema-v2 per-log preference persistence for rowText and hidden categorical facets"
  - "Safe v1 migration that cannot reinterpret inclusion arrays as exclusions"
  - "Hydration/save/reset tests for the new visibility contract"
affects: [persistence, filters, log-switch]
tech-stack:
  added: []
  patterns: ["versioned local preference decoder", "safe-default semantic migration"]
key-files:
  created: []
  modified:
    - packages/ui/src/state/persistence.ts
    - packages/ui/src/state/persistence.test.ts
    - packages/ui/src/persistence/persist-effect.ts
    - packages/ui/src/persistence/persist-effect.test.ts
    - packages/ui/src/state/store.test.ts
key-decisions:
  - "Schema v1 categorical arrays are reset to APP_DEFAULT_FILTERS on read because preserving inclusion selections as v2 hidden exclusions would invert visibility."
  - "Compatible v1 time bounds are preserved during migration because their semantics did not change."
patterns-established:
  - "Preference migrations decode stored unknown data into current FilterState rather than casting legacy storage into live state."
requirements-completed: [FILTER-25-03]
duration: 4 min
completed: 2026-05-29
---

# Phase 25 Plan 02: Preference Migration Summary

**Per-log preferences now store row filtering and hidden facets as schema `v: 2`, with safe migration for inclusion-era saved entries.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-29T21:49:00Z
- **Completed:** 2026-05-29T21:53:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Upgraded per-log preferences to schema `v: 2` and added runtime decoding for the complete current filter state, including `rowText`.
- Migrated schema `v: 1` entries by discarding incompatible selected categorical arrays in favor of application defaults, preventing restored logs from hiding the rows users previously selected.
- Verified hydrate, debounced save and clear/reset paths all preserve the new hidden-value and row-filter contract while Search remains separate.

## Task Commits

Each task was committed atomically in RED/GREEN pairs:

1. **Task 1 RED: Define versioned filter preference migration** - `d361862` (test)
2. **Task 1 GREEN: Migrate stored filter preferences to schema v2** - `1b1c16c` (feat)
3. **Task 2 RED: Cover restored row filter and reset defaults** - `9122836` (test)
4. **Task 2 GREEN: Persist row filter visibility contract** - `dd2c2f9` (feat)

## Files Created/Modified

- `packages/ui/src/state/persistence.ts` - Decodes v2 preferences and migrates v1 filter data safely.
- `packages/ui/src/state/persistence.test.ts` - Covers row-text round trips and semantic migration behavior.
- `packages/ui/src/persistence/persist-effect.ts` - Writes schema-v2 preference payloads.
- `packages/ui/src/persistence/persist-effect.test.ts` - Proves hydration and debounce writes preserve hidden facets and row text.
- `packages/ui/src/state/store.test.ts` - Pins `clearFilters()` to `APP_DEFAULT_FILTERS`.

## Decisions Made

- Keep the existing localStorage container key while versioning each preference entry; no destructive storage rewrite is needed.
- Reset legacy categorical filters to the new default-hidden contract while retaining compatible time bounds, search text and layout state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- UI typecheck identified a widened `string[]` in the new status-filter test fixture; explicitly typing it as `FilterState` kept the test aligned with the production contract.

## Verification

- `pnpm exec vitest run packages/ui/src/state/persistence.test.ts packages/ui/src/persistence/persist-effect.test.ts packages/ui/src/state/store.test.ts` - passed (33 tests).
- `pnpm --filter @ahp-inspector/ui typecheck` - passed.
- Acceptance checks confirmed v2 writes, row-text storage/restoration and guarded v1 migration are present.

## User Setup Required

None - existing browser-local preferences migrate automatically on read.

## Next Phase Readiness

- Plan 25-03 can render row-text and checked-visible controls backed by durable state without introducing a new persistence seam.
- Existing pending filter-toolbar work remains uncommitted and must be preserved while applying Plan 25-03 UI changes.

## Self-Check: PASSED

- All planned source and test updates are committed.
- Focused persistence verification and UI typecheck pass.
- Pre-existing toolbar/timeline worktree edits were not changed by this plan.

---
*Phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl*
*Completed: 2026-05-29*