---
phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
plan: 02
subsystem: server
tags: [app-state, patches, correlator, performance]
requires:
  - phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
    provides: correlator changed-index drain contract from Plan 22-01
provides:
  - Append-time AppState patch projection keyed by changed indexes
  - Flush-time AppState patch projection bounded to timed-out changed rows
affects: [server, sse, live-tail, row-projection]
tech-stack:
  added: []
  patterns: [changed-index patch projection, shared patch update helper]
key-files:
  created: []
  modified:
    - packages/server/src/app-state.ts
    - packages/server/src/app-state.test.ts
key-decisions:
  - "AppState drains correlator changes once per append and filters append-time patches to rows that were already visible before the append."
patterns-established:
  - "Server row patch fanout should consume exact changed indexes and keep append payloads authoritative for newly appended rows."
requirements-completed: []
duration: 2min
completed: 2026-05-16
---

# Phase 22 Plan 02: AppState Changed-Row Patch Projection Summary

**AppState now emits delayed pair and timeout patches from exact changed row indexes instead of rediscovering them with history-wide scans.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-16T18:24:51Z
- **Completed:** 2026-05-16T18:26:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Removed the append-time `0..range.from` historical patch rediscovery loop.
- Removed the flush-time `0..store.size()` patch rediscovery loop.
- Added precise patch locality tests for late pairs, displaced requests, and timed-out requests after unaffected history.

## Task Commits

Each task was committed atomically:

1. **Task 1: Project append patches from changed indexes** - `248879e` (perf)
2. **Task 2: Bound flush patch projection to changed rows** - `3c0c060` (perf)

## Files Created/Modified
- `packages/server/src/app-state.ts` - Uses correlator changed-index drains through a shared compact patch projection helper.
- `packages/server/src/app-state.test.ts` - Guards exact patch index locality and compact payload behavior.

## Decisions Made
Append rows remain the source of truth for brand-new indexes, so append-time drains only project patches for indexes before the current append range. Flush drains have no such filter because every changed timeout row is already visible.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Plan 22-03 can add truthful read progress and live backlog transport on top of a server patch path that no longer scales with prior history.

---
*Phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf*
*Completed: 2026-05-16*
