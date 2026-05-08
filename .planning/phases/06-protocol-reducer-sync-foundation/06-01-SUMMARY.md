---
phase: 06-protocol-reducer-sync-foundation
plan: 01
subsystem: protocol
tags: [ahp, reducers, sync, generated-package, tsup]
requires:
  - phase: v1.1-roadmap
    provides: Phase 6 requirements and execution plan
provides:
  - Generated @ahp-viewer/protocol workspace package skeleton
  - Deterministic sync command for canonical AHP protocol sources
  - Synced reducer sources, protocol types, fixtures, and source metadata
affects: [phase-06, phase-07, protocol-replay, reducer-state]
tech-stack:
  added: [@ahp-viewer/protocol]
  patterns: [generated-protocol-package, sibling-repo-sync, source-commit-diagnostics]
key-files:
  created:
    - scripts/sync-agent-host-protocol.ts
    - packages/protocol/package.json
    - packages/protocol/tsconfig.json
    - packages/protocol/src/index.ts
    - packages/protocol/src/source-info.ts
    - packages/protocol/.ahp-version
    - packages/protocol/test-cases/reducers/*.json
  modified:
    - package.json
    - pnpm-lock.yaml
key-decisions:
  - "Protocol package TypeScript keeps repo module settings but relaxes exact optional/noUnchecked indexed checks for generated upstream reducer code."
  - "The sync script copies only a fixed whitelist of protocol files and reducer JSON fixtures from ../agent-host-protocol/types."
patterns-established:
  - "Generated protocol sources carry a DO NOT EDIT banner and are refreshed through pnpm sync:ahp."
  - "Source commit metadata is available both in packages/protocol/.ahp-version and packages/protocol/src/source-info.ts."
requirements-completed: [SYNC-01, SYNC-02]
duration: inline
completed: 2026-05-08
---

# Phase 6 Plan 01 Summary

**Generated AHP protocol workspace package with deterministic sibling-repo sync and source commit metadata**

## Performance

- **Tasks:** 3
- **Files modified:** 150 generated protocol/fixture files plus package and sync-script files

## Accomplishments

- Added root `pnpm sync:ahp` and `scripts/sync-agent-host-protocol.ts`.
- Created private workspace package `@ahp-viewer/protocol`.
- Synced canonical AHP protocol files, reducer fixtures, `.ahp-version`, and importable source metadata.
- Confirmed the generated package builds with `pnpm -F @ahp-viewer/protocol build`.

## Task Commits

Plan tasks are committed together in the plan completion commit for a coherent generated-source checkpoint.

## Files Created/Modified

- `scripts/sync-agent-host-protocol.ts` - deterministic whitelisted copy from sibling `../agent-host-protocol/types`.
- `packages/protocol/package.json` - generated protocol workspace package manifest and scripts.
- `packages/protocol/tsconfig.json` - generated package TypeScript configuration.
- `packages/protocol/src/index.ts` - barrel export for generated protocol modules and source metadata.
- `packages/protocol/src/source-info.ts` - generated upstream commit/source diagnostics.
- `packages/protocol/src/*.ts` - generated canonical AHP protocol sources.
- `packages/protocol/test-cases/reducers/*.json` - copied upstream synthetic reducer fixtures.
- `packages/protocol/.ahp-version` - synced upstream commit hash.
- `package.json` / `pnpm-lock.yaml` - root sync script and workspace lockfile updates.

## Decisions Made

- Kept generated source semantics untouched; package-level TS config relaxes `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` because upstream reducer code is not authored for those stricter project-local flags.
- Ran Biome format during sync so generated files comply with this repo's formatting without semantic rewrites.

## Deviations from Plan

### Auto-fixed Issues

**1. Generated reducer declarations failed under repo-local strict optional settings**
- **Found during:** Task 06-01-03
- **Issue:** `tsup --dts` failed on upstream reducer code with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- **Fix:** Added package-local TypeScript overrides for generated protocol code.
- **Files modified:** `packages/protocol/tsconfig.json`
- **Verification:** `pnpm sync:ahp && pnpm -F @ahp-viewer/protocol build`

## Issues Encountered

None remaining.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 06-02 can now migrate dependencies and imports to `@ahp-viewer/protocol`.

---
*Phase: 06-protocol-reducer-sync-foundation*
*Completed: 2026-05-08*
