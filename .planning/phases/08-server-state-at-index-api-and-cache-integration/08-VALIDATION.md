---
phase: 08-server-state-at-index-api-and-cache-integration
validation_for:
  - 08-01-PLAN.md
  - 08-02-PLAN.md
  - 08-03-PLAN.md
nyquist_compliant: true
quick_run: pnpm test -- packages/server/src/state-replay-index.test.ts packages/server/src/state-routes.test.ts packages/server/src/app-state.test.ts test/sse-integration.test.ts
full_suite: pnpm test && pnpm typecheck && pnpm lint
---

# Phase 8 Validation: Server State-at-Index API and Cache Integration

## Scope Guard

Phase 8 is server/AppState/API/cache integration only.

Allowed implementation areas:

- `packages/server/src/app-state.ts`
- `packages/server/src/state-replay-index.ts`
- `packages/server/src/state-routes.ts`
- `packages/server/src/log-server.ts`
- server tests and synthetic integration tests

Explicitly out of scope:

- UI components
- screenshots
- Playwright browser UAT
- user guide updates
- pinned comparison
- core reducer replay rewrites
- real log fixtures

## Wave 0 Requirements

Before executing any Phase 8 task, the executor must confirm:

| Requirement | Required State |
|---|---|
| Phase 7 dependency | `@ahp-inspector/core` exports `replayToIndex` and Phase 7 verification passed |
| Lazy state delivery | No state is added to `SsePayload`, `EventRow`, or timeline row projection |
| Test fixture policy | Use synthetic JSONL/in-test helpers, not real logs |
| Route boundary | Routes access replay through `AppState`, not a global cache |
| Commands | Verification commands are root-relative |

## Quick Run

```bash
pnpm test -- packages/server/src/state-replay-index.test.ts packages/server/src/state-routes.test.ts packages/server/src/app-state.test.ts test/sse-integration.test.ts
```

## Full Suite

```bash
pnpm test && pnpm typecheck && pnpm lint
```

## Per-Task Verification Table

| Plan | Task | Requirement Coverage | Automated Verification |
|---|---|---|---|
| 08-01 | Task 08-01-01: Add StateReplayIndex exact-index cache | CONF-01, CONF-02, CONF-03 | `pnpm test -- packages/server/src/state-replay-index.test.ts` |
| 08-01 | Task 08-01-02: Wire StateReplayIndex into AppState lifecycle | CONF-03 | `pnpm test -- packages/server/src/app-state.test.ts` |
| 08-01 | Task 08-01-03: Preserve lazy SSE payload boundary | CONF-03 | `pnpm test -- packages/server/src/app-state.test.ts && pnpm typecheck` |
| 08-02 | Task 08-02-01: Add state route validation and response contract | CONF-01, CONF-02 | `pnpm test -- packages/server/src/state-routes.test.ts` |
| 08-02 | Task 08-02-02: Mount `/api/state-at` and expose selected-resource state | CONF-01, CONF-02 | `pnpm test -- packages/server/src/state-routes.test.ts` |
| 08-02 | Task 08-02-03: Cover route diagnostics, intents, and cache metadata | CONF-01, CONF-02 | `pnpm test -- packages/server/src/state-routes.test.ts && pnpm typecheck` |
| 08-03 | Task 08-03-01: Add synthetic JSONL subscribe/action/reconnect integration coverage | VERIFY-02 | `pnpm test -- packages/server/src/app-state.test.ts packages/server/src/state-routes.test.ts` |
| 08-03 | Task 08-03-02: Cover cache lifecycle across append, log switch, pause/resume equivalent, and rotation | CONF-03, VERIFY-02 | `pnpm test -- packages/server/src/app-state.test.ts` |
| 08-03 | Task 08-03-03: Run final Phase 8 validation and scope checks | CONF-01, CONF-02, CONF-03, VERIFY-02 | `pnpm test && pnpm typecheck && pnpm lint` |

## Final Acceptance Criteria

- `/api/state-at` returns confidence as `complete`, `partial`, or `unknown`.
- `/api/state-at` returns replay diagnostics for missing baseline, sequence gaps, unknown actions, ignored client intent, and parse errors.
- State-at responses include resource metadata by default and full state only for a selected `resourceKind` + `resourceUri`.
- State replay cache is scoped to the active `AppState`, survives append for older exact indexes, and clears on rotation reset/dispose/log switch.
- Selected-index state fetches do not add reconstructed state to SSE row payloads.
- Synthetic integration tests cover subscribe/reconnect snapshots and action envelopes.
- No Phase 9-10 UI/comparison/browser-doc work is implemented.
