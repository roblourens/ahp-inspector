---
phase: 07-deterministic-replay-engine
plan: 01
subsystem: core
tags: [ahp, replay, reducers, diagnostics]
requires:
  - phase: 06-protocol-reducer-sync-foundation
    provides: Generated @ahp-viewer/protocol package
provides:
  - Pure replay API exported from @ahp-viewer/core
  - Snapshot baseline installation for initialize and subscribe responses
  - Server action envelope application for root/session/terminal reducers
affects: [phase-07, phase-08, core]
tech-stack:
  added: []
  patterns: [pure-replay-core, guarded-raw-protocol-boundaries, replay-diagnostics]
key-files:
  created:
    - packages/core/src/replay.ts
    - packages/core/src/replay.test.ts
  modified:
    - packages/core/package.json
    - packages/core/src/index.ts
    - pnpm-lock.yaml
key-decisions:
  - "Replay lives in @ahp-viewer/core and imports canonical reducer/state/action types directly from @ahp-viewer/protocol."
  - "Malformed payloads, missing baselines, and unknown resources become diagnostics rather than thrown failures."
patterns-established:
  - "Replay input remains a readonly AhpEvent array; no server, UI, filesystem, or cache lifecycle work belongs in Phase 7."
requirements-completed: [REPLAY-01, REPLAY-02, REPLAY-03]
duration: inline
completed: 2026-05-08
---

# Phase 7 Plan 01 Summary

**Core replay now exposes a pure reducer-backed API with snapshot baselines and server-envelope application.**

## Accomplishments

- Added `@ahp-viewer/protocol` as a direct `@ahp-viewer/core` workspace dependency.
- Created `packages/core/src/replay.ts` with typed replay resource, diagnostic, client-intent, and result contracts.
- Exported the replay API from the core package barrel.
- Installed `initialize.result.snapshots[]` and `subscribe.result.snapshot` as root/session/terminal baselines.
- Applied server `action` envelopes to the correct canonical reducer when a matching baseline exists.
- Added synthetic replay tests for invalid target indexes, snapshots, action envelopes, missing baselines, and malformed payloads.

## Validation

```bash
pnpm test -- packages/core/src/replay.test.ts
pnpm typecheck
```

## Deviations from Plan

None remaining.

## Issues Encountered

- After adding the core protocol dependency, `pnpm install --lockfile-only` did not refresh workspace symlinks. Running `pnpm install` fixed local package resolution.

## Next Phase Readiness

Plan 07-02 can build deterministic reducer execution and server sequence diagnostics on this replay foundation.

---
*Phase: 07-deterministic-replay-engine*
*Completed: 2026-05-08*
