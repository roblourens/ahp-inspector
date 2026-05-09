---
phase: 03-detail-search-and-filtering
plan: "02"
subsystem: ui-state
tags: [zustand, selectors, filters, grouping, performance]
dependency_graph:
  requires: ["03-00"]
  provides: ["filters.ts exports", "selectors.ts hooks", "Phase 3 Zustand slices"]
  affects: ["03-03", "03-04"]
tech_stack:
  added: []
  patterns:
    - "useDeferredValue on filters for DoS mitigation"
    - "Zustand setState partial reset in tests"
    - "Conditional spread for exactOptionalPropertyTypes compatibility"
key_files:
  created:
    - packages/ui/src/state/filters.ts
    - packages/ui/src/state/selectors.ts
    - packages/ui/src/state/selectors.test.ts
    - packages/ui/src/state/selectors.perf.test.ts
  modified:
    - packages/ui/src/state/store.ts
decisions:
  - "useDeferredValue wraps filters and searchMatches in useFilteredRows — mitigates T-03-02-01 (DoS: main-thread block at 50k+ rows); perf gate confirmed 11ms < 15ms threshold"
  - "Conditional spread { ...(row.turnId !== null ? { turnId: row.turnId } : {}) } used for VirtualItem header to satisfy exactOptionalPropertyTypes without widening the type union"
  - "noNonNullAssertion replaced with optional chaining (?.) on deferredMatches in filteredRows loop — semantically equivalent since noSearch guard ensures it is non-null"
metrics:
  duration: "5min"
  completed: "2026-05-07"
  tasks: 2
  files: 5
---

# Phase 03 Plan 02: Client-Side Filter & Grouping State Summary

**One-liner:** Zustand store extended with Phase 3 slices (search/filter/grouping/detail); `filters.ts` and memoized `selectors.ts` hooks with 50k-row perf gate passing at 11 ms.

## What Was Built

### Task 1: `store.ts` Extension + `filters.ts` Creation

**`packages/ui/src/state/filters.ts`** — new file:
- `FilterState` interface: 9-dimensional filter (direction, kind, method, actionType, session, turn, status, timeFrom, timeTo)
- `EMPTY_FILTERS` constant (all-empty / all-null initial value)
- `isFiltersEmpty(f)` — quick short-circuit check used in selectors
- `applyFacets(row, f)` — pure row→boolean matcher; empty arrays mean "match-all"

**`packages/ui/src/state/store.ts`** — extended:
- Re-exports `FilterState` from `filters.ts`
- New types: `GroupingMode = "none" | "session" | "session+turn"`, `DetailData`
- 8 new `AppStoreState` fields: `searchQuery`, `searchMatches`, `filters`, `grouping`, `groupCollapsed`, `selectedDetail`, `detailWidth`
- 9 new typed actions: `setSearchQuery`, `setSearchMatches`, `setFilters`, `patchFilter`, `clearFilters`, `setGrouping`, `toggleGroupCollapsed`, `setSelectedDetail`, `setDetailWidth`

### Task 2: `selectors.ts` + Tests (TDD)

**RED:** `selectors.test.ts` (14 tests) + `selectors.perf.test.ts` (1 test) committed first, confirming failure on missing module.

**GREEN:** `packages/ui/src/state/selectors.ts`:
- `useFilteredRows()` — applies facets ∩ searchMatches using `useDeferredValue` on both
- `useFacetCounts()` — counts per-facet options across all rows (for chip option lists)
- `useGroupedItems(filteredRowIdxs)` — builds `VirtualItem[]` with session/turn headers and gap-banners
- `VirtualItem` type union (row | header | gap-banner) exported

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm -F @ahp-inspector/ui test src/state/` | ✅ 20/20 tests passed |
| Perf gate (50k rows, 1 facet filter) | ✅ 11 ms < 15 ms |
| `pnpm -F @ahp-inspector/ui build` | ✅ 226 KB bundle, no errors |
| `pnpm typecheck` | ✅ All packages clean |
| `pnpm lint` | ✅ Clean (no errors or warnings after fix) |
| Hex-literal guard in state/ | ✅ 0 results |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript `exactOptionalPropertyTypes` error on `turnId` in VirtualItem header**
- **Found during:** Task 2, GREEN phase
- **Issue:** Plan template code `turnId: row.turnId ?? undefined` produces `string | undefined` which is incompatible with optional property under `exactOptionalPropertyTypes: true`
- **Fix:** Replaced with conditional spread `...(row.turnId !== null ? { turnId: row.turnId } : {})` so the property is either present (string) or absent
- **Files modified:** `packages/ui/src/state/selectors.ts`

**2. [Rule 1 - Bug] Biome `noNonNullAssertion` lint rule on `deferredMatches!.has(i)`**
- **Found during:** Task 2 lint pass
- **Issue:** Plan template code uses `!` non-null assertion; biome flags this (style/noNonNullAssertion)
- **Fix:** Replaced with optional chaining `deferredMatches?.has(i)` — semantically equivalent because the `noSearch` guard above ensures `deferredMatches` is non-null when this branch executes
- **Files modified:** `packages/ui/src/state/selectors.ts`

**3. [Rule 1 - Bug] Biome `organizeImports` + format on new files**
- **Found during:** Task 2 lint pass
- **Issue:** New files had import ordering and formatting inconsistencies
- **Fix:** `pnpm format` + `pnpm lint --fix` applied automatically; duplicate `applyFacets` import merged in test file
- **Files modified:** `filters.ts`, `selectors.ts`, `selectors.test.ts`, `selectors.perf.test.ts`, `store.ts`

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-03-02-01 (DoS main-thread) | `useDeferredValue` on filters + 50k perf gate | ✅ Gate passes at 11ms |
| T-03-02-02 (XSS in chip labels) | No new rendering; filter values from EventRow (already sanitized) | ✅ Accepted |
| T-03-02-03 (Info Disclosure via detailWidth) | In-memory UI state only | ✅ Accepted |

## Commits

| Hash | Message |
|------|---------|
| `267b9a7` | feat(03-02): extend store.ts with Phase 3 slices + create filters.ts |
| `1092250` | test(03-02): RED - failing tests for useFilteredRows, useFacetCounts, useGroupedItems selectors |
| `ef9e66c` | feat(03-02): GREEN - selectors.ts implementing useFilteredRows, useFacetCounts, useGroupedItems |

## Self-Check: PASSED
