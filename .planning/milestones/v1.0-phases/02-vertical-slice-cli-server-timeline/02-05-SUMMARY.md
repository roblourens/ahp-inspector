---
phase: 02-vertical-slice-cli-server-timeline
plan: 05
subsystem: cli
tags: [cli, commander, open, json-rpc, direction-inference, integration-tests, vitest, spawn]

requires:
  - phase: 02-vertical-slice-cli-server-timeline
    provides: createAppState (Plan 02-01) accepts directionInference; startLogServer binds 127.0.0.1
  - phase: 02-vertical-slice-cli-server-timeline
    provides: open@^11.0.0 dependency allow-listed (Plan 02-00)
provides:
  - classifyDirection(raw) helper inferring c2s/s2c structurally from JSON-RPC envelope
  - ahp-inspector CLI Phase-2 entry — validates file/port, builds AppState, starts log-server, prints UI-SPEC §10 copy, opens loopback URL, disposes on signals
  - cli-launch.test.ts + cli-errors.test.ts — spawn-based integration tests covering the success path and four error paths (port-in-use gated)
  - test/fixtures/cli-mini.jsonl — 3-line JSONL exercising classifyDirection across request/response/action
affects: [02-06]

tech-stack:
  added: [open@^11.0.0]
  patterns:
    - "JSON-RPC structural direction inference (client-side log assumption) injected into AppState via directionInference"
    - "tsx-based CLI integration tests (no dist dependency); spawn → assert stdout/stderr → kill via SIGTERM"

key-files:
  created:
    - packages/cli/src/direction.ts
    - packages/cli/src/direction.test.ts
    - packages/cli/src/cli-launch.test.ts
    - packages/cli/src/cli-errors.test.ts
    - packages/cli/src/cli-test-helpers.ts
    - test/fixtures/cli-mini.jsonl
  modified:
    - packages/cli/src/index.ts
    - packages/cli/package.json
    - pnpm-lock.yaml
  deleted:
    - packages/cli/src/cli.smoke.test.ts

key-decisions:
  - "classifyDirection assumes client-side capture: requests w/ method+id → c2s; result/error responses → s2c; method 'action' or 'notification' → s2c (server-originated). A future flag will inject an inverted inference for server-side logs."
  - "Removed cli.smoke.test.ts (Phase-1 health-check) instead of porting it; cli-launch.test.ts is its strict superset and exercises the real Phase-2 launch path including UI-SPEC §10 copy."
  - "Tests spawn via tsx (already in devDependencies) rather than building dist first — faster feedback loop, fewer flake surfaces, mirrors existing repo pattern."
  - "Plan referenced LogServerHandle.sayGoodbye() but no such method exists in @ahp-inspector/server; shutdown calls appState.dispose() + serverHandle.close() only. Documented as deviation."

requirements-completed: [INGEST-01]

duration: 6min
completed: 2026-05-07
---

# Phase 02 Plan 05: CLI Launch Path Summary

**ahp-inspector Phase-2 CLI entrypoint — validates file/port, structurally infers JSON-RPC direction, starts the loopback log-server, prints UI-SPEC §10 copy, opens the default browser, and disposes cleanly on SIGINT/SIGTERM.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-07T15:19:14Z
- **Completed:** 2026-05-07T15:25:34Z
- **Tasks:** 2
- **Files created:** 6
- **Files modified:** 3
- **Files deleted:** 1

## Accomplishments

- `classifyDirection()` replaces the Phase-1 hard-coded `dir='c2s'` placeholder. Eight-case unit test covers requests, responses, errors, server-originated actions/notifications, client notifications, and defensive fallbacks.
- CLI rewrite: argument validation (`<file>` + `--port` + `--no-open`), explicit `parsePort` with `0..65535` range check, `EADDRINUSE` → port-in-use copy with `--port {n+1}` retry hint, ENOENT → "log file not found" + Usage line, EACCES/EPERM → "cannot read … Check file permissions.", `open(url, { wait: false })` against the server-constructed loopback URL only (T-02-05b), dual SIGINT/SIGTERM disposal.
- Two spawn-based integration test files (`cli-launch.test.ts` + `cli-errors.test.ts`) covering 7 cases total; `Case E` (port-in-use) is gated by `SKIP_PORT_IN_USE_TEST=1` for flaky CI.
- Verified loopback-only binding via `not.toMatch(/0\.0\.0\.0/)` and `not.toMatch(/localhost/)` on stdout.

## Task Commits

1. **Task 1: classifyDirection + Phase-2 CLI entry with browser open** — `a08ca7b` (feat) — TDD direction.test.ts → direction.ts → index.ts rewrite + open@^11 dep
2. **Task 2: CLI launch + error integration tests** — `e83a5f8` (test) — cli-test-helpers, cli-launch.test.ts, cli-errors.test.ts, cli-mini.jsonl fixture

## Files Created/Modified

- `packages/cli/src/direction.ts` — `classifyDirection(raw)` JSON-RPC structural inference (client-side log assumption)
- `packages/cli/src/direction.test.ts` — 8 cases covering every rule
- `packages/cli/src/index.ts` — rewrite: input validation, `createAppState({ directionInference })`, `startLogServer`, UI-SPEC §10 copy, `open()`, signal disposal
- `packages/cli/src/cli-launch.test.ts` — success-path: §10 copy ordering, loopback-only, SIGTERM exit
- `packages/cli/src/cli-errors.test.ts` — Cases A–E: missing file, non-existent file, invalid port (70000 / -5), port-in-use (gated)
- `packages/cli/src/cli-test-helpers.ts` — `spawnCli` / `spawnCliRaw` / `waitForLine` / `waitForExit` helpers (private to the test files)
- `test/fixtures/cli-mini.jsonl` — request, response, server action
- `packages/cli/package.json` — adds `open@^11.0.0`
- `pnpm-lock.yaml` — `open` install
- `packages/cli/src/cli.smoke.test.ts` — DELETED (superseded)

## Decisions Made

See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `LogServerHandle.sayGoodbye()` does not exist**
- **Found during:** Task 1 (CLI rewrite)
- **Issue:** Plan 02-05 action snippet calls `serverHandle.sayGoodbye()` inside `shutdown()`. The `@ahp-inspector/server` `LogServerHandle` interface (Plan 02-01) only exposes `url`, `port`, `server`, and `close()`; there is no `sayGoodbye` method anywhere in the server package, and adding one is out of scope for Plan 02-05.
- **Fix:** Removed the `sayGoodbye()` call from `shutdown()`. SSE 'bye' broadcasts on shutdown are an SSE-route concern (Plan 02-06's vertical slice will exercise the bye path through the EventSource client). The CLI now disposes via `appState.dispose()` then `serverHandle.close()` — both wrapped in try/catch as the plan prescribed.
- **Files modified:** `packages/cli/src/index.ts`
- **Verification:** `pnpm typecheck` passes; cli-launch.test.ts asserts clean exit on SIGTERM.
- **Committed in:** `a08ca7b` (Task 1)

**2. [Rule 1 - Bug] Plan referenced removed `--no-server` flag**
- **Found during:** Task 1
- **Issue:** Phase-1's `cli.smoke.test.ts` depended on `--no-server` mode. The Plan 02-05 rewrite removes that flag (always starts the server now).
- **Fix:** Plan §5 of Task 1 recommended replacing the smoke test or deleting it. Deleted it; `cli-launch.test.ts` (Task 2) is its strict superset.
- **Files modified:** N/A (deletion)
- **Committed in:** `a08ca7b`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). **Impact:** No scope creep — sayGoodbye removal is correctness (referencing nonexistent API would fail typecheck); smoke test deletion explicitly anticipated by the plan.

## Issues Encountered

None. All 15 CLI tests passed first run; full repo (`pnpm vitest run`) is 243/243 green.

## User Setup Required

None — CLI runs entirely on local loopback with no external services.

## Verification Results

- `pnpm vitest run packages/cli` → 15/15 pass (3 files)
- `pnpm vitest run` (full repo) → 243/243 pass (21 files)
- `pnpm typecheck` → all 7 packages green
- `pnpm -F @ahp-inspector/cli build` → tsup ESM + DTS clean
- `grep -rn "0\.0\.0\.0" packages/cli/src` → 0 hits
- `grep -nF 'dir: Direction = "c2s"' packages/cli/src/index.ts` → 0 hits (placeholder gone)

## Next Phase Readiness

- INGEST-01 closed end-to-end: a user can now run `ahp-inspector path/to/log.jsonl`, see the §10 copy, and have a loopback browser tab navigate to the log-server.
- Plan 02-06's vertical-slice integration test can spawn the CLI, hit `/api/log/stream` over SSE, and assert the timeline UI renders rows with structurally inferred directions.
- No outstanding blockers.

## Self-Check: PASSED

- FOUND: `packages/cli/src/direction.ts`
- FOUND: `packages/cli/src/direction.test.ts`
- FOUND: `packages/cli/src/cli-launch.test.ts`
- FOUND: `packages/cli/src/cli-errors.test.ts`
- FOUND: `packages/cli/src/cli-test-helpers.ts`
- FOUND: `test/fixtures/cli-mini.jsonl`
- FOUND commit: `a08ca7b` (Task 1)
- FOUND commit: `e83a5f8` (Task 2)

---
*Phase: 02-vertical-slice-cli-server-timeline*
*Completed: 2026-05-07*
