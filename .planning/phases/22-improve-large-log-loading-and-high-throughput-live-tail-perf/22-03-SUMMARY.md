---
phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
plan: 03
subsystem: transport
tags: [tail-reader, progress, sse, backlog]
requires:
  - phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
    provides: changed-row server patch locality from Plans 22-01 and 22-02
provides:
  - Initial-read byte lifecycle signals across the host watch contract
  - Compact truthful AppState load-progress payloads
  - Snapshot-era SSE backlog preservation and reporting
affects: [host-node, shared, server, ui-stream-client]
tech-stack:
  added: []
  patterns: [captured-byte progress, snapshot-era queue drain, compact backlog payload]
key-files:
  created: []
  modified:
    - packages/shared/src/host-protocol.ts
    - packages/host-node/src/tail-reader.ts
    - packages/host-node/src/tail-reader.test.ts
    - packages/server/src/app-state.ts
    - packages/server/src/app-state.test.ts
    - packages/server/src/sse-routes.ts
    - test/sse-integration.test.ts
key-decisions:
  - "Percentages are emitted only from captured initial byte totals greater than zero; zero-byte reads remain explicit but percentage-free."
  - "SSE subscribes before snapshot streaming, defers concurrent live/progress frames until snapshot end, and emits compact backlog counts before draining them."
patterns-established:
  - "Initial-load lifecycle state travels beside rows rather than inside EventRow payloads."
requirements-completed: []
duration: 4min
completed: 2026-05-16
---

# Phase 22 Plan 03: Truthful Progress and Snapshot Backlog Transport Summary

**Initial file reads now publish byte-grounded load progress, and SSE streams preserve live/progress frames that arrive while a large snapshot is still flushing.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-16T18:26:58Z
- **Completed:** 2026-05-16T18:31:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added host watch lifecycle callbacks for initial read start, byte progress, and completion.
- Added compact AppState `load-progress` payloads with optional trustworthy percentages and idle reset behavior.
- Reordered SSE subscription so snapshot-era progress/appends queue safely, publish backlog counts, and drain deterministically after `snapshot-end`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expose initial-read byte lifecycle** - `3c2a1d0` (feat)
2. **Task 2: Emit truthful AppState load progress** - `f638f8d` (feat)
3. **Task 3: Preserve snapshot-era stream backlog** - `a0b6137` (feat)

## Files Created/Modified
- `packages/shared/src/host-protocol.ts` - Adds typed optional initial-read watch callbacks.
- `packages/host-node/src/tail-reader.ts` - Reports captured byte lifecycle from `sizeAtStart` and cursor progress.
- `packages/server/src/app-state.ts` - Emits `load-progress` and defines compact `stream-backlog` payloads.
- `packages/server/src/sse-routes.ts` - Queues concurrent frames during snapshot streaming and drains them after backlog reporting.
- `test/sse-integration.test.ts` - Proves progress and append frames survive multi-chunk snapshot streaming without path disclosure.

## Decisions Made
Progress remains denominator-honest: total byte counts travel from the initial stat, percentages are optional, and empty files do not fabricate a percentage. Backlog payloads report queue pressure rather than embedding new metadata inside row frames.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Plan 22-04 can consume `load-progress` and `stream-backlog` frames in the browser, progressively publish snapshot chunks, and schedule live stream drains.

---
*Phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf*
*Completed: 2026-05-16*
