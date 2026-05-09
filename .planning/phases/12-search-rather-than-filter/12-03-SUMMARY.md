---
phase: 12-search-rather-than-filter
plan: 03
subsystem: persistence-testing-docs
tags: [persistence, playwright, docs, search, e2e]
requires:
  - phase: 12-search-rather-than-filter
    provides: "search state separation and navigation UI"
provides:
  - "Persistence tests proving volatile search result metadata is not durable"
  - "Phase 12 Playwright regression for search highlighting/navigation with filters"
  - "Updated user-facing docs for search versus filters"
affects: [persistence, e2e, docs, search]
tech-stack:
  added: []
  patterns: ["sanitize persisted preference shape", "build UI before CLI-served E2E"]
key-files:
  created:
    - e2e/phase12.spec.ts
    - screenshots/phase12/01-search-keeps-context.png
  modified:
    - packages/ui/src/state/persistence.ts
    - packages/ui/src/state/persistence.test.ts
    - packages/ui/src/persistence/persist-effect.ts
    - packages/ui/src/persistence/persist-effect.test.ts
    - USER_GUIDE.md
    - README.md
key-decisions:
  - "Persist searchQuery as durable input but sanitize all volatile search result metadata."
  - "Hydration clears stale search matches before useSearch refetches results for the restored query."
patterns-established:
  - "E2E specs using the CLI must run against a freshly built packages/ui/dist bundle."
requirements-completed: [SEARCH-05, EXT-04, VERIFY-02, VERIFY-03]
duration: "not recorded"
completed: 2026-05-09
---

# Phase 12 Plan 03 Summary

**Search persistence, browser regression coverage, and docs now match the find/highlight/navigation model.**

## Accomplishments

- Sanitized `loadPerLogPrefs` so even legacy or manually polluted entries return only the public durable preference shape.
- Cleared volatile search results during preference hydration while preserving the durable search query.
- Added persistence tests covering volatile metadata exclusion and hydration clearing.
- Added `e2e/phase12.spec.ts` proving search marks/navigates a match without hiding context rows and that facets still narrow rows.
- Updated `USER_GUIDE.md` and `README.md` to describe search as highlighting/navigation and filters as row narrowing.

## Verification

- `pnpm --filter @ahp-inspector/ui test -- persistence.test.ts persist-effect.test.ts store.test.ts`
- `pnpm --filter @ahp-inspector/ui build`
- `pnpm e2e -- e2e/phase12.spec.ts`
- `pnpm --filter @ahp-inspector/ui typecheck`
- `pnpm --filter @ahp-inspector/ui test -- selectors.test.ts store.test.ts search-client.test.ts TimelineRegion.test.tsx FilterBar.test.tsx TimelineList.virt.test.tsx EventRow.columns.test.tsx AppShell.test.tsx persistence.test.ts persist-effect.test.ts`
- `pnpm test -- --run test/vertical-slice.test.ts`

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

The first E2E run used a stale UI bundle and showed the old filtering behavior. Running `pnpm --filter @ahp-inspector/ui build` refreshed `packages/ui/dist`; after adjusting the facet option selector to the actual checkbox-label markup, the Phase 12 E2E passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 12 has unit, typecheck, vertical-slice, and browser coverage for the new search behavior. Future CLI-served UI E2E should build `@ahp-inspector/ui` first when source changes affect the browser bundle.

---
*Phase: 12-search-rather-than-filter*
*Completed: 2026-05-09*
