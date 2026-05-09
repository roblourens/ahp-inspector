---
phase: 04-live-tail-discovery-and-persistence
plan: 03
subsystem: server
tags: [server, sessions, sse, cli]
requirements: [INGEST-02, INGEST-03, INGEST-04, SEARCH-05]
dependency_graph:
  requires:
    - "04-00 (logKey field, computeLogKey)"
    - "04-01 (discovery + resolveCandidateId)"
    - "04-02 (TailReader WatchSink → AppState dispose path)"
  provides:
    - "LogSessionManager — switchable active-log lifecycle"
    - "/api/sessions/{discover,open,close,active} REST surface"
    - "log-reset SSE event on session change"
    - "204 / 409 contracts for /api/log/* when no active log"
  affects:
    - "Wave 3 UI plans build on /api/sessions/* and the no-active-log contract"
tech_stack:
  added: []
  patterns:
    - "Promise-chain serialization for open/close to prevent concurrent AppState construction"
    - "Listener fanout via sessions.onChange for cross-stream invalidation"
key_files:
  created:
    - packages/server/src/session-manager.ts
    - packages/server/src/session-manager.test.ts
    - packages/server/src/session-routes.ts
    - packages/server/src/session-routes.test.ts
  modified:
    - packages/server/src/app-state.ts
    - packages/server/src/log-server.ts
    - packages/server/src/sse-routes.ts
    - packages/server/src/detail-routes.ts
    - packages/server/src/search-routes.ts
    - packages/server/src/index.ts
    - packages/server/package.json
    - packages/server/src/detail-routes.test.ts
    - packages/server/src/search-routes.test.ts
    - packages/cli/src/index.ts
    - packages/cli/src/cli-errors.test.ts
    - test/csp.test.ts
    - test/sse-integration.test.ts
decisions:
  - "Serialize open/close via internal promise chain — never two concurrent AppState constructions"
  - "logKey derived from sha256(absPath, mtimeMs at open) — stable for the file's growth lifetime (D-16 Option A)"
  - "Error responses send {code, message:code} only — never echo user-typed paths (T-04-03-02)"
  - "log-reset payload is {} — UI re-fetches /api/sessions/active to learn new state (T-04-03-05)"
metrics:
  tasks_completed: 3
  tests_added: 14
  duration_minutes: 7
  completed_date: 2025-11-09
---

# Phase 04 Plan 03: Session Manager Wiring Summary

Lift `AppState` from a process-singleton to a switchable `LogSessionManager`; add `/api/sessions/{discover,open,close,active}` REST surface; refactor every `/api/log/*` route to read `sessions.current()` per request and return 204 / 409 cleanly when no log is active; make the CLI's file argument optional via a thin `sessions.open(path)` initializer.

## Commits

| Hash | Task | Description |
|------|------|-------------|
| `4cf9d83` | Task 1 | LogSessionManager + 8 vitest cases; AppStateOptions gains `initialMtimeMs` |
| `3684614` | Task 2 | Session routes + log-reset SSE; detail/search/csp/sse-integration migrated to fakeSessions wrapper |
| `dd761f3` | Task 3 | CLI no-file launch via createLogSessionManager + sessions.open(absPath) |

## What Changed

### `packages/server/src/session-manager.ts` (new)

`createLogSessionManager(opts)` returns an object exposing:

- `current(): ActiveSession | null` — initially `null`.
- `open({path} | {id})` — validates path length (≤ 4096), stats the file for `mtimeMs`, computes a stable `logKey`, disposes any prior `AppState` before swapping, and notifies `onChange` listeners. Throws `SessionOpenError` with one of `path-too-long | not-found | not-a-file | not-readable | bad-request`.
- `close()` — disposes the active `AppState` and emits `null` to listeners.
- `onChange(listener)` — subscribe/unsubscribe pair; listeners are called for every transition (open, switch, close).
- `dispose()` — idempotent; closes any active log + clears listeners.

Open/close are serialized via an internal promise chain — there is no path to two parallel `createAppState` calls (T-04-03-03).

### `/api/sessions/*` routes

- `GET /api/sessions/discover` → `{ candidates, truncated }` from `discoverVsCodeLogs()`.
- `POST /api/sessions/open` accepts `{path}` or `{id}`. Returns `{ active: { logKey, meta } }` on success. Errors are JSON `{code, message}` where `message === code` so the user-typed path is never echoed; bad JSON → 400 `bad-request` (T-04-03-07), unknown id/path → 404 `not-found`, oversize/unreadable → 400 (T-04-03-01/02).
- `POST /api/sessions/close` → `{ active: null }`.
- `GET /api/sessions/active` → `{ active: {logKey, meta} | null }`.

### `/api/log/*` refactor

All four registrars now take `LogSessionManager` and read `sessions.current()` per request:

- `GET /api/log/meta` → 204 No Content when no active log.
- `GET /api/log/stream` → 409 `{code:"no-active-log"}` when no active log. Otherwise: snapshot → live frames → on `sessions.onChange` emit `event: log-reset`, then `bye`, then close (T-04-03-05).
- `GET /api/log/event/:idx` and `GET /api/log/search` → 409 `{code:"no-active-log"}` when null.

`startLogServer` no longer takes `appState`. The single `LogServerOptions.sessions` is the entrypoint for all four registrars (`hostGuardMiddleware` + `cspMiddleware` are unchanged).

### CLI

- File argument is now optional. `if (file)` → validate + `await sessions.open({ path: absPath })`; otherwise launch with `sessions` empty.
- Banner copy diverges: file mode prints `Watching {absPath}`; no-file mode prints `(No log file selected — use the picker to discover or open a log.)`.
- SIGINT/SIGTERM disposes `sessions` (which disposes any active `AppState`) before closing the server.
- `--no-open --port 0` is now safe to run with no log file — used by the updated `cli-errors` Case A test.

## Verification

| Command | Result |
|---------|--------|
| `pnpm exec vitest run packages/server/` | 7 files, 48 tests pass |
| `pnpm exec vitest run packages/server/src/session-manager.test.ts` | 8/8 pass |
| `pnpm exec vitest run packages/server/src/session-routes.test.ts` | 6/6 pass |
| `pnpm exec vitest run` (full workspace) | 36 files, **452 tests** pass |
| `pnpm typecheck` | All 7 packages green |
| `pnpm -F @ahp-inspector/cli build` | tsup ESM + DTS green |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@ahp-inspector/host-node` missing from `packages/server` deps**
- **Found during:** Task 1 (running session-manager.test.ts)
- **Issue:** session-manager.test.ts imports `NodeHostAdapter` from `@ahp-inspector/host-node`; the server package didn't declare it.
- **Fix:** Added `"@ahp-inspector/host-node": "workspace:*"` to `packages/server/package.json` `devDependencies`. Production code in `session-manager.ts` only imports `host-node` types from `@ahp-inspector/shared`, so the runtime dependency footprint is unchanged.
- **Files modified:** `packages/server/package.json`, `pnpm-lock.yaml`
- **Commit:** `4cf9d83`

**2. [Rule 3 - Blocking] Pre-existing tests still passed `appState` to refactored APIs**
- **Found during:** Task 2 (running full server suite)
- **Issue:** `detail-routes.test.ts`, `search-routes.test.ts`, `test/csp.test.ts`, and `test/sse-integration.test.ts` constructed an `AppState` directly and passed it to `register*` / `startLogServer`. After the refactor those signatures take a `LogSessionManager`.
- **Fix:** Added a small `fakeSessions(appState)` helper in each test file that wraps a single `AppState` in a minimal `LogSessionManager` (current returns the active session; open/close/onChange/dispose are no-ops for these unit tests). No production behavior changed.
- **Files modified:** `packages/server/src/detail-routes.test.ts`, `packages/server/src/search-routes.test.ts`, `test/csp.test.ts`, `test/sse-integration.test.ts`
- **Commit:** `3684614`

**3. [Rule 1 - Test correctness] cli-errors Case A asserted the old hard-fail behavior**
- **Found during:** Task 3 (running full suite after CLI rewrite)
- **Issue:** `cli-errors.test.ts` Case A expected `ahp-inspector` (no args) to exit 1 with `Error: log file not found:` + `Usage: ahp-inspector <path-to-log.jsonl>`. Plan 04-03 D-01/D-08 explicitly removes that hard-fail; the CLI now launches into a no-active-log state.
- **Fix:** Rewrote Case A to spawn the CLI with `--no-open --port 0`, wait for the `AHP Inspector running at http://127.0.0.1:N` banner, then SIGTERM. Updated Case B's Usage regex from `<path-to-log.jsonl>` to `[path-to-log.jsonl]` to match the new commander argument descriptor.
- **Files modified:** `packages/cli/src/cli-errors.test.ts`
- **Commit:** `dd761f3`

## Threat Surface Scan

All new surface is mitigated by the threat register in the plan (T-04-03-01 … T-04-03-07). No additional threat flags introduced.

## Self-Check: PASSED

- ✅ `packages/server/src/session-manager.ts` exists
- ✅ `packages/server/src/session-manager.test.ts` exists (8 tests pass)
- ✅ `packages/server/src/session-routes.ts` exists
- ✅ `packages/server/src/session-routes.test.ts` exists (6 tests pass)
- ✅ `packages/server/src/log-server.ts` modified — `LogServerOptions.sessions: LogSessionManager`
- ✅ `packages/server/src/sse-routes.ts` modified — 204 / 409 / log-reset behavior
- ✅ `packages/server/src/detail-routes.ts` modified — 409 on no-active-log
- ✅ `packages/server/src/search-routes.ts` modified — 409 on no-active-log
- ✅ `packages/cli/src/index.ts` modified — optional file arg, sessions.open path
- ✅ Commit `4cf9d83` present in git log
- ✅ Commit `3684614` present in git log
- ✅ Commit `dd761f3` present in git log
- ✅ Worktree clean prior to summary commit (only the SUMMARY.md remains untracked)
