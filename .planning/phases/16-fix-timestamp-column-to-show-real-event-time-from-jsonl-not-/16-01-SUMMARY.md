---
phase: 16-fix-timestamp-column-to-show-real-event-time-from-jsonl-not-
plan: 01
subsystem: server
tags: [timestamp, ahp-log, wire-time, ingest, parser]

requires:
  - phase: 02-timeline-ui
    provides: row projection that consumes NormalizeMeta.ts via formatTs
provides:
  - extractWireMeta parser helper for the AHP _ahpLog sidecar
  - app-state ingest loop now uses wire ts + dir from _ahpLog when present
affects: [extension, ui, replay, search]

tech-stack:
  added: []
  patterns:
    - "Sidecar metadata extraction at the parser boundary, ingest layer chooses wire-vs-fallback"

key-files:
  created:
    - packages/parser/src/wire-meta.ts
    - packages/parser/src/wire-meta.test.ts
  modified:
    - packages/parser/src/index.ts
    - packages/server/src/app-state.ts
    - packages/server/src/app-state.test.ts

key-decisions:
  - "Wire ts + dir live in a separate helper (extractWireMeta) so the ingest loop stays a single readable block — keeps the parser package the source of truth for AHP envelope shape."
  - "Wire dir wins over the directionInference callback when present; the callback is purely a fallback for legacy / fixture files with no _ahpLog."
  - "Malformed _ahpLog.ts (unparseable string) silently falls back to ingest time — never throws — so a bad sidecar can't poison the whole log."

patterns-established:
  - "Per-line ingest: snapshot Date.now() once and use it for both ts and tsRaw fallback so wire-absent rows keep prior semantics."

requirements-completed: []

duration: ~10min
completed: 2026-05-11
---

# Phase 16: Fix timestamp column to show real event time from JSONL Summary

**Timeline timestamp column now reflects each event's `_ahpLog.ts` wire time instead of the server-side ingest time, fixing timestamps for any file opened after the fact.**

## Performance

- **Tasks:** 2 of 2 completed
- **Files created:** 2
- **Files modified:** 3

## Accomplishments
- Added `extractWireMeta(raw)` to `@ahp-inspector/parser`: returns `{ ts, tsRaw, dir }` from the `_ahpLog` sidecar or `null` when absent/malformed.
- Replaced the `const ts = Date.now()` line in the `AppState` ingest loop with a wire-first / ingest-fallback path that also honours `_ahpLog.dir` when valid.
- Covered the new behaviour with 7 parser unit tests (present / absent / malformed / direction variants) and 4 server ingest tests (wire honoured, wire dir wins, fallback to ingest time, malformed sidecar).

## Task Commits

1. **Task 1: Add `extractWireMeta` helper in the parser package** — `bd4f258` (feat)
2. **Task 2: Use `_ahpLog.ts` in the ingest loop, fall back to ingest time when absent** — `c3fa633` (fix)

## Files Created/Modified
- `packages/parser/src/wire-meta.ts` — new helper extracting `{ ts, tsRaw, dir }` from `_ahpLog`.
- `packages/parser/src/wire-meta.test.ts` — 7 cases covering present / absent / malformed / direction-variant inputs.
- `packages/parser/src/index.ts` — re-export `extractWireMeta` + `WireMeta` from the parser barrel.
- `packages/server/src/app-state.ts` — ingest loop reads wire meta first, falls back to `Date.now()` + `inferDir`.
- `packages/server/src/app-state.test.ts` — 4 new ingest cases under "AppState wire timestamp ingest (Phase 16)".

## Decisions Made
- Snapshot `Date.now()` once per line (`ingestNow`) and reuse it for both `ts` and `tsRaw` fallback. This preserves the prior single-`Date.now()`-per-line semantic so fixture-driven tests stay deterministic when callers stub `Date.now`.
- `parsed.error` rows skip `extractWireMeta` entirely — a parse error means we can't trust the payload for any sidecar field, so direction stays `c2s` and timestamps stay `Date.now()`-derived (unchanged from prior behaviour).

## Deviations from Plan
None — plan executed as written.

## Verification

- `node_modules/.bin/vitest run packages/parser/src/wire-meta.test.ts` — 7/7 pass.
- `node_modules/.bin/vitest run packages/server/src/app-state.test.ts` — 21/21 pass (including 4 new Phase 16 cases).
- `node_modules/.bin/vitest run` (full workspace) — 1116/1116 pass.
- `pnpm typecheck` — all 8 packages clean.
- `pnpm -F @ahp-inspector/ui build && pnpm -F @ahp-inspector/extension build` — both bundles build (UI 342 KB, extension 260 KB).

## Surprises / Gotchas
- Per-package `pnpm -F <pkg> test` exits 0 silently because individual package `package.json` files have no `test` script — workspace tests run via `vitest run` from the root. Used `node_modules/.bin/vitest run <path>` to scope runs without modifying any package.json.
- Saw a one-shot flake on `packages/parser/src/legacy.test.ts` (`ENOENT legacy.sample.log`) on the first full run; reproduced cleanly on the next run with all 1116 tests passing. The fixture exists on disk — looks like a worker CWD race in vitest 4.1.5, unrelated to this change.
