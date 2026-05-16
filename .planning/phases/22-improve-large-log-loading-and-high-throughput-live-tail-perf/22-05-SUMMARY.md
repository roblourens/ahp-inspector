---
phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
plan: 05
subsystem: ui
tags: [loading-state, backlog-pill, timeline-region, progress]
requires:
  - phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
    provides: explicit browser progress/backlog store state from Plan 22-04
provides:
  - Truthful loading progress copy for percent and indeterminate modes
  - Passive compact stream backlog cue separate from manual pause controls
  - Timeline composition that keeps progressive rows visible while status persists
affects: [timeline, loading-ui, live-tail-status]
tech-stack:
  added: []
  patterns: [truthful optional progress copy, passive backlog cue]
key-files:
  created:
    - packages/ui/src/components/shell/StreamBacklogPill.tsx
    - packages/ui/src/components/shell/StreamBacklogPill.test.tsx
  modified:
    - packages/ui/src/components/states/LoadingState.tsx
    - packages/ui/src/components/states/states.test.tsx
    - packages/ui/src/components/timeline/TimelineRegion.tsx
    - packages/ui/src/components/timeline/TimelineRegion.test.tsx
key-decisions:
  - "Backlog status is passive status text, never a resume button and never coupled to manual pause counters."
patterns-established:
  - "Rows remain primary during partial baseline loading; progress status augments rather than replacing the timeline once rows exist."
requirements-completed: []
duration: 4min
completed: 2026-05-16
---

# Phase 22 Plan 05: Progressive Loading and Backlog UI Summary

**The timeline now stays usable during baseline loading while honest progress copy and a passive compact backlog cue expose ongoing work.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-16T18:35:01Z
- **Completed:** 2026-05-16T18:38:36Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added percentage-aware and non-percent loading copy without changing basename-safe file display.
- Added `StreamBacklogPill` as a passive, compact transport-lag status cue.
- Kept `TimelineList` visible once rows exist while rendering inline load progress and backlog status nearby.

## Task Commits

Each task was committed atomically:

1. **Task 1: Render truthful loading progress copy** - `9e2d4d6` (feat)
2. **Task 2: Add passive stream backlog pill** - `9691812` (feat)
3. **Task 3: Keep rows visible with progress and backlog cues** - `f734907` (feat)

## Files Created/Modified
- `packages/ui/src/components/states/LoadingState.tsx` - Renders percent or non-percent progress copy only when supported by state.
- `packages/ui/src/components/shell/StreamBacklogPill.tsx` - Displays compact queued-stream status without click semantics.
- `packages/ui/src/components/timeline/TimelineRegion.tsx` - Composes zero-row loading, inline partial-load progress, visible timeline rows, and backlog status.

## Decisions Made
When rows exist, progress is rendered inline and the timeline remains mounted. The full empty loading state is reserved for the zero-row connecting case so detail and selection flows stay available as soon as rows arrive.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Plan 22-06 can align persistence hydration and viewport ownership with progressive row visibility.

---
*Phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf*
*Completed: 2026-05-16*
