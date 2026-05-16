---
phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
plan: 06
subsystem: ui-lifecycle
tags: [persistence, viewport, tail-follow, virtualization]
requires:
  - phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
    provides: explicit browser baseline load lifecycle from Plan 22-04
provides:
  - Baseline-complete-driven per-log preference hydration
  - Re-entrancy-safe hydration marker handling
  - Late-subscriber replay of completed baseline load lifecycle for persisted state restore
  - Progressive viewport ownership tests for off-tail stability and true tail-follow
affects: [persistence, timeline, live-tail]
tech-stack:
  added: []
  patterns: [explicit lifecycle hydration, viewport ownership regression tests]
key-files:
  created: []
  modified:
    - packages/server/src/app-state.ts
    - packages/server/src/app-state.test.ts
    - packages/server/src/sse-routes.ts
    - test/sse-integration.test.ts
    - packages/ui/src/persistence/persist-effect.ts
    - packages/ui/src/persistence/persist-effect.test.ts
    - packages/ui/src/components/timeline/TimelineList.virt.test.tsx
key-decisions:
  - "Hydration claims the log key before writing restored store state so a still-complete lifecycle cannot recursively re-enter hydration."
patterns-established:
  - "Progressive row visibility must not stand in for baseline completion when restoring per-log preferences."
requirements-completed: []
duration: 4min
completed: 2026-05-16
---

# Phase 22 Plan 06: Persistence and Viewport Lifecycle Summary

**Progressive rows no longer hydrate persisted view state early, and timeline tests pin the distinction between stable inspection and intentional tail-follow.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-16T18:39:18Z
- **Completed:** 2026-05-16T18:43:01Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Replaced first-row persistence hydration with explicit `loadProgress.phase === "complete"` gating.
- Preserved selected-index bounds, log-key switching, save debounce, and quota-disable behavior while adding a re-entrancy guard.
- Added virtualized viewport regressions proving off-bottom progressive growth stays stable and true bottom-follow still advances via the existing rAF behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Hydrate persisted view state after baseline complete** - `6883221` (fix)
2. **Task 2: Cover progressive viewport ownership** - `419a4b2` (test)
3. **Verification fix: Replay baseline completion for late stream clients** - `e26989b` (fix)
4. **Verification fix: Align route mocks with snapshot progress contract** - `b986790` (test)

## Files Created/Modified
- `packages/ui/src/persistence/persist-effect.ts` - Hydrates only on explicit baseline completion and marks hydration before applying restored state.
- `packages/ui/src/persistence/persist-effect.test.ts` - Verifies partial rows do not hydrate, completion does, and existing log-switch/save cases remain intact.
- `packages/ui/src/components/timeline/TimelineList.virt.test.tsx` - Verifies off-tail stability and at-tail scheduled follow under progressive row count growth.

## Decisions Made
No TimelineList production logic needed to change: the existing browser-local `followTailRef` and rAF scroll scheduling were already the right policy. The plan closes the gap by adding explicit progressive-load tests around that behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented recursive baseline-complete hydration**
- **Found during:** Task 1 focused persistence verification
- **Issue:** Hydration wrote store fields while `loadProgress.phase` was still `complete`, re-entering the subscriber before `hydratedFor` was assigned.
- **Fix:** Mark the log key hydrated before applying restored prefs so re-entrant store writes skip the hydration branch.
- **Files modified:** `packages/ui/src/persistence/persist-effect.ts`
- **Verification:** `pnpm exec vitest run packages/ui/src/persistence/persist-effect.test.ts`
- **Committed in:** `6883221`

**2. [Rule 1 - Bug] Replayed completed baseline lifecycle for late SSE subscribers**
- **Found during:** Phase-level Playwright verification (`e2e/phase5.spec.ts`)
- **Issue:** Browsers that subscribed after the CLI had already finished its initial read received snapshot rows but not the earlier `load-progress: complete` frame, so persisted detail selection did not hydrate after reload.
- **Fix:** Retained the current load-progress snapshot in AppState and replayed non-idle lifecycle state immediately after `snapshot-end`; added AppState and SSE integration regression coverage.
- **Files modified:** `packages/server/src/app-state.ts`, `packages/server/src/app-state.test.ts`, `packages/server/src/sse-routes.ts`, `test/sse-integration.test.ts`
- **Verification:** `pnpm exec vitest run packages/server/src/app-state.test.ts test/sse-integration.test.ts`; `pnpm exec playwright test e2e/phase5.spec.ts`
- **Committed in:** `e26989b`

**3. [Rule 3 - Blocking] Updated typed AppState route mocks for snapshot lifecycle replay**
- **Found during:** Full workspace typecheck after the late-subscriber snapshot contract fix
- **Issue:** Server route test doubles still returned `{ meta, rows }` snapshots, so the new required `loadProgress` snapshot field caused TypeScript failures.
- **Fix:** Added idle `load-progress` snapshot payloads to the typed test doubles in route-level tests.
- **Files modified:** `packages/server/src/detail-routes.test.ts`, `packages/server/src/search-routes.test.ts`, `packages/server/src/state-routes.test.ts`
- **Verification:** `pnpm -F @ahp-inspector/server typecheck`; `pnpm typecheck`
- **Committed in:** `b986790`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking contract update).
**Impact on plan:** The fix is necessary for the planned lifecycle trigger to be correct and does not expand scope.

## Issues Encountered
The focused persistence run exposed the hydration re-entrancy bug above, the phase-level Phase 5 Playwright rerun exposed the late-subscriber lifecycle replay gap, and the follow-up workspace typecheck caught stale route test doubles after that contract expansion. All three were fixed and rerun green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
All Phase 22 execution plans are complete; phase-level verification and review can evaluate the complete progressive loading path.

---
*Phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf*
*Completed: 2026-05-16*
