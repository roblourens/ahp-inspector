---
phase: 08-server-state-at-index-api-and-cache-integration
plan: 01
subsystem: server
tags: [app-state, replay-cache, sse-boundary]
requires:
  - phase: 07-deterministic-replay-engine
    provides: Pure replayToIndex API
provides:
  - StateReplayIndex exact-index replay cache
  - AppState.stateAtIndex lifecycle integration
  - Lazy replay boundary tests proving SSE rows do not carry reconstructed state
affects: [phase-08, server, app-state]
tech-stack:
  added: []
  patterns: [bounded-lru-cache, appstate-owned-index, lazy-state-delivery]
key-files:
  created:
    - packages/server/src/state-replay-index.ts
    - packages/server/src/state-replay-index.test.ts
  modified:
    - packages/server/src/app-state.ts
    - packages/server/src/app-state.test.ts
    - packages/server/src/detail-routes.test.ts
    - packages/server/src/search-routes.test.ts
key-decisions:
  - "State replay caching is per AppState instance with exact-index LRU entries and maxEntries = 25."
  - "Invalid or out-of-range replay requests still return replay diagnostics but are not cached."
  - "SSE payloads and EventRow snapshots remain row/control-only; reconstructed replay state is only available through AppState.stateAtIndex."
patterns-established:
  - "AppState interface mocks must provide stateAtIndex when used in route tests."
requirements-completed: [CONF-03]
duration: inline
completed: 2026-05-08
---

# Phase 8 Plan 01 Summary

**AppState now owns a bounded replay cache and exposes lazy state-at-index results without inflating SSE payloads.**

## Accomplishments

- Added `StateReplayIndex` with exact-index cache hit/miss metadata, LRU eviction, append-stable historical cache entries, reset clearing, and non-caching invalid/out-of-range behavior.
- Added `AppState.stateAtIndex(targetIndex)` returning replay result, cache metadata, and `totalEvents`.
- Cleared replay cache during rotation reset and dispose alongside other AppState-owned derived indexes.
- Added AppState tests for cache lifecycle, rotation clearing, dispose idempotence, and lazy SSE boundary.
- Updated existing route-test AppState mocks to satisfy the new interface method.

## Task Commits

- `4276366 feat(08): add state replay index cache`
- `bc89a02 feat(08): wire replay cache into app state`
- `4ee4c8b test(08): assert lazy replay state boundary`

## Validation

```bash
pnpm test -- packages/server/src/state-replay-index.test.ts packages/server/src/app-state.test.ts
pnpm typecheck
```

## Deviations from Plan

### Auto-fixed Issues

**1. Existing route-test AppState mocks missed the new `stateAtIndex` method**
- **Found during:** Task 08-01-03 typecheck
- **Issue:** `detail-routes.test.ts` and `search-routes.test.ts` manually construct `AppState` mocks and failed typecheck after the interface extension.
- **Fix:** Added minimal `stateAtIndex` mock implementations returning empty replay results and cache metadata.
- **Files modified:** `packages/server/src/detail-routes.test.ts`, `packages/server/src/search-routes.test.ts`
- **Verification:** `pnpm typecheck`

## Issues Encountered

None remaining.

## Next Phase Readiness

Plan 08-02 can add the `/api/state-at` route on top of `AppState.stateAtIndex`.

---
*Phase: 08-server-state-at-index-api-and-cache-integration*
*Completed: 2026-05-08*
