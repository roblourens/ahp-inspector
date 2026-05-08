---
phase: 07-deterministic-replay-engine
plan: 02
subsystem: core
tags: [ahp, replay, determinism, server-seq]
requires:
  - phase: 07-deterministic-replay-engine
    provides: Pure replay API and baseline/envelope handling
provides:
  - Event-time Date.now reducer execution
  - Reducer log capture as replay diagnostics
  - Server sequence gap, duplicate, and out-of-order diagnostics
affects: [phase-07, phase-08, core]
tech-stack:
  added: []
  patterns: [event-time-replay, reducer-log-diagnostics, per-resource-sequence-tracking]
key-files:
  created: []
  modified:
    - packages/core/src/replay.ts
    - packages/core/src/replay.test.ts
key-decisions:
  - "Generated reducers run synchronously inside a try/finally Date.now patch using the current AhpEvent timestamp."
  - "Sequence gaps mark the resource partial but still apply the later canonical envelope; duplicate/out-of-order envelopes are skipped."
patterns-established:
  - "Reducer logs are surfaced as unknown-action diagnostics and degrade only the affected resource confidence."
requirements-completed: [REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04]
duration: inline
completed: 2026-05-08
---

# Phase 7 Plan 02 Summary

**Replay is deterministic across reducer time branches, reducer soft errors, and server sequence anomalies.**

## Accomplishments

- Wrapped all root/session/terminal reducer calls in an event-time `Date.now` patch with `finally` restoration.
- Captured generated reducer log callbacks as `unknown-action` diagnostics.
- Marked affected resources `partial` when reducer diagnostics or server sequence problems are present.
- Tracked `lastServerSeq` per resource, initialized from snapshot `fromSeq`.
- Diagnosed server sequence gaps, duplicates, and out-of-order envelopes deterministically.
- Added tests proving event timestamp usage, Date.now restoration, replay stability, reducer log handling, and sequence behavior.

## Validation

```bash
pnpm test -- packages/core/src/replay.test.ts
pnpm typecheck
```

## Deviations from Plan

None remaining.

## Issues Encountered

None remaining.

## Next Phase Readiness

Plan 07-03 can add reconnect replay/snapshot handling and client intent capture without changing the pure core boundary.

---
*Phase: 07-deterministic-replay-engine*
*Completed: 2026-05-08*
