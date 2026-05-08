# Phase 06: Protocol reducer sync foundation - Research

**Researched:** 2026-05-08  
**Domain:** Generated TypeScript protocol package, deterministic sync tooling, AHP reducer parity  
**Confidence:** HIGH for codebase/upstream/VS Code precedent; MEDIUM for exact generated-package refinements until validated with Biome/tsup.

## Summary

Add `packages/protocol` as a generated private workspace package, add `pnpm sync:ahp`, copy canonical upstream protocol files plus reducer fixtures, write both `.ahp-version` and an importable generated source-info module, then migrate protocol imports away from the stale sibling `file:` dependency.

The VS Code precedent is `/Users/roblou/code/vscode/scripts/sync-agent-host-protocol.ts`. It copies selected files from sibling `../agent-host-protocol/types`, records the source commit in `.ahp-version`, adds a generated banner, and performs formatting transforms for the target repo. AHP Viewer should follow the same deterministic-copy model but keep transformations minimal to preserve reducer parity.

## Phase Requirements

| ID | Research support |
|----|------------------|
| SYNC-01 | Use a root `scripts/sync-agent-host-protocol.ts` that copies from `../agent-host-protocol/types` into `packages/protocol/src`. |
| SYNC-02 | Copy `state.ts`, `actions.ts`, `action-origin.generated.ts`, `reducers.ts`, `commands.ts`, `notifications.ts`, `messages.ts`, `errors.ts`, and `version/registry.ts`. |
| SYNC-03 | Generate `.ahp-version` and an importable `src/source-info.ts` with the source commit for diagnostics/tests. |
| SYNC-04 | Replace current protocol imports from the `agent-host-protocol` file dependency / `@ahp-viewer/shared/ahp` with `@ahp-viewer/protocol`. |
| VERIFY-01 | Copy/use upstream `types/test-cases/reducers/*.json` fixtures; upstream currently has root/session/terminal reducer coverage and mocks `Date.now()` to `9999`. |

## Generated Package Shape

Recommended package:

```text
packages/protocol/
  package.json
  tsconfig.json
  src/
    index.ts
    state.ts
    actions.ts
    action-origin.generated.ts
    reducers.ts
    commands.ts
    notifications.ts
    messages.ts
    errors.ts
    version/registry.ts
    source-info.ts
  test-cases/reducers/*.json
  .ahp-version
```

`package.json` should follow repo package conventions: private ESM package, `main`/`types` pointing to `src/index.ts`, `exports` for `.`, and scripts for `typecheck` and `build`. Add `@ahp-viewer/protocol` to workspace dependencies where reducer/types are consumed.

## Sync Script Guidance

- Resolve source as sibling `../agent-host-protocol/types` from repo root.
- Fail loudly if source files are missing.
- Copy exact protocol source content where possible; avoid semantic transforms.
- Add a clear generated banner.
- Preserve import specifiers among copied files.
- Generate `source-info.ts` from `git rev-parse --short HEAD` and `.ahp-version`.
- Copy reducer fixtures for parity tests.
- Add `sync:ahp` root script.
- Do not read, copy, or commit real log files.

## Import Migration

Current `packages/shared/package.json` depends on `agent-host-protocol` via `file:../../../agent-host-protocol`, and `packages/shared` exposes `./ahp`. Phase 6 should move canonical protocol consumption to `@ahp-viewer/protocol`. Keep compatibility exports only if needed for existing call sites, but avoid hiding the generated protocol package behind shared for new reducer work.

Check and update:

- `packages/shared/package.json`
- `packages/shared/src/ahp/index.ts`
- parser/shared/core imports of `ActionEnvelope`, `ActionType`, state/action types, and reducers
- boundary tests that restrict package imports

## Reducer Parity Strategy

Add Vitest coverage in the generated protocol package or a focused test package that:

1. Loads copied reducer fixture JSON files.
2. Converts fixture `null` values to `undefined` to match upstream reducer output.
3. Mocks `Date.now()` to `9999`.
4. Runs `rootReducer`, `sessionReducer`, and `terminalReducer`.
5. Verifies deep equality against expected fixture state.

This provides immediate proof that copied reducers behave like upstream.

## Verification Commands

- `pnpm sync:ahp`
- `pnpm test`
- `pnpm -F @ahp-viewer/protocol build`
- `pnpm typecheck`
- `pnpm lint`

## Likely Failure Modes

- Biome flags generated upstream formatting/imports. Prefer formatting during sync or narrowly excluding generated files if exact upstream format cannot pass.
- `const enum` or strict TS settings expose generated declaration issues. Validate with package build/typecheck before migrating consumers.
- pnpm lockfile changes from removing `agent-host-protocol` file dependency must be committed if dependency graph changes.
- Generated package may violate existing boundary tests if imported from UI directly; keep reducer execution server/core side and types-only UI imports intentional.

## Planning Notes

Phase 6 should be split into three plans:

1. Generated package and sync script.
2. Import/dependency migration.
3. Reducer parity fixtures and diagnostics verification.

## RESEARCH COMPLETE
