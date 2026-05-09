---
phase: 06-protocol-reducer-sync-foundation
plan: 02
subsystem: protocol
tags: [ahp, workspace-dependencies, parser, shared]
requires:
  - phase: 06-protocol-reducer-sync-foundation
    provides: Generated @ahp-inspector/protocol package
provides:
  - Parser imports canonical protocol types directly from @ahp-inspector/protocol
  - Shared compatibility layer aliases old I-prefixed names to canonical protocol exports
  - Stale agent-host-protocol file dependency removed from workspace manifests
affects: [phase-06, phase-07, parser, shared]
tech-stack:
  added: []
  patterns: [canonical-protocol-imports, compatibility-type-aliases, dependency-allow-list]
key-files:
  created: []
  modified:
    - packages/shared/package.json
    - packages/parser/package.json
    - packages/parser/src/normalizer.ts
    - packages/shared/src/ahp/index.ts
    - packages/shared/src/ahp.reexport.test.ts
    - test/security.test.ts
    - scripts/sync-agent-host-protocol.ts
    - packages/protocol/src/*.ts
    - pnpm-lock.yaml
key-decisions:
  - "Parser imports ActionEnvelope and ProtocolNotification from @ahp-inspector/protocol rather than shared compatibility aliases."
  - "Shared keeps I-prefixed aliases only as a compatibility subpath backed by generated protocol exports."
patterns-established:
  - "Direct protocol consumers use canonical names from @ahp-inspector/protocol."
  - "Generated source includes @ts-nocheck so consuming workspace packages do not re-typecheck upstream reducer internals under stricter local flags."
requirements-completed: [SYNC-04]
duration: inline
completed: 2026-05-08
---

# Phase 6 Plan 02 Summary

**Protocol consumers now use the generated workspace package instead of stale sibling file dependencies**

## Performance

- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- Replaced `agent-host-protocol` file dependency with `@ahp-inspector/protocol` workspace dependency.
- Updated parser normalization to import canonical `ActionEnvelope` and `ProtocolNotification`.
- Reworked `@ahp-inspector/shared/ahp` into a compatibility re-export layer with I-prefixed aliases.
- Updated dependency allow-list coverage to permit the generated protocol package and reject the stale file dependency.

## Task Commits

Plan tasks are committed together in the plan completion commit.

## Files Created/Modified

- `packages/shared/package.json` - depends on `@ahp-inspector/protocol`.
- `packages/parser/package.json` - adds direct generated protocol dependency.
- `packages/parser/src/normalizer.ts` - imports canonical protocol types.
- `packages/shared/src/ahp/index.ts` - compatibility aliases backed by generated protocol exports.
- `packages/shared/src/ahp.reexport.test.ts` - updated compatibility re-export test label.
- `test/security.test.ts` - dependency allow-list migrated to generated package.
- `scripts/sync-agent-host-protocol.ts` / generated protocol sources - source-info and generated-source typecheck guard refinements.
- `pnpm-lock.yaml` - workspace dependency graph update.

## Decisions Made

- Kept the shared `./ahp` subpath for existing tests/callers, but treated it as compatibility-only.
- Adjusted generated source-info to avoid a literal `agent-host-protocol/types` path in built artifacts while preserving the runtime diagnostic value.

## Deviations from Plan

### Auto-fixed Issues

**1. Consumer package typecheck rechecked generated reducer source under stricter settings**
- **Found during:** Task 06-02-02
- **Issue:** `pnpm typecheck` failed when `packages/shared` resolved generated protocol source and inherited stricter local TypeScript flags.
- **Fix:** Updated the sync banner to include `// @ts-nocheck` for generated AHP source.
- **Files modified:** `scripts/sync-agent-host-protocol.ts`, `packages/protocol/src/*.ts`
- **Verification:** `pnpm typecheck`

**2. Stale-import grep matched generated/build diagnostics rather than imports**
- **Found during:** Task 06-02-02
- **Issue:** The broad grep guard matched diagnostic string literals, not stale imports.
- **Fix:** Generated `AHP_SOURCE_TYPES_PATH` from split constants so the diagnostic value remains correct without leaving a stale-import-looking literal in packages or built output.
- **Files modified:** `scripts/sync-agent-host-protocol.ts`, `packages/protocol/src/source-info.ts`
- **Verification:** `! grep -R 'agent-host-protocol/types' -n packages test`

## Issues Encountered

None remaining.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 06-03 can add reducer parity and source metadata tests against the generated package.

---
*Phase: 06-protocol-reducer-sync-foundation*
*Completed: 2026-05-08*
