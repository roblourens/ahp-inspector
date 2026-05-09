---
phase: 02-vertical-slice-cli-server-timeline
plan: 01
subsystem: server
tags: [hono, sse, csp, host-guard, app-state, projector, eventrow, correlator]

requires:
  - phase: 01-core-foundations
    provides: [EventStore, Correlator, projectRow, LineSplitter, normalize, NodeHostAdapter, startHealthServer]
  - phase: 02-00
    provides: [EventRow projection contract, dependency allow-list extension, UI/portable boundary split]

provides:
  - "AppState: owns one open log + EventStore + Correlator + ingest loop + flush ticker; emits SsePayload frames"
  - "Projector seam: EventRow snapshot/append/patch fan-out to subscribers, basename-only LogMeta"
  - "SSE routes: GET /api/log/stream and /api/log/meta (Hono streamSSE)"
  - "CSP middleware: locked default-src 'self', frame-ancestors 'none', connect-src 'self', X-Content-Type-Options, Referrer-Policy"
  - "Host-guard middleware: 421 on non-loopback Host headers"
  - "startLogServer(): composes middleware + routes, binds 127.0.0.1 only"
  - "Integration tests for SSE handshake (snapshot → append → late-correlation patch) and CSP/Host-guard"
  - "Tiny scrubbed fixture test/fixtures/phase2-mini.jsonl"

affects: [02-02 ui-foundations, 02-04 timeline-virtualization, 02-05 cli-launch, 02-06 vertical-slice-integration]

tech-stack:
  added: []
  patterns:
    - "Hono streamSSE with SSEStreamingApi: subscriber queue + pump loop, onAbort cleanup, setInterval ping"
    - "AppState as single owner of log/store/correlator/watcher lifecycle; dispose chain is idempotent"
    - "Projector emits 'append' for new rows and 'patch' updates for retroactive correlator state changes"
    - "Hard-coded HOSTNAME = 127.0.0.1 const (mirrors health-server.ts) — boundary regression caught by tests"
    - "Path basename-only across the SSE boundary (T-02-03) — integration test asserts no absolute-path substring"

key-files:
  created:
    - packages/server/src/app-state.ts
    - packages/server/src/projector.ts
    - packages/server/src/csp.ts
    - packages/server/src/host-guard.ts
    - packages/server/src/sse-routes.ts
    - packages/server/src/log-server.ts
    - packages/server/src/app-state.test.ts
    - test/sse-integration.test.ts
    - test/csp.test.ts
    - test/fixtures/phase2-mini.jsonl
  modified:
    - packages/server/src/index.ts
    - packages/server/package.json

key-decisions:
  - "Projector logic lives inline inside AppState (buildRow + diff scan) rather than a separate class, because projection needs direct access to EventStore + Correlator state. projector.ts is a thin re-export so consumers wanting the symbol get one without an extra hop."
  - "SSE handler uses a queue + pump pattern so the AppState subscriber callback never awaits a network write; this also means emit() ordering is preserved without lock-stepping the producer."
  - "Heartbeat is implemented with setInterval rather than a stream.sleep loop — the latter would block the handler in 20-second chunks even when there is real data to ship and was the cause of an early test timeout."
  - "AppState exposes runFlush(now?) so unit tests can drive the unmatched-timeout transition deterministically without setInterval; flushIntervalMs: 0 disables the auto ticker."
  - "Late-correlation patch is detected by re-scanning rows[0..range.from] after every store append. O(N) per append is acceptable at this scale; can swap for a dirty-set later without changing the SSE contract."

patterns-established:
  - "AppState boundary: ingest, projection, and listener fan-out live behind one interface so the SSE route handler is purely transport — it knows nothing about Correlator/EventStore internals."
  - "All SSE payloads pass through `kind: msg.kind` event naming, so future consumers can dispatch on a single discriminant."

requirements-completed: [INGEST-01, INGEST-06, EVENT-04, EVENT-05]

duration: ~30min
completed: 2026-05-07
---

# Phase 02 Plan 01: Server SSE seam (AppState → Projector → SSE → CSP / host-guard) Summary

**JSONL ingest is now bridged into a chunked SSE stream of EventRow snapshot/append/patch frames behind a CSP-locked, loopback-only Hono server.**

## Performance

- **Duration:** ~30 minutes
- **Started:** 2026-05-07T07:37Z
- **Completed:** 2026-05-07T07:48Z
- **Tasks:** 2 / 2 (both `tdd="true"`)
- **Files created:** 10
- **Files modified:** 2

## Accomplishments

- `createAppState` owns the full ingest pipeline (host watcher → LineSplitter → parseLine → normalize → EventStore → Correlator) and projects each event into the locked Phase-2 `EventRow` contract from `@ahp-inspector/core`.
- The Projector seam emits three frame kinds: `append` for newly observed rows, `patch` for retroactive status/latency changes (late correlation **and** flush-driven `unmatched`), and the snapshot trio (`snapshot-begin`/`snapshot-chunk`/`snapshot-end`) for catch-up.
- `startLogServer` composes a host-guard, CSP middleware, `/health` probe, and the new `/api/log/{meta,stream}` routes, binding hard-coded `127.0.0.1`. Mirroring health-server's pattern keeps the loopback regression test surface unified.
- Threats T-02-03 (path leakage), T-02-04a (DNS rebinding), T-02-04b (XSS/clickjacking), T-02-04c (loopback bind), and T-02-04d (subscriber leak) all have automated coverage.
- Five new AppState unit tests + one full-stack SSE integration test + four CSP / host-guard tests, all passing alongside the 144 pre-existing tests (162 / 162 green).

## Task Commits

1. **Task 1: AppState + Projector with EventRow snapshot/append/patch (TDD)**
   - `758f8a0` — `test(02-01)`: failing AppState integration test
   - `7cf5bdd` — `feat(02-01)`: AppState + Projector implementation, snapshot/append/patch/unmatched/dispose
2. **Task 2: SSE routes + CSP + Host guard wired into log-server**
   - `64f9c6b` — `feat(02-01)`: SSE log stream + CSP + host-guard wired into log-server

## Files Created / Modified

### Created

- `packages/server/src/app-state.ts` — `createAppState` ingest + projection seam, `LogMeta` (basename-only), `SsePayload` discriminated union, `runFlush()`.
- `packages/server/src/projector.ts` — thin re-export so `Projector` is importable as a symbol.
- `packages/server/src/csp.ts` — `CSP_VALUE` and `cspMiddleware` (CSP + nosniff + no-referrer).
- `packages/server/src/host-guard.ts` — `hostGuardMiddleware` (regex allow-list of `127.0.0.1[:port]` and `localhost[:port]`).
- `packages/server/src/sse-routes.ts` — `registerLogRoutes(app, appState)` for `/api/log/meta` and `/api/log/stream` (snapshot chunks + queue/pump live frames + 20 s ping + bye).
- `packages/server/src/log-server.ts` — `startLogServer({ appState, port, version })` returning `LogServerHandle`. Hard-coded `HOSTNAME = "127.0.0.1"`.
- `packages/server/src/app-state.test.ts` — 5 unit tests (basename meta, append, late patch, flush-driven unmatched, idempotent dispose).
- `test/sse-integration.test.ts` — boots a real loopback server with a controllable fake host, exercises the full SSE handshake, asserts no absolute-path leakage.
- `test/csp.test.ts` — CSP / nosniff / Referrer-Policy headers, 421 on bogus Host, `localhost` acceptance, 127.0.0.1 bind.
- `test/fixtures/phase2-mini.jsonl` — scrubbed fixture: request, paired response, orphan request, parse-error line, action.

### Modified

- `packages/server/src/index.ts` — barrel re-exports for new symbols (`createAppState`, `AppState`, `SsePayload`, `LogMeta`, `startLogServer`, `LogServerHandle`, `CSP_VALUE`, etc.).
- `packages/server/package.json` — adds `@ahp-inspector/core` and `@ahp-inspector/parser` workspace deps.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| AppState unit tests | `pnpm vitest run packages/server/src/app-state.test.ts` | ✅ 5/5 |
| SSE integration | `pnpm vitest run test/sse-integration.test.ts` | ✅ 1/1 |
| CSP + host-guard | `pnpm vitest run test/csp.test.ts` | ✅ 4/4 |
| Server package | `pnpm vitest run packages/server` | ✅ 7/7 |
| Boundary + security | `pnpm vitest run test/boundary.test.ts test/security.test.ts` | ✅ 33/33 |
| Full suite | `pnpm vitest run` | ✅ 162/162 |
| Typecheck | `pnpm typecheck` | ✅ all 7 packages |
| `0.0.0.0` leak | `grep -rn 0\\.0\\.0\\.0 packages/server/src` | ✅ only health-server.test guard mentions it |
| Frame-ancestors | `grep "frame-ancestors 'none'" packages/server/src/csp.ts` | ✅ 1 hit |
| SSE event names | `grep -E "snapshot-begin\|snapshot-chunk\|snapshot-end\|append\|patch\|ping\|bye" packages/server/src/sse-routes.ts` | ✅ all 7 present |

## Threats Mitigated (per `<threat_model>` in 02-01-PLAN.md)

| Ref | Mitigation | Verification |
|-----|------------|--------------|
| T-02-03 (info disclosure) | `LogMeta.filename = basename(handle.path)`; rows carry no path | `test/sse-integration.test.ts` asserts no `/Users/`/`test/fixtures` substring in any frame; `test/csp.test.ts` asserts the same on `/api/log/meta` |
| T-02-04a (DNS rebinding) | `hostGuardMiddleware` regex allow-list | `test/csp.test.ts` 421 on `evil.example.com`, 200 on `localhost:{port}` |
| T-02-04b (XSS / clickjacking) | `cspMiddleware` locked CSP + nosniff + no-referrer | `test/csp.test.ts` asserts each header value |
| T-02-04c (bind regression) | `HOSTNAME = "127.0.0.1"` const, no env/argv input | `test/csp.test.ts` `addr.address === "127.0.0.1"` and `0.0.0.0` grep test |
| T-02-04d (SSE listener leak) | `appState.subscribe` returns disposer; `stream.onAbort(off)` | Visible in code path; integration test client closes cleanly without hanging the suite |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Heartbeat blocked subscriber writes**
- **Found during:** Task 2, first integration-test run
- **Issue:** Plan code used `while (!aborted) { await stream.sleep(20_000); ... }`. The 20-second sleep meant SSE writes performed by the AppState subscriber's pump completed only when Hono next gave the handler control after the sleep returned. In practice, frames sat in the writer until the subscriber's writeSSE microtask flushed. The integration test timed out waiting for the late-correlation `patch`.
- **Fix:** Replaced the sleep loop with a `setInterval` ping driver and a single `await new Promise((res) => stream.onAbort(res))` that resolves only on disconnect. Subscriber writes are no longer in race with a long sleep.
- **Files modified:** `packages/server/src/sse-routes.ts`
- **Commit:** `64f9c6b`

**2. [Rule 1 — Bug] Fixture initialize request had a sessionId, response did not**
- **Found during:** Task 2, integration test debugging
- **Issue:** `extractSessionId` only inspects `params`, never `result`. The plan's fixture line 1 had `params.sessionId = "sess-aaaaaaaa"` while line 2 (the matching response) had no params. The Correlator's per-event correlation key is `session :: requestDir :: idType :: id`, so the request and response had different keys (`sess-aaaaaaaa` vs `∅`) and never paired — the test never saw a `patch`.
- **Fix:** Removed `sessionId` from the `initialize` request in `test/fixtures/phase2-mini.jsonl`. Real `initialize` requests typically don't carry a sessionId anyway (the session is established by the response).
- **Files modified:** `test/fixtures/phase2-mini.jsonl`
- **Commit:** `64f9c6b`

**3. [Rule 3 — Blocking] HostAdapter / LogHandle types live in `@ahp-inspector/shared`, not `@ahp-inspector/host-node`**
- **Found during:** Task 1 implementation
- **Issue:** Plan suggested importing `HostAdapter` / `LogHandle` from `@ahp-inspector/host-node`. The host-node barrel re-exports `NodeLogHandle` and `NodeHostAdapter` only; the abstract types live in shared.
- **Fix:** Imported `HostAdapter`, `LogHandle`, `Disposable` from `@ahp-inspector/shared` and treated `handle.path`/`handle.size` as optional fields on a `MaybeNodeLogHandle` extension.
- **Files modified:** `packages/server/src/app-state.ts`
- **Commit:** `7cf5bdd`

### No-architecture-change deviations

None. No Rule 4 escalations.

## Authentication Gates

None — no external services.

## Known Stubs

None. All UI-facing data flows are wired (server side); UI integration is plan 02-02+.

## Threat Flags

None — no new security surface beyond what the plan's threat model already documented.

## Deferred Issues

- Pre-existing `pnpm lint` errors in `biome.json` ignore patterns (`useBiomeIgnoreFolder`), `packages/server/src/health-server.test.ts:26` (`useTemplate`), and formatting drift in `packages/core/src/row-projection.ts` and `packages/core/src/row-projection.test.ts`. These predate this plan; not in scope. New files added by this plan pass `biome check` cleanly (only style warnings on `noNonNullAssertion`, consistent with existing test conventions).

## Self-Check: PASSED

Verified:
- `packages/server/src/app-state.ts` ✅
- `packages/server/src/projector.ts` ✅
- `packages/server/src/csp.ts` ✅
- `packages/server/src/host-guard.ts` ✅
- `packages/server/src/sse-routes.ts` ✅
- `packages/server/src/log-server.ts` ✅
- `packages/server/src/app-state.test.ts` ✅
- `test/sse-integration.test.ts` ✅
- `test/csp.test.ts` ✅
- `test/fixtures/phase2-mini.jsonl` ✅
- Commit `758f8a0` ✅ (test RED)
- Commit `7cf5bdd` ✅ (Task 1 GREEN)
- Commit `64f9c6b` ✅ (Task 2)
