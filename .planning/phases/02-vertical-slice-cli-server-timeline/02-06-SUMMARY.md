---
phase: 02-vertical-slice-cli-server-timeline
plan: 06
subsystem: ui
tags: [sse, eventsource, hono, static-ui, vite, vertical-slice, zustand]

# Dependency graph
requires:
  - phase: 02-01
    provides: SSE log-stream route + AppState payload contract
  - phase: 02-02
    provides: Zustand AppStore + AppShell chrome
  - phase: 02-04
    provides: TimelineRegion routing + ServerNotRunningState
  - phase: 02-05
    provides: ahp-viewer CLI with classifyDirection + 127.0.0.1 binding
provides:
  - "SSE client (`connectLogStream`) bridging server frames to AppStore"
  - "App.tsx that probes `/api/log/meta` and routes to ServerNotRunningState on failure"
  - "Static-UI middleware mounting `packages/ui/dist/` under existing CSP"
  - "CLI ↔ UI dist auto-discovery via `locateUiDist()`"
  - "Vertical-slice end-to-end test asserting Phase-2 SCs 1–5"
affects: [phase-03, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot rows buffered locally until snapshot-end → single setRows commit (avoids mid-snapshot flicker)"
    - "Graceful `bye` event closes EventSource without browser auto-reconnect storms"
    - "`window.__ahpStream` holds active ConnectionHandle so DisconnectedBanner reconnect can tear it down before reopening"
    - "Hono `serveStatic` mounted with absolute distDir so cwd does not affect resolution"

key-files:
  created:
    - packages/ui/src/transport/sse-client.ts
    - packages/ui/src/transport/sse-client.test.ts
    - packages/server/src/static-ui.ts
    - test/vertical-slice.test.ts
  modified:
    - packages/ui/src/App.tsx
    - packages/ui/src/App.test.tsx
    - packages/ui/src/components/timeline/TimelineRegion.tsx
    - packages/server/src/log-server.ts
    - packages/server/src/index.ts
    - packages/cli/src/index.ts

key-decisions:
  - "SSE client buffers snapshot chunks locally and commits once on snapshot-end; mid-snapshot store is empty by design (avoids virtualized rerender thrash on large baselines)."
  - "Graceful `bye` event flips connection to 'disconnected' and explicitly closes the EventSource; transient `onerror` keeps state at 'connecting' so the browser's built-in retry loop is not poisoned (T-02-06-02)."
  - "App.tsx probes `/api/log/meta` once on mount before opening the stream — separates 'no server' (HTTP probe failure) from 'disconnected' (SSE drop), matching ServerNotRunningState semantics from Plan 02-04."
  - "`registerStaticUi` mounts on absolute distDir; the existing `cspMiddleware` (registered with `app.use('*', …)`) automatically applies CSP/nosniff/no-referrer headers to static responses (T-02-06-03)."
  - "CLI uses a small `locateUiDist()` resolver instead of bundling the UI; if the bundle hasn't been built, the API still serves and a future packaging step can flip this to bundled assets."
  - "Vertical-slice test treats request/response correlation as collapsed-into-snapshot for the file-read flow (CLI ingests the entire fixture before SSE client connects) — the assertion is `status='ok'` on the snapshot row plus a non-null `latencyBand` rather than observing a separate `append`+`patch` cycle. The mid-flight append+patch path is already covered by `test/sse-integration.test.ts` (Plan 02-01) using a fake host."

patterns-established:
  - "EventSource bridge module: opens ES, registers per-event handlers that JSON.parse + delegate to a single store action, returns `{ close }`."
  - "Hand-rolled FakeEventSource for jsdom tests — synthesizes MessageEvents to drive each handler deterministically."
  - "Static-UI mount is a pure middleware registration; CSP + Host guard middleware are unchanged."

requirements-completed: [INGEST-01, INGEST-06, EVENT-04, EVENT-05, TIME-01, TIME-02, TIME-03, TIME-06]

# Metrics
duration: 14min
completed: 2026-05-07
---

# Phase 02 Plan 06: vertical-slice-cli-server-timeline Summary

**SSE client maps server snapshot/append/patch frames to the Zustand store, the log-server now serves the built UI bundle under CSP, and a CLI-driven end-to-end test asserts Phase-2 success criteria 1–5.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-05-07T15:27:13Z
- **Completed:** 2026-05-07T15:41:23Z
- **Tasks:** 2
- **Files modified:** 9 (3 created)

## Accomplishments

- `connectLogStream` covers every server SSE frame kind (snapshot-begin/chunk/end, append, patch, ping, bye) with one store mutation each; `bye` closes the EventSource and short-circuits the browser auto-reconnect loop (T-02-06-02).
- `App.tsx` now probes `/api/log/meta` on mount and routes to `ServerNotRunningState` on failure, then opens the SSE stream and stashes the handle on `window.__ahpStream` so `DisconnectedBanner`'s Retry button can tear down the prior connection cleanly.
- `registerStaticUi` mounts `packages/ui/dist/` at `/`, `/assets/*`, `/fonts/*`, and `/favicon.ico` under the same CSP, X-Content-Type-Options, and Referrer-Policy headers the API uses (T-02-06-03/04).
- `ahp-viewer` CLI auto-discovers the UI dist directory at runtime and forwards it to `startLogServer({ uiDistDir })`; missing bundle just disables the static mount instead of failing.
- New `test/vertical-slice.test.ts` boots the real CLI under `tsx`, captures the ephemeral port, exercises `/api/log/meta` + `/` + `/api/log/stream`, asserts the 11-column EventRow contract, the parse-error → `BAD` mapping, the correlator's `status='ok'` + `latencyBand`, and the post-shutdown 'no-server' surface.

## Task Commits

1. **Task 1: SSE client + UI wiring + server static-UI mount** — `bbf51d9` (feat)
2. **Task 2: Vertical-slice end-to-end test + final phase gate** — `6cb1360` (test)

_Plan metadata commit added separately by the executor._

## Files Created/Modified

- `packages/ui/src/transport/sse-client.ts` (new) — EventSource bridge driving the AppStore.
- `packages/ui/src/transport/sse-client.test.ts` (new) — FakeEventSource covers each frame kind + connection lifecycle.
- `packages/server/src/static-ui.ts` (new) — Hono `serveStatic` middleware for the UI bundle.
- `test/vertical-slice.test.ts` (new) — End-to-end Phase-2 gate test.
- `packages/ui/src/App.tsx` — Probe + connect effect, ServerNotRunningState routing.
- `packages/ui/src/App.test.tsx` — Stub `fetch` so the probe doesn't transition initial state in jsdom.
- `packages/ui/src/components/timeline/TimelineRegion.tsx` — `defaultReconnect` closes prior `window.__ahpStream` then reconnects.
- `packages/server/src/log-server.ts` — Optional `uiDistDir` option; calls `registerStaticUi` after `registerLogRoutes`.
- `packages/server/src/index.ts` — Re-exports `registerStaticUi`/`StaticUiOptions`.
- `packages/cli/src/index.ts` — `locateUiDist()` resolver + `uiDistDir` plumbed into `startLogServer`.

## Decisions Made

- Wired CLI to the static UI mount even though the plan's `files_modified` list omitted it; without it `fetch('/')` from the vertical-slice test (and any browser load) would 404 — Rule 3 (blocking) deviation.
- Defensive `if (!Ctor)` guard inside `connectLogStream` so a future host that lacks `EventSource` doesn't hard-crash the App tree.
- `App.tsx` cleanup uses `delete window.__ahpStream` (not `= undefined`) to satisfy `exactOptionalPropertyTypes`.
- Vertical-slice test uses an http-based SSE client identical in shape to `test/sse-integration.test.ts` rather than Node 22's global `EventSource` — same reason: deterministic close inside Vitest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Wired UI dist into the CLI**
- **Found during:** Task 1 (preparing for Task 2's `fetch('/')` assertion).
- **Issue:** Plan listed only `log-server.ts` and `static-ui.ts` as server-side changes, but the CLI still constructed `startLogServer` without `uiDistDir`. Without that, `/` returns 404 and Task 2's SC1 assertion would fail.
- **Fix:** Added `locateUiDist()` to `packages/cli/src/index.ts` and forwarded the absolute path to `startLogServer`.
- **Verification:** `test/vertical-slice.test.ts` SC1 hits `GET /` and gets a 200 with `<div id="root">`.
- **Committed in:** `bbf51d9`.

**2. [Rule 1 — Bug] App.test.tsx flapping under new probe effect**
- **Found during:** Task 1 (running `pnpm -F @ahp-viewer/ui test`).
- **Issue:** New `useEffect` in `App.tsx` calls `fetch('/api/log/meta')`. In jsdom, `fetch` rejects → effect flips connection to `'no-server'`, breaking the existing `App.test.tsx` smoke that expects the loading state.
- **Fix:** Stub `globalThis.fetch` with a never-resolving promise in `beforeEach`; `vi.unstubAllGlobals()` in `afterEach`.
- **Verification:** Both App tests pass (loading state + no-server routing).
- **Committed in:** `bbf51d9`.

---

**Total deviations:** 2 auto-fixed (1 blocking + 1 bug).
**Impact on plan:** Auto-fixes were both required to satisfy the plan's own acceptance criteria — SC1 needs the static UI served, and the Task 1 acceptance gate "`pnpm vitest run packages/ui` exits 0" requires App.test.tsx to keep passing. No scope creep; no architectural changes.

## Issues Encountered

- Initial executor run left lint debt from earlier Phase-2 plans. A follow-up gate-fix commit formats Phase-2 files, replaces non-null assertions in tests with explicit guards, and documents the ARIA grid div pattern for virtualized rows/cells.

## Self-Check: PASSED

- Files created exist:
  - `packages/ui/src/transport/sse-client.ts` ✅
  - `packages/ui/src/transport/sse-client.test.ts` ✅
  - `packages/server/src/static-ui.ts` ✅
  - `test/vertical-slice.test.ts` ✅
- Commits exist: `bbf51d9` ✅, `6cb1360` ✅.
- Full phase gate is green: `pnpm vitest run && pnpm -F @ahp-viewer/ui build && pnpm -F @ahp-viewer/cli build && pnpm typecheck && pnpm lint`.

## User Setup Required

None — the CLI auto-discovers the built UI bundle. To run the standalone app:

```bash
pnpm -F @ahp-viewer/ui build
pnpm exec ahp-viewer test/fixtures/phase2-mini.jsonl --port 5173
# or, against a large fixture:
node -e 'const fs=require("fs");let s="";for(let i=0;i<50000;i++){s+=JSON.stringify({jsonrpc:"2.0",id:i,method:"ping"})+"\n";s+=JSON.stringify({jsonrpc:"2.0",id:i,result:{}})+"\n";}fs.writeFileSync("test/fixtures/large.jsonl",s);'
pnpm exec ahp-viewer test/fixtures/large.jsonl --port 5173
```

Per `02-VALIDATION.md` Manual-Only Verifications, scrolling smoothness on a 50K-line fixture is a manual check.

## Next Phase Readiness

- Phase 2 vertical slice is complete: CLI → server → SSE → UI bundle handshake is end-to-end-tested.
- Phase 3 (filtering / search / detail rail) can build directly on `connectLogStream` and `useAppStore`; no transport refactor required.
- Phase 3 (filtering / search / detail rail) should preserve the token-only styling and ARIA grid conventions established here.

---
*Phase: 02-vertical-slice-cli-server-timeline*
*Completed: 2026-05-07*
