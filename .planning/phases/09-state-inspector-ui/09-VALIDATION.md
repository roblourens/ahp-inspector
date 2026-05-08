---
phase: 09-state-inspector-ui
validation_for:
  - 09-01-PLAN.md
  - 09-02-PLAN.md
  - 09-03-PLAN.md
nyquist_compliant: true
quick_run: pnpm test -- packages/ui/src/transport/state-client.test.ts packages/ui/src/components/detail/StateInspectorPanel.test.tsx packages/ui/src/components/detail/StateCopyMenu.test.tsx packages/ui/src/components/detail/CopyMenu.test.tsx test/boundary.test.ts
full_suite: pnpm test && pnpm typecheck && pnpm lint
---

# Phase 9 Validation: State Inspector UI

## Scope Guard

Phase 9 is UI integration for the already-complete Phase 8 state API.

Allowed implementation areas:

- Browser-only UI transport for `/api/state-at`
- Detail panel state inspector entry point
- Resource selector
- Summary, Pretty JSON, and Raw JSON state views
- Confidence, diagnostics, and copy actions
- UI tests, browser smoke notes, screenshots/docs for the new UI

Explicitly out of scope:

- Phase 10 pinning
- Before/after comparison
- Changed-path diff UI
- SSE row payload changes
- Server replay rewrites
- External network, telemetry, or AI explanation of state

## Browser Verification Standard

Use `pnpm start:fixture` for Phase 9 browser smoke checks, then open the local viewer URL printed by the CLI. Each plan summary should record whether dark/light/hacker screenshots were captured. If user-facing docs are not updated during Phase 9, explicitly note that full docs/screenshot refresh remains Phase 10 scope.

## Quick Run

```bash
pnpm test -- packages/ui/src/transport/state-client.test.ts packages/ui/src/components/detail/StateInspectorPanel.test.tsx packages/ui/src/components/detail/StateCopyMenu.test.tsx packages/ui/src/components/detail/CopyMenu.test.tsx test/boundary.test.ts
```

## Full Suite

```bash
pnpm test && pnpm typecheck && pnpm lint
```

## Per-Task Verification Table

| Plan | Task | Requirement Coverage | Automated Verification |
|---|---|---|---|
| 09-01 | Task 1: Add browser-only state-at transport | STATE-01 | `pnpm test -- packages/ui/src/transport/state-client.test.ts test/boundary.test.ts` |
| 09-01 | Task 2: Add StateInspectorPanel request flow | STATE-01 | `pnpm test -- packages/ui/src/components/detail/StateInspectorPanel.test.tsx packages/ui/src/components/detail/DetailPanel.test.tsx` |
| 09-01 | Task 3: Focused validation and browser notes | STATE-01 | `pnpm test -- packages/ui/src/transport/state-client.test.ts packages/ui/src/components/detail/StateInspectorPanel.test.tsx packages/ui/src/components/detail/DetailPanel.test.tsx test/boundary.test.ts && pnpm typecheck && pnpm lint` |
| 09-02 | Task 1: Add resource selector | STATE-02 | `pnpm test -- packages/ui/src/components/detail/StateInspectorPanel.test.tsx test/boundary.test.ts` |
| 09-02 | Task 2: Add Summary, Pretty JSON, Raw JSON views | STATE-03 | `pnpm test -- packages/ui/src/components/detail/StateInspectorPanel.test.tsx packages/ui/src/components/detail/PrettyJsonView.test.tsx` |
| 09-02 | Task 3: Theme-safe styling and browser notes | STATE-02, STATE-03 | `pnpm test -- packages/ui/src/components/detail/StateInspectorPanel.test.tsx test/boundary.test.ts && pnpm typecheck && pnpm lint` |
| 09-03 | Task 1: Confidence and diagnostics components | STATE-04 | `pnpm test -- packages/ui/src/components/detail/StateInspectorPanel.test.tsx test/boundary.test.ts` |
| 09-03 | Task 2: State copy menu | STATE-05 | `pnpm test -- packages/ui/src/components/detail/StateCopyMenu.test.tsx packages/ui/src/components/detail/CopyMenu.test.tsx packages/ui/src/components/detail/StateInspectorPanel.test.tsx` |
| 09-03 | Task 3: Full Phase 9 UI validation | STATE-04, STATE-05 | `pnpm test -- packages/ui/src/components/detail/StateInspectorPanel.test.tsx packages/ui/src/components/detail/StateCopyMenu.test.tsx packages/ui/src/components/detail/CopyMenu.test.tsx test/boundary.test.ts && pnpm typecheck && pnpm lint` |

## Final Acceptance Criteria

- A selected event detail view offers an explicit "State at this point" action.
- State metadata is fetched lazily with selected `idx` and active `logKey`.
- User can select reconstructed root/session/terminal resources and full state loads only for exact selected resource.
- User can inspect selected state in Summary, Pretty JSON, and Raw JSON views.
- Confidence and diagnostics are visible beside reconstructed state.
- Partial/unknown state cannot be mistaken for authoritative complete state.
- User can copy compact state JSON, pretty state JSON, and concise state summary.
- UI remains local-only and does not import server/Node modules.
- Dark, light, and hacker themes cover the new state UI.
