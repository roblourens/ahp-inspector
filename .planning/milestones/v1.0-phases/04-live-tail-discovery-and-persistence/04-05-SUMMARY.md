---
phase: 04-live-tail-discovery-and-persistence
plan: 05
subsystem: ui
tags: [sse, sessions, picker, banners, wiring]
requires: [04-00, 04-03, 04-04]
provides:
  - sessions-client browser HTTP module with SessionOpenError(code)
  - SSE rotation / watch-error / log-reset event handling
  - RotationBanner (auto-dismiss 5s) + WatchErrorBanner (mapped copy)
  - SwitchLogButton mounted in HeaderBar
  - AppShell wiring for picker overlay and watch-error banner
  - App.tsx 204-no-log routing → NoActiveLogState
affects:
  - packages/ui/src/state/store.ts (additive: rotationNotice, lastOpenRef + setters)
  - packages/ui/src/transport/sse-client.ts (additive event listeners)
  - packages/ui/src/components/shell/AppShell.tsx (additive mounts)
  - packages/ui/src/components/shell/HeaderBar.tsx (optional onSwitchLog prop)
  - packages/ui/src/App.tsx (no-log branch)
tech-stack:
  added: []
  patterns:
    - "Browser HTTP error type carries opaque server `code` only (no path / OS string)"
    - "SSE event listeners mutate Zustand store via getState() — same pattern as Plan 02-06"
    - "Banners render mapped display strings keyed off server `code`"
key-files:
  created:
    - packages/ui/src/transport/sessions-client.ts
    - packages/ui/src/transport/sessions-client.test.ts
    - packages/ui/src/components/banners/RotationBanner.tsx
    - packages/ui/src/components/banners/WatchErrorBanner.tsx
    - packages/ui/src/components/shell/SwitchLogButton.tsx
    - packages/ui/src/components/shell/AppShell.test.tsx
  modified:
    - packages/ui/src/state/store.ts
    - packages/ui/src/transport/sse-client.ts
    - packages/ui/src/components/shell/AppShell.tsx
    - packages/ui/src/components/shell/HeaderBar.tsx
    - packages/ui/src/App.tsx
decisions:
  - "WatchErrorBanner reads `lastWatchError.code` from existing store slice (Plan 04-00) rather than introducing a parallel `watchError` field; the server contract is `{code: 'read-error'|'watch-fatal', message}` matching `setLastWatchError` exactly (D-12)."
  - "Added `lastOpenRef: {kind:'candidate', id} | {kind:'path', path} | null` to the store so AppShell's WatchErrorBanner Reopen handler knows which session-open call to invoke (the plan called for `currentLogId/currentLogPath` but neither existed; lastOpenRef is the minimal additive shape)."
  - "AppShell's Retry Connection closes the existing EventSource handle before reopening, avoiding two parallel streams when the user clicks Retry while the prior connection is still wedged."
  - "RotationBanner uses `onAutoDismiss` callback (parent clears `store.rotationNotice`) — the plan's snippet defines this exact API; the acceptance regex `! grep -i 'dismiss'` was relaxed in spirit (no manual dismiss button), see Deviations §3."
metrics:
  duration: ~22 min
  tasks: 3
  files_changed: 11
  tests_added: 25
  completed: 2026-05-08
---

# Phase 4 Plan 05: Picker / Sessions / SSE Wiring Summary

Wires the discovery + open endpoints (Plan 04-03) and the picker components (Plan 04-04) into the running app: visiting the app with no log lands on `NoActiveLogState`, selecting a candidate or typing a path opens a session and the SSE stream populates the timeline; the header `Switch log…` button toggles `LogPickerPanel`; SSE `rotation` / `watch-error` / `log-reset` frames now drive the store and surface banners with exact UI-SPEC copy.

## Outcome

- **`sessions-client.ts`** is a 60-line browser-only module that owns every `/api/sessions/*` round-trip. `SessionOpenError` carries a single `code: string` field — never the typed path, never an OS error message (T-04-05-01).
- **`sse-client.ts`** now listens for `rotation`, `watch-error`, `log-reset` in addition to the Plan 02-06 frames. Listeners mutate the store via the existing `useAppStore.getState()` pattern; `log-reset` also clears the local `snapshotRows` buffer so a fresh snapshot doesn't get appended to stale rows.
- **`store.ts`** gained two additive fields and setters: `rotationNotice / setRotationNotice` (boolean flag — TimelineRegion owns the visual in 04-06) and `lastOpenRef / setLastOpenRef` (so AppShell knows what to reopen on watch-error). `resetForLogSwitch` now also clears `rotationNotice`.
- **`RotationBanner.tsx`** renders the verbatim UI-SPEC §6 copy `Log rotated — reloading from new file.` (em dash U+2014), uses `--color-banner-rotation-{bg,fg}`, has `role="alert"`, auto-dismisses via `setTimeout(onAutoDismiss, 5000)`. **Mounted by TimelineRegion in 04-06**, never by AppShell.
- **`WatchErrorBanner.tsx`** renders `Watch error: {display}` with a hard-coded mapping `read-error → "file read error"`, `watch-fatal → "watcher stopped"`. Two buttons exactly: `Retry Connection` and `Reopen log`. Tokens `--color-banner-watch-error-{bg,fg}` + `--color-destructive` left rail.
- **`SwitchLogButton.tsx`** is the header button label "Switch log…" with `aria-label="Switch log"`.
- **`HeaderBar.tsx`** accepts an optional `onSwitchLog?: () => void` prop and renders `SwitchLogButton` to the left of the theme picker when defined.
- **`AppShell.tsx`** owns the picker state (open / candidates / loading) and the watch-error banner. On open: `fetchCandidates()`. On select/path: `openSessionByCandidate` / `openSessionByPath`. Server emits `log-reset` → `snapshot-begin/end` automatically; AppShell does not need to reopen the EventSource if it's already alive. Layout order: `HeaderBar → WatchErrorBanner (conditional) → SourceStrip → FilterBar → main → StatusBar → LogPickerPanel (overlay)`.
- **`App.tsx`** adds the 204-no-log probe branch: `setConnection("no-log")` + `fetchCandidates()` mounts `NoActiveLogState`. Successful `onSelect` / `onOpenPath` records `lastOpenRef` for later Reopen.

## Tasks Completed

| Task | Name                                                                          | Commit  | Notes |
| ---- | ----------------------------------------------------------------------------- | ------- | ----- |
| 1    | sessions-client + 11 tests (TDD)                                              | 9b5a7bc | success / 4xx code / fallback / network / candidates parsing |
| 2    | sse-client extension + RotationBanner + WatchErrorBanner + SwitchLogButton    | e4146ba | Store extended with rotationNotice + lastOpenRef (Rule 3) |
| 3    | App.tsx + AppShell + HeaderBar wiring + AppShell.test (6 tests)               | 295d8a1 | Includes negative test: RotationBanner NOT in AppShell |
| —    | Apply biome formatting/import-sort to sessions-client.test.ts                 | dcd4566 | autofix only |

## Verification

- `pnpm -F @ahp-inspector/ui test src/transport/sessions-client.test.ts` → 11/11 ✅
- `pnpm -F @ahp-inspector/ui test src/transport/sse-client.test.ts` → 8/8 ✅ (no Plan 02-06 regressions)
- `pnpm -F @ahp-inspector/ui test src/components/shell/AppShell.test.tsx` → 6/6 ✅ (incl. RotationBanner-not-in-AppShell negative)
- `pnpm -F @ahp-inspector/ui test` → **206/206 passing** workspace-wide (no UI regressions)
- `pnpm typecheck` → all 7 packages green
- `pnpm -F @ahp-inspector/ui build` → green (302 kB JS, 11 kB CSS)
- `pnpm exec biome check packages/ui` → clean
- All Plan-04-05 acceptance grep checks return expected counts (see Deviations §3 for the one relaxed grep)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Store missing `setRotationNotice` and `lastOpenRef`**
- **Found during:** Task 2 (writing sse-client onRotation handler) and Task 3 (writing WatchErrorBanner Reopen handler).
- **Issue:** Plan 04-00 store slice has `lastWatchError` but no rotation flag, and the WatchErrorBanner Reopen handler needs to know what was last opened (plan referred to non-existent `currentLogId / currentLogPath`).
- **Fix:** Added `rotationNotice: boolean` + `setRotationNotice(v)` and `lastOpenRef: {kind:'candidate', id} | {kind:'path', path} | null` + `setLastOpenRef(ref)` to `AppStoreState`. `resetForLogSwitch` also clears `rotationNotice`. Plan permits this: "If any are missing, add them now (mirror existing setConnection shape)."
- **Files modified:** `packages/ui/src/state/store.ts`
- **Commit:** e4146ba

**2. [Rule 3 - Blocking] Plan snippet for sse-client `setWatchError({fatal,reason})` did not match the actual server contract `{code, message}`**
- **Found during:** Task 2 (cross-checking `packages/server/src/app-state.ts` SsePayload union).
- **Issue:** Server emits `{ kind:'watch-error', code:'read-error'|'watch-fatal', message }` (Plan 04-00 / 04-02), and the existing store action is `setLastWatchError({code, message})`. The plan snippet shape would have produced a mismatch.
- **Fix:** Aligned `onWatchError` to parse `data.code` and call `setLastWatchError({code, message})`. The downstream banner reads `store.lastWatchError.code` and maps to display copy via the hard-coded record — exactly the UI-SPEC behavior. Recorded as a key-decision in the frontmatter.
- **Files modified:** `packages/ui/src/transport/sse-client.ts`, `packages/ui/src/components/shell/AppShell.tsx`
- **Commit:** e4146ba / 295d8a1

**3. [Documentation only] Acceptance grep `! grep -i "dismiss" RotationBanner.tsx` is incompatible with the plan's own API**
- **Found during:** Acceptance verification.
- **Issue:** The plan defines the RotationBanner public API as `{ onAutoDismiss(): void }` (parent uses it to clear `store.rotationNotice`). The literal grep would also flag the comment "Auto-dismissing alert…". The grep's spirit is "no manual dismiss button" — that constraint IS satisfied (no `<button>` with dismiss-style label exists in the file).
- **Fix:** Kept the plan-mandated `onAutoDismiss` prop name; semantic intent satisfied. No code change needed.

**4. [Rule 3 - Tooling] Biome formatting / import-sort**
- **Found during:** Final `pnpm exec biome check packages/ui`.
- **Issue:** New files tripped the formatter/organizeImports rules (line wrapping, import order in test file).
- **Fix:** Ran `pnpm exec biome check --write packages/ui`. No semantic changes.
- **Commit:** dcd4566

No architectural deviations (Rule 4) and no auth gates encountered.

## Out-of-Scope Lint Errors (Deferred)

`pnpm lint` workspace-wide reports two pre-existing errors **not introduced by this plan**:

| File | Rule | Owning plan |
|------|------|-------------|
| `packages/server/src/session-manager.test.ts:89` | `lint/style/useTemplate` | 04-03 |
| `packages/server/src/session-routes.ts:34` | `lint/suspicious/noImplicitAnyLet` | 04-03 |

These belong to Plan 04-03 work and are out of scope for this plan per the SCOPE BOUNDARY rule. Logged here for the orchestrator / 04-03 follow-up; not fixed.

## Threat Model — Implementation Notes

| Threat ID    | Mitigation Implemented |
| ------------ | ---------------------- |
| T-04-05-01   | `SessionOpenError` only stores `code` (string). `postOpen` never includes the typed path in the thrown error. AppShell test asserts that the raw OS message in `lastWatchError.message` does NOT appear inside the banner copy. |
| T-04-05-02   | `onLogReset` calls `store.resetForLogSwitch()` (rows + selection cleared) and resets local `snapshotRows = []`. No path / filesystem data flows in from the SSE frame body. |
| T-04-05-03   | `setPickerLoading(true)` disables the Refresh button while in flight (`<button disabled={isLoading}>` in `LogPickerPanel`). |
| T-04-05-04   | `lastWatchError` is a single object slot (one banner) and `rotationNotice` is a boolean (one banner). Stacking is structurally impossible. |
| T-04-05-05   | Same-origin EventSource enforced by the browser; no change to URL handling. |

## Threat Flags

None — this plan does not introduce new network endpoints, auth paths, file access, or trust-boundary surface beyond what Plans 04-03 and 04-00 already declared.

## Known Stubs

None.

## Self-Check: PASSED

- `packages/ui/src/transport/sessions-client.ts` — FOUND
- `packages/ui/src/transport/sessions-client.test.ts` — FOUND
- `packages/ui/src/components/banners/RotationBanner.tsx` — FOUND
- `packages/ui/src/components/banners/WatchErrorBanner.tsx` — FOUND
- `packages/ui/src/components/shell/SwitchLogButton.tsx` — FOUND
- `packages/ui/src/components/shell/AppShell.test.tsx` — FOUND
- Commit `9b5a7bc` — FOUND (Task 1)
- Commit `e4146ba` — FOUND (Task 2)
- Commit `295d8a1` — FOUND (Task 3)
- Commit `dcd4566` — FOUND (biome formatting)
- All acceptance-criteria greps return expected counts (see Deviation §3 for the documented relaxation).
