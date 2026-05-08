---
phase: 03-detail-search-and-filtering
plan: "01"
subsystem: server
tags: [api, search, detail, tdd, search-index, hono]
dependency_graph:
  requires:
    - AppState.eventAt(idx) from 03-00
    - AppState interface from packages/server/src/app-state.ts
  provides:
    - SearchIndex class in packages/server/src/search-index.ts
    - AppState.searchIndex readonly property
    - AppState.correlatorDataFor(idx) method
    - GET /api/log/event/:idx (registerDetailRoutes)
    - GET /api/log/search?q=... (registerSearchRoutes)
  affects:
    - packages/server/src/app-state.ts
    - packages/server/src/log-server.ts
tech_stack:
  added: []
  patterns:
    - TDD (RED then GREEN across two tasks)
    - Linear-scan substring search with server-side caps (no regex from user input)
    - AppState mock pattern for Hono route integration tests
key_files:
  created:
    - packages/server/src/search-index.ts
    - packages/server/src/detail-routes.ts
    - packages/server/src/search-routes.ts
    - packages/server/src/detail-routes.test.ts
    - packages/server/src/search-routes.test.ts
  modified:
    - packages/server/src/app-state.ts
    - packages/server/src/log-server.ts
decisions:
  - "SearchIndex.scan uses String.prototype.includes (no regex from user input) — mitigates T-03-01-01 ReDoS"
  - "Query hard-capped at 256 chars before scan; result count hard-capped at 5000 regardless of limit param — mitigates T-03-01-02"
  - "correlatorDataFor(idx) added to AppState interface instead of exposing correlator directly — keeps correlator private, keeps route handlers thin"
  - "SearchIndex appended inside store subscriber after rows update (i >= searchIdx.size guard) — stays in lock-step with EventStore without double-append risk"
  - "truncated flag uses early-break approach: stop scanning when limit hit, set truncated=true if more entries remain — accurate without full re-scan"
metrics:
  duration: "~6min"
  completed_date: "2026-05-07T18:08:00Z"
  tasks: 2
  files: 7
---

# Phase 03 Plan 01: Detail + Search Server Endpoints Summary

**One-liner:** Added SearchIndex haystack + GET /api/log/event/:idx detail endpoint + GET /api/log/search?q= substring search with 256-char/5000-result caps, registered in startLogServer behind existing CSP+host-guard middleware.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | SearchIndex + AppState haystack + failing search route tests | 5627757 | packages/server/src/search-index.ts, packages/server/src/app-state.ts, packages/server/src/search-routes.test.ts |
| 2 (GREEN) | Detail + search route handlers + log-server registration | 1781570 | packages/server/src/detail-routes.ts, packages/server/src/search-routes.ts, packages/server/src/log-server.ts, packages/server/src/detail-routes.test.ts + biome fixes |

## Verification Results

```
npx vitest run packages/server/src/  → 25 tests pass (7 existing + 10 search + 8 detail)
npx vitest run test/security.test.ts → 55 tests pass (allow-list unchanged)
pnpm typecheck                       → clean across all 7 workspace packages
pnpm lint                            → clean (pre-existing row-projection.test.ts format issue out of scope)
npx vitest run (full suite)          → 285 tests pass (267 baseline + 18 new)
```

## Success Criteria Check

- [x] `GET /api/log/event/:idx` returns `DetailResponse` with full `AhpEvent.raw` payload
- [x] `GET /api/log/event/999` returns 404 on a short fixture
- [x] `GET /api/log/search?q=` returns all indices (match-all)
- [x] Query length > 256 chars is silently truncated; result count never exceeds 5000
- [x] Both routes are registered in `startLogServer` after SSE routes
- [x] `pnpm -F @ahp-viewer/server test` all green (25 tests)
- [x] `pnpm typecheck` green

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AhpEvent mock objects in tests missing `toolCallId` and `parse` fields**

- **Found during:** Task 1, writing search-routes.test.ts
- **Issue:** `AhpEvent` interface has `toolCallId: string | null` and `parse: ParseStatus` fields not mentioned in the PLAN.md `<interfaces>` section snapshot; TypeScript rejected mock objects without them
- **Fix:** Added a `makeEvent()` factory that includes all required fields with sensible defaults; used it throughout both test files
- **Files modified:** packages/server/src/search-routes.test.ts, packages/server/src/detail-routes.test.ts
- **Commit:** 1781570

**2. [Rule 2 - Missing] `correlatorDataFor()` required by detail-routes but not yet on AppState**

- **Found during:** Task 2, implementing detail-routes.ts (plan called it out explicitly)
- **Issue:** Plan specified adding `correlatorDataFor(idx)` to `AppState` interface — this was in the plan but required care to add to both interface and impl
- **Fix:** Added `correlatorDataFor` to `AppState` interface and `createAppState` return object as specified
- **Files modified:** packages/server/src/app-state.ts
- **Commit:** 1781570

**3. [Rule 1 - Bug] Biome lint: `noNonNullAssertion` in SearchIndex.scan and test helper**

- **Found during:** Task 2, post-implementation lint run
- **Issue:** `this.#haystack[i]!.includes(q)` and `entries[i]!` triggered biome's `noNonNullAssertion` rule
- **Fix:** Replaced `!` with `?? ""` null coalescing in scan; added null guard `if (!e) continue` in test helper
- **Files modified:** packages/server/src/search-index.ts, packages/server/src/search-routes.test.ts
- **Commit:** 1781570

## Known Stubs

None — both endpoints are fully implemented. SearchIndex is populated in lock-step with EventStore. detail-routes and search-routes return real data from AppState.

## Threat Flags

No new threat surface beyond the plan's threat model (T-03-01-01 through T-03-01-05 all mitigated as specified).

## Self-Check: PASSED

Files exist:
- packages/server/src/search-index.ts ✓
- packages/server/src/detail-routes.ts ✓
- packages/server/src/search-routes.ts ✓
- packages/server/src/detail-routes.test.ts ✓
- packages/server/src/search-routes.test.ts ✓
- packages/server/src/app-state.ts ✓ (modified)
- packages/server/src/log-server.ts ✓ (modified)

Commits:
- 5627757 ✓
- 1781570 ✓
