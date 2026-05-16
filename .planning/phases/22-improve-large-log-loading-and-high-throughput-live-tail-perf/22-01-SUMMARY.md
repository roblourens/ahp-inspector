---
phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
plan: 01
subsystem: core
tags: [correlator, event-store, live-tail, performance]
requires:
  - phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
    provides: validated phase context and performance plan
provides:
  - Correlator changed-index drain contract for exact derived-row patch locality
  - Timeout and reset-safe changed-index lifecycle handling
affects: [server, app-state, live-tail, row-projection]
tech-stack:
  added: []
  patterns: [mutation-locality drain set, TDD drain lifecycle coverage]
key-files:
  created: []
  modified:
    - packages/core/src/correlator.ts
    - packages/core/src/correlator.test.ts
key-decisions:
  - "Changed-index tracking is recorded at correlator mutation sites and drained as a deduplicated insertion-ordered array."
patterns-established:
  - "Derived metadata producers expose exact changed indexes instead of requiring consumers to rediscover mutations by scanning row history."
requirements-completed: []
duration: 2min
completed: 2026-05-16
---

# Phase 22 Plan 01: Correlator Changed-Index Contract Summary

**Correlator mutations now expose exact changed row indexes for pairing, displacement, timeout flushes, and reset-safe live-tail patch projection.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-16T18:22:08Z
- **Completed:** 2026-05-16T18:24:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `drainChangedIndexes()` so downstream patch projection can consume row-local correlation changes.
- Recorded pair, displacement, pending request, timeout flush, and reset lifecycle mutations without adding any history-wide scan.
- Added TDD coverage proving drain deduplication, empty second drains, timeout locality, and reset clearing.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: changed-index drain coverage** - `b45880f` (test)
2. **Task 1 GREEN: changed-index drain implementation** - `3912327` (feat)
3. **Task 2 RED: flush/reset lifecycle coverage** - `f250bfe` (test)
4. **Task 2 GREEN: timeout/reset lifecycle implementation** - `08948e2` (feat)

## Files Created/Modified
- `packages/core/src/correlator.ts` - Tracks and drains exact changed correlation indexes.
- `packages/core/src/correlator.test.ts` - Verifies pair, displacement, timeout, and reset changed-index behavior.

## Decisions Made
Changed-index tracking is stored as a `Set<number>` and exposed only through a drain API. That keeps duplicate mutation paths cheap while making consumption deterministic for the next AppState plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Plan 22-02 can replace AppState's historical patch rediscovery loops with correlator changed-index drains.

---
*Phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf*
*Completed: 2026-05-16*
