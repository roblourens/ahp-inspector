---
phase: 04-live-tail-discovery-and-persistence
plan: 00
subsystem: foundation
tags: [contracts, tdd, persistence, design-tokens, sse, watcher]
requires: [phase-2, phase-3]
provides:
  - logKey contract (D-16) — opaque per-log identifier
  - SsePayload variants: rotation, watch-error, log-reset (D-13/D-14)
  - WatchSink interface (D-11/D-12 forward declaration)
  - Connection literal "no-log" (D-21)
  - Phase 4 store slice (livePaused/pendingNewCount/followLatest/lastWatchError/logKey)
  - PerLogPrefs persistence (D-18) with LRU cap
  - Phase 4 dark-theme design tokens
affects:
  - packages/server/src/app-state.ts (LogMeta + SsePayload)
  - packages/ui/src/state/store.ts (additive Phase 4 slice)
tech-stack:
  added: []
  patterns:
    - "sha256 truncated to 128 bits for opaque identifiers (no path leaks)"
    - "LRU + version-tagged localStorage map keyed by opaque logKey"
    - "Forward-declared sink interface (WatchSink) so later waves implement against frozen surface"
key-files:
  created:
    - packages/server/src/log-key.ts
    - packages/server/src/log-key.test.ts
    - packages/ui/src/state/persistence.ts
    - packages/ui/src/state/persistence.test.ts
  modified:
    - packages/server/src/app-state.ts
    - packages/server/src/index.ts
    - packages/server/src/detail-routes.test.ts
    - packages/server/src/search-routes.test.ts
    - packages/host-node/src/tail-reader.ts
    - packages/host-node/src/index.ts
    - packages/ui/src/state/store.ts
    - packages/ui/src/styles/tokens.css
    - packages/ui/src/components/shell/StatusBar.tsx
decisions:
  - "logKey computed as sha256(absPath + \"\\0\" + Math.floor(initialMtimeMs)) sliced to 32 hex (D-16)"
  - "SsePayload extensions are additive only — no existing kind removed (D-13/D-14)"
  - "Connection 'no-log' literal added; StatusBar gets a placeholder branch so the type widening doesn't break build (Wave 1 will style it)"
  - "Persistence storage key 'ahp-log-prefs-v1' holds an LRU map keyed by logKey, capped at 50 entries; groupCollapsed capped at 1000 entries (T-04-00-03/05)"
metrics:
  duration: ~12 min
  tasks: 3
  files_changed: 13
  tests_added: 12
  completed: 2026-05-08
---

# Phase 4 Plan 00: Foundation Contracts Summary

Wave 0 freezes every contract Phase 4 depends on (logKey, SsePayload extensions, WatchSink, store slice, persistence module, design tokens) so Waves 1-3 can implement against a stable surface in parallel.

## Outcome

- `LogMeta.logKey: string` is now produced by every `createAppState`, derived from `sha256(absPath + initialMtimeMs)` truncated to 128 bits — non-reversible, stable across appends.
- `SsePayload` union gained `rotation`, `watch-error`, and `log-reset` variants without removing existing kinds.
- `Connection` type now accepts the `"no-log"` literal (D-21).
- The store exposes the additive Phase 4 slice (`livePaused`, `pendingNewCount`, `followLatest`, `lastWatchError`, `logKey`) plus `setLivePaused` / `clearPendingNewCount` / `setLastWatchError` / `setLogKey` / `resetForRotation` / `resetForLogSwitch`. `appendRows` increments `pendingNewCount` while paused (RESEARCH §Project Constraints — conditional spread for `exactOptionalPropertyTypes`).
- `WatchSink` is exported from `@ahp-viewer/host-node`; the existing `ChunkSink` alias remains for backwards-compat (Wave 1 adopts the rich sink).
- `loadPerLogPrefs` / `persistPerLogPrefs` / `clearPerLogPrefs` round-trip prefs against `localStorage["ahp-log-prefs-v1"]` with LRU cap (50) and `groupCollapsed` cap (1000); quota errors silently degrade.
- Phase 4 design tokens (candidate row, paused indicator, NewEventsPill, rotation banner, watch-error banner) added under `:root, [data-theme="dark"]` using `color-mix` over existing semantic tokens — zero raw `#hex` literals (Phase 2 hex-literal guard test still passes).

## Tasks Completed

| Task | Name                                                          | Commit  | Notes |
| ---- | ------------------------------------------------------------- | ------- | ----- |
| 1    | logKey contract + sha256 helper + SsePayload extensions       | 2d0736a | TDD; 5 tests passing |
| 2    | WatchSink + Connection no-log + store Phase 4 slice + tokens  | edb3834 | StatusBar branch added (Rule 3) |
| 3    | Per-log persistence module with LRU cap                       | 41f1c32 | TDD; 7 tests passing |
| —    | Apply biome formatting/import-sorting                         | 7be2136 | autofix only |

## Verification

- `pnpm exec vitest run packages/server/src/log-key.test.ts` → 5/5 passing.
- `pnpm exec vitest run packages/ui/src/state/persistence.test.ts` → 7/7 passing.
- `pnpm typecheck` — workspace-wide green.
- `pnpm test` — 423/423 passing (Phase 1-3 suites unaffected).
- `pnpm lint` — clean.
- `pnpm-lock.yaml` unchanged: no new runtime dependencies (RESEARCH §Project Constraints item 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing LogMeta literals missing new `logKey` field**
- **Found during:** Task 1 (`pnpm typecheck` post-edit)
- **Issue:** `detail-routes.test.ts` (×2) and `search-routes.test.ts` (×1) constructed `LogMeta` object literals that no longer satisfied the interface after the additive `logKey` field landed.
- **Fix:** Added `logKey: "0".repeat(32)` to each fixture literal (placeholder 32-hex value).
- **Files modified:** `packages/server/src/detail-routes.test.ts`, `packages/server/src/search-routes.test.ts`
- **Commit:** 2d0736a (rolled into the contract task itself)

**2. [Rule 3 - Blocking] StatusBar `visualFor` no longer exhaustive after Connection widened**
- **Found during:** Task 2 (`pnpm -F @ahp-viewer/ui typecheck`)
- **Issue:** Adding `"no-log"` to `Connection` made the existing switch statement non-exhaustive (TS2366 — function lacks ending return statement).
- **Fix:** Added a `case "no-log"` branch returning a subtle placeholder (`{ glyph: "○", dotColor: "var(--color-text-subtle)", label: "No log selected" }`) so the type widening compiles. Wave 1 will replace this with the proper UI per UI-SPEC.
- **Files modified:** `packages/ui/src/components/shell/StatusBar.tsx`
- **Commit:** edb3834

**3. [Rule 3 - Tooling] Biome formatting/import-sorting**
- **Found during:** Final `pnpm lint`
- **Issue:** Long Connection union, additive `LogMeta` literals, and persistence test imports tripped Biome's formatter and `organizeImports` rules.
- **Fix:** Ran `pnpm exec biome check --write .`. No semantic changes.
- **Files modified:** `packages/host-node/src/index.ts`, `packages/server/src/search-routes.test.ts`, `packages/ui/src/state/persistence.test.ts`, `packages/ui/src/state/store.ts`
- **Commit:** 7be2136

No architectural deviations (Rule 4) and no auth gates encountered.

## Threat Model — Implementation Notes

| Threat ID    | Mitigation Implemented |
| ------------ | ---------------------- |
| T-04-00-01   | `computeLogKey` uses sha256 truncated to 128 bits (`/^[0-9a-f]{32}$/` test). The path is fed through the hash, never carried in the output. |
| T-04-00-02   | `persistence.ts` only stores filter state, query string, grouping, integer `selectedIdx`, integer `detailWidth`, and booleans. `isValid` rejects unexpected types. No payload, no path, no log content. |
| T-04-00-03   | `v: 1` schema tag + `isValid` guard — corrupt or future-version entries return `null` from `loadPerLogPrefs`. |
| T-04-00-05   | LRU cap `MAX_ENTRIES=50`, `groupCollapsed` cap `MAX_GROUP_COLLAPSED=1000`, `try/catch` around `localStorage.setItem` (test asserts no-throw on QuotaExceeded). |

T-04-00-04 (store-tampering) and T-04-00-06 (CSS) remain `accept` per the threat register.

## Known Stubs

- `StatusBar` "no-log" branch is a minimal placeholder — Wave 1 styles the empty state per UI-SPEC. Tracked as a Wave-1 task, not a leak (the placeholder renders correct labels, just lacks the dedicated empty-state design).

## Self-Check: PASSED

- `packages/server/src/log-key.ts` — FOUND
- `packages/server/src/log-key.test.ts` — FOUND
- `packages/ui/src/state/persistence.ts` — FOUND
- `packages/ui/src/state/persistence.test.ts` — FOUND
- Commit `2d0736a` — FOUND
- Commit `edb3834` — FOUND
- Commit `41f1c32` — FOUND
- Commit `7be2136` — FOUND
- All acceptance-criteria greps return expected counts.
