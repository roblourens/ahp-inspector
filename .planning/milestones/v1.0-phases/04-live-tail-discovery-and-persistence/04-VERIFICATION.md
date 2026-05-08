---
phase: 04-live-tail-discovery-and-persistence
verified: 2026-05-08T01:59:00Z
status: passed
score: 5/5 observable roadmap truths verified
verifier: gsd-verifier
---

# Phase 4: Live Tail, Discovery, and Persistence — Verification Report

**Phase Goal:** The viewer feels like a live tool — it finds VS Code logs on its own,
follows them as they grow, and remembers per-log context.

**Status:** passed

## Previous Gaps Re-checked

### Gap 1 — `logKey` propagation after open/snapshot

**Status:** closed

Evidence:

- `packages/ui/src/transport/sse-client.ts` parses `snapshot-begin.meta.logKey`
  and calls `store.setLogKey(...)`.
- `packages/ui/src/transport/sessions-client.ts` models and returns the server
  open response as `{ active: { logKey, meta } }`.
- `packages/ui/src/App.tsx` immediately calls `setLogKey(result.active.logKey)`
  after candidate/manual open.
- `packages/ui/src/components/shell/AppShell.tsx` does the same after switch-log
  candidate/path open and after watch-error reopen.
- Targeted UI tests passed for SSE, sessions-client, and AppShell wiring.

### Gap 2 — stale SSE stream handle / stale `bye` flipping new connection state

**Status:** closed

Evidence:

- `packages/ui/src/App.tsx` closes the previous `window.__ahpStream`, opens a
  fresh stream, and replaces the global handle after successful open.
- `packages/ui/src/components/shell/AppShell.tsx` has the same replacement logic
  for switch/retry/reopen flows.
- `packages/ui/src/transport/sse-client.ts` ignores `bye` and `error` after
  caller-initiated close via `closedByCaller`.
- `packages/ui/src/transport/sse-client.test.ts` verifies `handle.close()`
  prevents later `bye`/`error` from flipping connection state.
- `packages/ui/src/components/shell/AppShell.test.tsx` verifies switch-log closes
  the old handle, opens a new one, replaces `window.__ahpStream`, and sets the
  new `logKey`.

## Observable Truths

| # | Truth | Status | Evidence |
|---|---|---:|---|
| 1 | From the app, user can see auto-discovered likely VS Code / Copilot AHP log files and pick one to open. | Verified | Discovery walks platform VS Code roots, returns opaque IDs and safe labels, session discover/open routes are wired, no-log UI fetches candidates, and the vertical slice verifies discover/open. |
| 2 | User can manually open any log file when auto-discovery misses it. | Verified | Server accepts `{ path }`, client posts `{ path }`, App/AppShell wire manual open, and UI/server error handling avoids path echo. |
| 3 | The selected log is watched incrementally, so appended JSONL lines appear without reparsing the whole file. | Verified | TailReader reads append ranges by byte offset; AppState emits append SSE frames; the Phase 4 vertical slice verifies append behavior. |
| 4 | User can pause and resume live following without losing selection or scroll position. | Verified | Store buffers incoming rows while paused, `NewEventsPill` flushes them, TimelineRegion owns pause/Space-key behavior, and UAT screenshots cover paused/new-events states. |
| 5 | Search and filter state persists for the current log across reloads where appropriate. | Verified | Persistence stores per-log prefs under opaque `logKey`; `usePersistEffect` hydrates/saves by logKey; AppShell mounts the effect; logKey propagation is now wired from both open responses and SSE snapshots. |

**Score:** 5/5 truths verified.

## Required Artifacts

| Artifact | Status | Details |
|---|---:|---|
| `packages/host-node/src/discovery.ts` | Verified | Bounded VS Code log discovery with opaque IDs, confidence tiers, and no path leakage. |
| `packages/server/src/session-manager.ts` | Verified | Switchable active-log lifecycle; computes `logKey` from path + mtime; serializes opens. |
| `packages/server/src/session-routes.ts` | Verified | `/api/sessions/discover/open/close/active`; safe error responses. |
| `packages/host-node/src/tail-reader.ts` | Verified | Incremental append, shrink/rename reset, watch/read error channels, async dispose. |
| `packages/server/src/sse-routes.ts` | Verified | Snapshot + live SSE, `log-reset` on session change, no-active-log handling. |
| `packages/ui/src/transport/sse-client.ts` | Verified | Handles snapshot, append, patch, rotation, watch-error, log-reset, bye/error close semantics, and logKey propagation. |
| `packages/ui/src/transport/sessions-client.ts` | Verified | Fetches candidates, opens by `{ id }` or `{ path }`, returns active-session response. |
| `packages/ui/src/App.tsx` | Verified | Routes 204 meta to `NoActiveLogState`, opens selected/manual logs, starts/replaces stream. |
| `packages/ui/src/components/shell/AppShell.tsx` | Verified | Switch-log overlay, watch-error retry/reopen, stream handle replacement, persistence mount. |
| `packages/ui/src/state/store.ts` | Verified | Phase 4 store fields/actions, pause buffer, logKey, rotation/watch-error state. |
| `packages/ui/src/state/persistence.ts` | Verified | Per-log localStorage persistence with schema validation and LRU cap. |
| `packages/ui/src/persistence/persist-effect.ts` | Verified | Hydrates/persists per-log UI state keyed by logKey. |
| `test/phase4-vertical-slice.test.ts` | Verified | End-to-end Phase 4 workflow test present and passing. |
| `04-UAT.md` + `screenshots/phase4/*.png` | Verified | UAT index exists; 10 expected screenshots present. |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---:|
| Targeted gap-fix tests | `pnpm -F @ahp-viewer/ui test src/transport/sse-client.test.ts src/transport/sessions-client.test.ts src/components/shell/AppShell.test.tsx` | 3 files passed, 27 tests passed | Pass |
| Full final gate | `pnpm vitest run test/phase4-vertical-slice.test.ts && pnpm test && pnpm -F @ahp-viewer/ui build && pnpm -F @ahp-viewer/cli build && pnpm typecheck && pnpm lint` | Passed | Pass |
| UAT artifacts | `screenshots/phase4/*.png` | 10 expected PNGs present | Pass |
| USER_GUIDE Phase 4 docs | `USER_GUIDE.md` | Required Phase 4 headings and screenshots present | Pass |

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---:|---|
| INGEST-02 — discover likely VS Code / Copilot AHP logs and select one | Satisfied | Discovery implementation, session discover/open routes, App no-log picker, vertical slice discover/open test. |
| INGEST-03 — manually open a log file | Satisfied | Session route accepts `{ path }`, client posts `{ path }`, App/AppShell wire manual open, error code handling is safe. |
| INGEST-04 — watch selected log as new JSONL entries are appended without reparsing whole file | Satisfied | TailReader byte-offset append reads, AppState append SSE frames, vertical slice append test. |
| INGEST-05 — pause/resume live following without losing place | Satisfied | Store buffers while paused, NewEventsPill flushes, TimelineRegion keyboard/pill behavior, UAT screenshots. |
| SEARCH-05 — search/filter state persists for current log where appropriate | Satisfied | `logKey` propagation fixed; persistence module and `usePersistEffect` hydrate/save by logKey. |

## Human Verification

No outstanding human verification is required for this gate.

Reason: Phase 4 visual/UAT work was already captured and approved in `04-UAT.md`,
with 10 screenshots present under `screenshots/phase4/`. The UAT covers no-log
picker, no-candidates hint, manual-open errors, active rows, pause state,
new-events pill, switch-log panel, rotation banner, and watch-error banner.

## Gaps Summary

No gaps found. The two previously reported verifier gaps are closed:

1. `logKey` now propagates both from `snapshot-begin.meta.logKey` and immediately
   from successful session-open responses.
2. Stale SSE handles are replaced on open/switch/retry/reopen, and caller-closed
   streams ignore later `bye`/`error` events.

**Overall status: passed.**
