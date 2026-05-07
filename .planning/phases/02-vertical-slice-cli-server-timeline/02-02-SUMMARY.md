---
phase: 02-vertical-slice-cli-server-timeline
plan: 02
subsystem: ui
tags: [react, zustand, css-tokens, design-system, dark-theme, lucide-react, vitest]

# Dependency graph
requires:
  - phase: 02-00
    provides: "vendored Inter / JetBrains Mono fonts under packages/ui/public/fonts/, Phase-2 UI scaffold (vite + react), @ahp-viewer/core EventRow + LatencyBand + Status types"
  - phase: 02-01
    provides: "(awareness only) AppState/SSE seam — not consumed by this plan; Plan 02-04 wires the SSE client into the store"
provides:
  - "tokens.css single source of truth (UI-SPEC §12 verbatim) — spacing, typography, surface, text, semantic, direction, kind, action, latency tokens"
  - "fonts.css with @font-face for Inter Variable + JetBrains Mono Variable, served from /fonts/ (no CDN)"
  - "global.css applying dark-theme body styles, focus-visible outline, .mono/.ts/.latency utility classes, .detail-rail responsive rule"
  - "useAppStore Zustand store: rows, connection, selectedIdx, meta + setRows / appendRows / applyPatch / setConnection / setMeta / selectIdx / clearSelection"
  - "AppShell composing HeaderBar (40px) / SourceStrip (32px) / TimelineRegion stub / DetailRailPlaceholder (320px @ ≥1024px) / StatusBar (24px)"
  - "StatusBar emitting UI-SPEC §10 verbatim copy for all four connection states"
  - "TimelineRegion stub (flex:1, data-testid='timeline-region') ready for Plan 02-04 to replace"
  - "no-hex-in-components.test.ts guard rejecting raw '#xxxxxx' literals under packages/ui/src/components/**"
affects:
  - 02-03 (state components — empty/loading/no-server/error — slot into AppShell once routing lands in 02-04)
  - 02-04 (timeline + state routing replaces TimelineRegion stub and consumes useAppStore)
  - 02-05+ (filter bar, detail rail real impl, search — all build on this shell + store)
  - phase 5 (theme switcher overrides token variables only; no component churn)

# Tech tracking
tech-stack:
  added: []  # zustand + lucide-react were already declared in packages/ui/package.json by Plan 02-00
  patterns:
    - "All component colors flow through var(--*) tokens — no raw hex literals (enforced by Vitest guard)"
    - "Dark-theme via [data-theme='dark'] block in tokens.css; main.tsx sets the attribute on <html> at boot"
    - "Zustand store as single source of UI state; selectors with discrete property reads to avoid over-rendering"
    - "Shell components are pure presentational; AppShell is the only consumer of useAppStore in this plan"
    - "Stub-then-replace contract: TimelineRegion ships as data-testid-only div; Plan 02-04 swaps the implementation"

key-files:
  created:
    - packages/ui/src/styles/tokens.css
    - packages/ui/src/styles/fonts.css
    - packages/ui/src/styles/global.css
    - packages/ui/src/styles/no-hex-in-components.test.ts
    - packages/ui/src/version.ts
    - packages/ui/src/state/store.ts
    - packages/ui/src/state/store.test.ts
    - packages/ui/src/components/shell/AppShell.tsx
    - packages/ui/src/components/shell/HeaderBar.tsx
    - packages/ui/src/components/shell/SourceStrip.tsx
    - packages/ui/src/components/shell/StatusBar.tsx
    - packages/ui/src/components/shell/StatusBar.test.tsx
    - packages/ui/src/components/detail/DetailRailPlaceholder.tsx
    - packages/ui/src/components/timeline/TimelineRegion.tsx
  modified:
    - packages/ui/src/main.tsx
    - packages/ui/src/App.tsx
    - packages/ui/src/App.test.tsx

key-decisions:
  - "Substituted lucide-react FileBraces for FileJson because lucide-react@1.14.0 (already pinned in Plan 02-00) does not export FileJson; FileBraces is the closest semantic match for a JSONL source and keeps the dependency lock untouched."
  - "Deferred App.tsx → <AppShell /> rewire from Task 1 to Task 2 so each task's verify command (build+vitest) stays green at every commit boundary; original plan implied Task 1 would already render AppShell, which would have broken the build between commits."
  - "Implemented .detail-rail responsive width / hide-below-1024 rule in global.css (Task 1) instead of inline in DetailRailPlaceholder so the responsive contract lives with the rest of the global theme — matches the plan's recommended path."
  - "useAppStore.setRows / appendRows preserve null meta (do not synthesize a MetaSummary); meta is set explicitly via setMeta when a file/SSE handshake lands in Plan 02-04."

patterns-established:
  - "tokens.css = single source of truth: every component-level color, spacing, font-size goes through var(--*); CI enforces via no-hex-in-components.test.ts"
  - "Connection-state copy lives in StatusBar.tsx (visualFor) as a discriminated switch; UI-SPEC §10 strings are unit-tested verbatim"
  - "Component test-ids use kebab-case nouns (status-label, status-dot, timeline-region, detail-rail, app-shell) for stable e2e selectors"

requirements-completed: [TIME-01, TIME-06]

# Metrics
duration: ~10min
completed: 2026-05-07
---

# Phase 02 Plan 02: UI Foundation — Tokens, Store, App Shell Summary

**Dark-first design-token manifest, Zustand store, and AppShell chrome (HeaderBar / SourceStrip / TimelineRegion stub / DetailRailPlaceholder / StatusBar) wired through useAppStore — landed in 14 new files with hex-literal guard and verbatim UI-SPEC §10 status copy enforced by Vitest.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-07T14:53:00Z
- **Completed:** 2026-05-07T15:00:50Z
- **Tasks:** 2
- **Files created:** 14
- **Files modified:** 3

## Accomplishments

- `tokens.css` reproduces UI-SPEC §12 verbatim (40+ tokens across spacing/typography/surface/text/semantic/direction/kind/action/latency).
- `fonts.css` registers Inter Variable and JetBrains Mono Variable from local `/fonts/` paths — no CDN, satisfies local-only privacy posture.
- `useAppStore` exposes the full Phase-2 state surface (rows / connection / selectedIdx / meta + 7 actions) with derived `sessionCount` updates; covered by 5 store unit tests.
- `AppShell` mounts via 1 entry point and reads 4 selectors from `useAppStore`; HeaderBar / SourceStrip / DetailRailPlaceholder consume props derived from store state.
- `StatusBar` renders all four connection-state strings verbatim per UI-SPEC §10, including the optional `· selected #N` suffix; 5 unit tests assert the textContent character-for-character.
- `no-hex-in-components.test.ts` walks `packages/ui/src/components/**/*.tsx` and rejects any quoted `#xxxxxx` literal — currently zero violations.
- `TimelineRegion` ships as a stub (`<div data-testid="timeline-region" style={{ flex: 1 }} />`) so AppShell mounts cleanly and Plan 02-04 has a stable swap point.

## Task Commits

1. **Task 1: Tokens, fonts, global CSS, store, hex-literal guard** — `35d3fd9` (feat)
2. **Task 2: App shell chrome — HeaderBar / SourceStrip / StatusBar / DetailRailPlaceholder / TimelineRegion stub** — `7fff06b` (feat)

**Plan metadata:** _added in final docs commit_

## Files Created / Modified

### Created

- `packages/ui/src/styles/tokens.css` — UI-SPEC §12 design-token manifest, sole color/spacing source.
- `packages/ui/src/styles/fonts.css` — Local `@font-face` declarations for Inter Variable + JetBrains Mono Variable.
- `packages/ui/src/styles/global.css` — Dark-theme body, focus-visible outline, mono utility classes, `.detail-rail` responsive rule, imports tokens + fonts.
- `packages/ui/src/styles/no-hex-in-components.test.ts` — Vitest guard rejecting `"#xxxxxx"` literals under `components/`.
- `packages/ui/src/version.ts` — `__APP_VERSION__ = "0.1.0"` for HeaderBar.
- `packages/ui/src/state/store.ts` — `useAppStore` Zustand store; types `Connection`, `MetaSummary`, `PatchUpdate`, `AppStoreState`.
- `packages/ui/src/state/store.test.ts` — 5 tests covering setRows/appendRows/applyPatch/selectIdx/setConnection.
- `packages/ui/src/components/shell/AppShell.tsx` — Top-level layout consuming useAppStore.
- `packages/ui/src/components/shell/HeaderBar.tsx` — 40px header with title + version.
- `packages/ui/src/components/shell/SourceStrip.tsx` — 32px filename + counts strip; `FileBraces` lucide icon (see deviation).
- `packages/ui/src/components/shell/StatusBar.tsx` — 24px status bar; UI-SPEC §10 verbatim copy via `visualFor` switch.
- `packages/ui/src/components/shell/StatusBar.test.tsx` — 5 tests asserting `status-label.textContent` per state.
- `packages/ui/src/components/detail/DetailRailPlaceholder.tsx` — 320px right rail (hidden under 1024px via `.detail-rail` rule).
- `packages/ui/src/components/timeline/TimelineRegion.tsx` — Stub div with `data-testid="timeline-region"`; replaced in Plan 02-04.

### Modified

- `packages/ui/src/main.tsx` — imports `./styles/global.css`, sets `data-theme="dark"` on `<html>` before mount.
- `packages/ui/src/App.tsx` — now `<AppShell />`-only.
- `packages/ui/src/App.test.tsx` — asserts `app-shell` and `timeline-region` test ids.

## Decisions Made

- **`FileBraces` instead of `FileJson`** (see deviations). lucide-react@1.14.0 does not export FileJson; FileBraces is the closest semantic match (JSON-shaped braces glyph) and avoids bumping the dependency lock mid-plan.
- **Defer `<AppShell />` wiring from Task 1 to Task 2.** The plan's Task 1 step 6 replaces App.tsx with `<AppShell />`, but AppShell.tsx isn't created until Task 2 — applying the plan literally would leave the repo in a non-buildable state at the Task 1 commit boundary. Task 1 keeps the original `app-root` div; Task 2 rewires to AppShell. Both tasks' `pnpm -F @ahp-viewer/ui build` verify commands now pass at their respective commits.
- **`.detail-rail` rule lives in `global.css`** (Task 1 file), per the plan's recommended path, so the responsive contract sits with the rest of the dark-theme stylesheet.
- **`useAppStore.setRows` preserves null `meta`.** A `setRows` call before `setMeta` does not synthesize a `MetaSummary`. `meta` is initialized explicitly via `setMeta` once Plan 02-04 wires the SSE handshake.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `FileJson` not exported by lucide-react@1.14.0**
- **Found during:** Task 2 (SourceStrip implementation)
- **Issue:** Plan instructed `import { FileJson } from "lucide-react";` but lucide-react@1.14.0 (locked by Plan 02-00) does not export `FileJson`. Available file icons include `FileBraces`, `FileCode`, `FileText`.
- **Fix:** Substituted `FileBraces` (JSON-style braces glyph) — semantically equivalent for a JSONL log source and keeps `pnpm-lock.yaml` untouched.
- **Files modified:** `packages/ui/src/components/shell/SourceStrip.tsx`
- **Verification:** `pnpm -F @ahp-viewer/ui build` and `pnpm -F @ahp-viewer/ui typecheck` pass; AppShell renders the icon in jsdom App.test.tsx without errors.
- **Committed in:** `7fff06b` (Task 2)

**2. [Rule 3 - Blocking] Plan task ordering broke build at Task 1 commit boundary**
- **Found during:** Task 1 (App.tsx replacement step)
- **Issue:** Plan's Task 1 step 6 imports `<AppShell />` from a file that does not yet exist (created in Task 2). Applying it literally fails `pnpm -F @ahp-viewer/ui build` at the Task 1 commit, violating the plan's own Task 1 verify command.
- **Fix:** Kept App.tsx as `<div data-testid="app-root" />` through Task 1; rewired to `<AppShell />` in Task 2 once AppShell.tsx exists. Documented inline as a comment.
- **Files modified:** `packages/ui/src/App.tsx`, `packages/ui/src/App.test.tsx`
- **Verification:** Both tasks' verify commands (`pnpm vitest run …` + `pnpm -F @ahp-viewer/ui build`) green at their commit boundary.
- **Committed in:** `35d3fd9` (Task 1) + `7fff06b` (Task 2)

---

**Total deviations:** 2 auto-fixed (2 Rule 3 - Blocking)
**Impact on plan:** No scope change. Both deviations preserve the plan's intent (working SourceStrip icon, atomic green commits) by adapting to repository facts (lucide-react export surface, ordering of file creation).

## Issues Encountered

- None beyond the deviations above. All verify commands pass on first run after each task.

## Verification Results

| Command | Result |
|---|---|
| `pnpm vitest run packages/ui/src/styles packages/ui/src/state` (Task 1) | ✅ 6/6 |
| `pnpm -F @ahp-viewer/ui build` (Task 1) | ✅ |
| `cd packages/ui && pnpm vitest run` (Task 2) | ✅ 12/12 |
| `pnpm -F @ahp-viewer/ui build` (Task 2) | ✅ |
| `pnpm typecheck` (full workspace) | ✅ |
| `grep -nE "#[0-9a-fA-F]{3,8}" packages/ui/src/components/ -r` | ✅ 0 hits |
| `pnpm vitest run test/boundary.test.ts test/security.test.ts` | ✅ 55/55 |

## User Setup Required

None — no external service configuration introduced by this plan.

## Next Phase Readiness

- **Plan 02-03 (state components):** Empty/loading/no-server/error state components can now be authored against AppShell's slot pattern. They will render inside `TimelineRegion` (or replace it) once routing lands in Plan 02-04.
- **Plan 02-04 (timeline + routing):** Has a stable scaffold to replace `TimelineRegion.tsx` against; `useAppStore.rows`/`selectedIdx`/`appendRows`/`applyPatch` are ready to be driven by an SSE client.
- **No blockers.** Hex-literal guard provides ongoing CI pressure to keep theme drift impossible.

## Self-Check: PASSED

- ✅ FOUND: `packages/ui/src/styles/tokens.css`
- ✅ FOUND: `packages/ui/src/styles/fonts.css`
- ✅ FOUND: `packages/ui/src/styles/global.css`
- ✅ FOUND: `packages/ui/src/styles/no-hex-in-components.test.ts`
- ✅ FOUND: `packages/ui/src/version.ts`
- ✅ FOUND: `packages/ui/src/state/store.ts`
- ✅ FOUND: `packages/ui/src/state/store.test.ts`
- ✅ FOUND: `packages/ui/src/components/shell/AppShell.tsx`
- ✅ FOUND: `packages/ui/src/components/shell/HeaderBar.tsx`
- ✅ FOUND: `packages/ui/src/components/shell/SourceStrip.tsx`
- ✅ FOUND: `packages/ui/src/components/shell/StatusBar.tsx`
- ✅ FOUND: `packages/ui/src/components/shell/StatusBar.test.tsx`
- ✅ FOUND: `packages/ui/src/components/detail/DetailRailPlaceholder.tsx`
- ✅ FOUND: `packages/ui/src/components/timeline/TimelineRegion.tsx`
- ✅ FOUND commit `35d3fd9` (Task 1)
- ✅ FOUND commit `7fff06b` (Task 2)

---
*Phase: 02-vertical-slice-cli-server-timeline*
*Completed: 2026-05-07*
