---
quick_id: 260521-k2o
status: complete
completed: 2026-05-21
---

# Quick Task 260521-k2o Summary

Restored row loading for channel-shaped AHP action envelopes without letting tool-call summary projection throw through the EventStore subscriber guard.

## What Changed

- Confirmed `../agent-host-protocol` now routes action resources through `ActionEnvelope.channel`, synced the generated protocol package, and fixed the sync script to copy the new `common/` and `channels-*` source trees.
- Updated action envelope narrowing and replay targeting to read `channel`, while keeping local legacy notification barrel aliases available for existing Inspector compatibility code.
- Made tool-call delta/content summaries action-specific and tolerant of missing reshaped content fields, preserving useful row text instead of throwing.
- Added row projection and AppState ingest regressions covering the formerly crashing subscriber path.
- Updated replay fixtures/helpers to express session, terminal, and root routing through envelope/dispatch channels under the synced protocol contract.

## Verification

- `pnpm test -- packages/core/src/row-projection.test.ts packages/server/src/app-state.test.ts` - passed, 91 tests.
- `pnpm typecheck` - passed across protocol, shared, parser, core, UI, host-node, server, extension, and CLI packages.
- Editor diagnostics for the manually touched implementation/test files - no errors found.

## Deviations

- The existing protocol sync script copied new aggregator shims but not their referenced channel/common directories, which made verification impossible after syncing. It was updated and rerun as a blocking compatibility fix.
- The failed `--runInBand=false` Vitest retry was a rejected option and was superseded by the exact plan command above.

## Blockers

- None.