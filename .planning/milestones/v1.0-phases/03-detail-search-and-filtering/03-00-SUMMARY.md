---
phase: 03-detail-search-and-filtering
plan: "00"
subsystem: core/server/ui
tags: [foundation, eventrow, tokens, security, tdd]
dependency_graph:
  requires: []
  provides:
    - EventRowExtras interface in @ahp-inspector/core
    - EventRow Phase 3 fields (errorCode, serverSeq, gapBefore, isAuthFailure)
    - AppState.eventAt(idx) method
    - Phase 3 CSS design tokens in tokens.css
    - react-json-view-lite@2.5.0 in @ahp-inspector/ui
  affects:
    - packages/core/src/row-projection.ts
    - packages/server/src/app-state.ts
    - packages/ui/src/styles/tokens.css
    - test/security.test.ts
tech_stack:
  added:
    - react-json-view-lite@2.5.0
  patterns:
    - TDD (RED then GREEN)
    - additive EventRow extension (non-breaking)
    - per-session serverSeq gap detection via Map
    - extras parameter pattern for row projection
key_files:
  created:
    - test/fixtures/phase3-mini.jsonl
  modified:
    - packages/core/src/row-projection.ts
    - packages/core/src/index.ts
    - packages/core/src/row-projection.test.ts
    - packages/server/src/app-state.ts
    - packages/ui/src/styles/tokens.css
    - test/security.test.ts
    - packages/ui/src/components/timeline/EventRow.columns.test.tsx
    - packages/ui/src/components/timeline/EventRow.orphan.test.tsx
    - packages/ui/src/components/timeline/ParseErrorRow.test.tsx
    - packages/ui/src/components/timeline/TimelineList.virt.test.tsx
decisions:
  - "EventRowExtras uses optional parameter with DEFAULT_EXTRAS default — avoids breaking callers that don't need extras"
  - "gapBefore/isAuthFailure/errorCode computed in AppState.buildRow (server side) rather than projectRow (portable core) — respects boundary.test.ts Node import restrictions"
  - "lastSeenServerSeq tracks per-session gaps using sessionId as key (null key for events without session)"
  - "eventAt() added to AppState interface for Plan 03-01 detail API endpoint"
metrics:
  duration: "~15min"
  completed_date: "2026-05-07T17:54:09Z"
  tasks: 2
  files: 11
---

# Phase 03 Plan 00: Wave 0 Foundation (EventRow Extras + Tokens) Summary

**One-liner:** Extended EventRow with four Phase 3 additive fields (errorCode, serverSeq, gapBefore, isAuthFailure), added per-session gap detection in AppState.buildRow, added Phase 3 CSS design tokens, and installed react-json-view-lite@2.5.0 with security allow-list update.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install react-json-view-lite, update security allowlist, add Phase 3 tokens | d91b950 | packages/ui/package.json, test/security.test.ts, packages/ui/src/styles/tokens.css, test/fixtures/phase3-mini.jsonl, pnpm-lock.yaml |
| 2 (RED) | Failing Phase 3 test scaffold | 612a44a | packages/core/src/row-projection.test.ts |
| 2 (GREEN) | Extend EventRow + projectRow + AppState extras computation | ca34094 | packages/core/src/row-projection.ts, packages/core/src/index.ts, packages/server/src/app-state.ts, 4 UI test fixtures |

## Verification Results

```
pnpm test packages/core/src/        → 64 tests pass (including 8 new Phase 3 extras tests)
pnpm test packages/server/src/      → 7 tests pass
pnpm test test/security.test.ts     → 55 tests pass (react-json-view-lite in ALLOW)
pnpm test test/boundary.test.ts     → 42 tests pass (no forbidden imports)
pnpm -F @ahp-inspector/ui build        → builds successfully (tokens.css compiles)
pnpm typecheck                      → clean across all 7 workspace packages
pnpm test (full suite)              → 267 tests pass
grep eval/new Function in react-json-view-lite/dist/ → empty (safe)
```

## Success Criteria Check

- [x] `react-json-view-lite@2.5.0` in `packages/ui/package.json` dependencies
- [x] `test/security.test.ts` ALLOW set contains `"react-json-view-lite"`
- [x] `EventRow` interface has `errorCode`, `serverSeq`, `gapBefore`, `isAuthFailure` fields
- [x] `EventRowExtras` is exported from `packages/core/src/row-projection.ts`
- [x] `AppState` interface has `eventAt(idx: number): AhpEvent | null`
- [x] `tokens.css` has 14 new Phase 3 tokens (search-match: 2, chip: 6, group/gap/auth: 6) + 4 height tokens
- [x] `pnpm test` green (267/267); `pnpm typecheck` green; boundary test green

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated UI test fixtures missing new EventRow fields**

- **Found during:** Task 2 GREEN phase (typecheck after implementation)
- **Issue:** UI test files (`EventRow.columns.test.tsx`, `EventRow.orphan.test.tsx`, `ParseErrorRow.test.tsx`, `TimelineList.virt.test.tsx`) construct mock `EventRowData` objects without the 4 new Phase 3 fields — TypeScript correctly rejected these as incomplete
- **Fix:** Added `errorCode: null, serverSeq: null, gapBefore: false, isAuthFailure: false` to each mock object (safe additive defaults)
- **Files modified:** 4 UI test files
- **Commit:** ca34094 (included in Task 2 GREEN commit)

## Known Stubs

None — all four new EventRow fields are fully computed in `AppState.buildRow` and propagated to every projected row.

## Threat Flags

No new threat surface beyond the plan's threat model. The `react-json-view-lite` dist/ eval check returned empty as required (T-03-00-01 mitigated).

## Self-Check: PASSED

Files exist:
- packages/core/src/row-projection.ts ✓
- packages/server/src/app-state.ts ✓
- packages/ui/src/styles/tokens.css ✓
- test/security.test.ts ✓
- packages/core/src/row-projection.test.ts ✓
- test/fixtures/phase3-mini.jsonl ✓

Commits:
- d91b950 ✓
- 612a44a ✓
- ca34094 ✓
