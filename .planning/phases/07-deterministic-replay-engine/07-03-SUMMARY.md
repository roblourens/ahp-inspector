---
phase: 07-deterministic-replay-engine
plan: 03
subsystem: core
tags: [ahp, replay, reconnect, client-intent, validation]
requires:
  - phase: 07-deterministic-replay-engine
    provides: Deterministic reducer execution and server sequence diagnostics
provides:
  - Reconnect replay and snapshot response handling
  - Client dispatchAction intent capture without canonical state mutation
  - Full Phase 7 focused and repository validation
affects: [phase-07, phase-08, core]
tech-stack:
  added: []
  patterns: [reconnect-replay, ignored-client-intent, client-seq-acceptance-linking]
key-files:
  created: []
  modified:
    - packages/core/src/replay.ts
    - packages/core/src/replay.test.ts
key-decisions:
  - "Reconnect replay actions apply in response-array order using the reconnect response event timestamp."
  - "Client dispatchAction is diagnostic intent only; later server envelopes are the only mutation path and may link acceptance by origin.clientSeq."
patterns-established:
  - "Malformed reconnect entries continue after diagnostics so later valid embedded actions can still be replayed."
requirements-completed: [REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04, REPLAY-05, REPLAY-06]
duration: inline
completed: 2026-05-08
---

# Phase 7 Plan 03 Summary

**Replay now covers reconnect responses and visible client intent while keeping canonical state server-authored.**

## Accomplishments

- Added `reconnect` result handling for `type: "replay"` action arrays and `type: "snapshot"` fresh baselines.
- Emitted `reconnect-missing-resource` diagnostics for replay responses with missing resources.
- Continued replay after malformed reconnect action entries.
- Captured c2s `dispatchAction` notifications as `ReplayClientIntent` records and `ignored-client-intent` diagnostics.
- Linked later accepted server envelopes back to matching client intent via `origin.clientSeq`.
- Added synthetic coverage for reconnect replay, reconnect snapshots, malformed reconnect entries, client intent non-mutation, acceptance linking, and root/session/terminal intent resource inference.

## Validation

```bash
pnpm test -- packages/core/src/replay.test.ts
pnpm test
pnpm typecheck
pnpm lint
```

## Deviations from Plan

None remaining.

## Issues Encountered

None remaining.

## Next Phase Readiness

Phase 8 can integrate this pure replay engine with server/AppState state-at-index APIs and caching.

---
*Phase: 07-deterministic-replay-engine*
*Completed: 2026-05-08*
