# Technology Stack: v1.1 Reducer-Backed State Snapshots

**Researched:** 2026-05-08

## Recommendation

Add a private generated workspace package for AHP protocol code and build reducer replay as a server-side derived index.

The sibling `../agent-host-protocol` repo is the source of truth, but a live `file:` dependency is not enough for reducer work because pnpm snapshots file dependencies into its store. Mirror VS Code's approach from `scripts/sync-agent-host-protocol.ts`: copy selected protocol files into this repo, record the source commit, and treat generated files as deterministic project inputs.

## Stack Changes

| Area | Change | Rationale |
|------|--------|-----------|
| Protocol code | Add `packages/protocol` generated from `../agent-host-protocol/types` | Stable imports, tracked source commit, no stale pnpm file dependency surprises |
| Sync tooling | Add `scripts/sync-agent-host-protocol.ts` adapted from VS Code | Copies `state.ts`, `actions.ts`, `action-origin.generated.ts`, `reducers.ts`, messages/commands/notifications, and version registry |
| Replay engine | Add pure replay code in core or a focused `state-replay` package | Keeps reducer execution out of parser and UI; enables unit tests and server caching |
| Server API | Add lazy state endpoints beside detail/search routes | Avoids pushing large state blobs through timeline SSE |
| UI | Reuse detail tabs, Pretty/Raw JSON viewer, tokens, drawer layout | Fits existing mental model and theme system |

## Protocol Files to Sync

- `state.ts`
- `actions.ts`
- `action-origin.generated.ts`
- `reducers.ts`
- `commands.ts`
- `notifications.ts`
- `messages.ts`
- `errors.ts`
- `version/registry.ts`

Write `.ahp-version` with the source commit hash. Generated files should carry a clear "do not edit" banner.

## What Not to Add

- No outbound services or AI explanation features.
- No UI-side reducer replay for large logs.
- No hand-rolled reducer types or partial protocol clones.
- No mutation based solely on client `dispatchAction` intent unless the server later echoes an accepted action envelope.
