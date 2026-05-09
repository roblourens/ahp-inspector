---
phase: 07-deterministic-replay-engine
validation_for:
  - 07-01-PLAN.md
  - 07-02-PLAN.md
  - 07-03-PLAN.md
nyquist_compliant: true
quick_run: pnpm test -- packages/core/src/replay.test.ts
full_suite: pnpm test && pnpm typecheck && pnpm lint
---

# Phase 7 Validation: Deterministic Replay Engine

## Scope Guard

Phase 7 is pure `@ahp-inspector/core` package logic only.

Allowed implementation files:

- `packages/core/package.json`
- `packages/core/src/index.ts`
- `packages/core/src/replay.ts`
- `packages/core/src/replay.test.ts`

Explicitly out of scope:

- server routes
- `AppState` cache integration
- `/api/state-at`
- UI components
- screenshots
- Playwright
- user guide updates
- real log fixtures

## Wave 0 Requirements

Before executing any Phase 7 task, the executor must confirm:

| Requirement | Required State |
|---|---|
| Phase 6 dependency | `@ahp-inspector/protocol` package exists and Phase 6 verification passed |
| Protocol imports | Core replay code imports canonical names directly from `@ahp-inspector/protocol`, not `@ahp-inspector/shared/ahp` compatibility aliases |
| Test fixture policy | `packages/core/src/replay.test.ts` uses synthetic in-test `AhpEvent[]` helpers, not real logs |
| File scope | No files outside the four allowed implementation files are modified |
| Commands | Verification commands are root-relative |

## Quick Run

```bash
pnpm test -- packages/core/src/replay.test.ts
```

## Full Suite

```bash
pnpm test && pnpm typecheck && pnpm lint
```

## Per-Task Verification Table

| Plan | Task | Requirement Coverage | Automated Verification |
|---|---|---|---|
| 07-01 | Task 07-01-01: Add core protocol dependency, replay contracts, and exports | REPLAY-01, REPLAY-02, REPLAY-03 | `pnpm test -- packages/core/src/replay.test.ts` |
| 07-01 | Task 07-01-02: Install initialize/subscribe snapshots and diagnostics | REPLAY-01, REPLAY-02, REPLAY-03 | `pnpm test -- packages/core/src/replay.test.ts` |
| 07-01 | Task 07-01-03: Apply basic server action envelopes to correct reducers | REPLAY-01, REPLAY-02, REPLAY-03 | `pnpm test -- packages/core/src/replay.test.ts && pnpm typecheck` |
| 07-02 | Task 07-02-01: Patch Date.now synchronously around reducer calls | REPLAY-04 | `pnpm test -- packages/core/src/replay.test.ts` |
| 07-02 | Task 07-02-02: Capture reducer logs and prove replay stability | REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04 | `pnpm test -- packages/core/src/replay.test.ts` |
| 07-02 | Task 07-02-03: Diagnose serverSeq gaps, duplicates, and out-of-order envelopes | REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04 | `pnpm test -- packages/core/src/replay.test.ts && pnpm typecheck` |
| 07-03 | Task 07-03-01: Apply reconnect replay and snapshot responses | REPLAY-06 | `pnpm test -- packages/core/src/replay.test.ts` |
| 07-03 | Task 07-03-02: Capture client dispatchAction intent without mutating state | REPLAY-05 | `pnpm test -- packages/core/src/replay.test.ts` |
| 07-03 | Task 07-03-03: Run final Phase 7 validation and requirements coverage | REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04, REPLAY-05, REPLAY-06 | `pnpm test -- packages/core/src/replay.test.ts && pnpm test && pnpm typecheck && pnpm lint` |

## Final Acceptance Criteria

- Replaying the same synthetic log to the same target index returns stable state and diagnostics.
- Root actions use `rootReducer`.
- Session actions use `sessionReducer`.
- Terminal actions use `terminalReducer`.
- Reducer-derived timestamps use `AhpEvent.ts`, not wall-clock time.
- `Date.now` is always restored after replay, including malformed/reducer-log paths.
- Missing baselines, malformed raw payloads, unknown actions, parse errors, serverSeq gaps, duplicates, and out-of-order envelopes are diagnostics, not thrown crashes.
- Client `dispatchAction` intent is visible in replay output but does not mutate canonical reconstructed state.
- Reconnect replay embedded action envelopes apply in response array order.
- Reconnect snapshot responses replace/install baselines.
- No Phase 8-10 files or concepts are implemented.

## Final Validation Result

Passed on 2026-05-08:

```bash
pnpm test -- packages/core/src/replay.test.ts
pnpm test
pnpm typecheck
pnpm lint
```
