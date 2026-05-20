---
phase: 23-i-want-to-improve-the-so-called-hacker-theme-can-we-do-somet
plan: 01
subsystem: ui
tags: [hacker-theme, crt, svg-filter, playwright]
requires:
  - phase: 23-i-want-to-improve-the-so-called-hacker-theme-can-we-do-somet
    provides: approved CRT context, research, UI spec, and pattern map
provides:
  - Shared same-document Hacker CRT displacement filter definitions
  - Full AppShell CRT display surface attachment point
  - Fixture-backed browser smoke for Hacker filter scope, overlay targets, and responsive drawer geometry
affects: [ui-theme, app-shell, extension-webview-parity, phase23-validation]
tech-stack:
  added: []
  patterns: [same-document svg filter defs, shared display surface wrapper, fixture-backed CRT browser smoke]
key-files:
  created:
    - packages/ui/src/components/shell/CrtFilterDefs.tsx
    - e2e/phase23.spec.ts
  modified:
    - packages/ui/src/components/shell/AppShell.tsx
    - packages/ui/src/styles/global.css
key-decisions:
  - "The CRT warp mounts as same-document SVG filter definitions plus a shared AppShell display surface, keeping the effect bundled and Hacker-scoped."
  - "The first placement proof treats ordinary Playwright clicks and viewport-sized drawer geometry as required evidence before CRT intensity increases."
patterns-established:
  - "Whole-shell CRT effects attach through `crt-display-surface` while filter definitions remain inert and noninteractive."
  - "Phase 23 browser checks use committed safe fixtures and assert visual filter scoping through computed styles."
requirements-completed: []
duration: 3min
completed: 2026-05-17
---

# Phase 23 Plan 01: Shared CRT Display Surface Summary

**Hacker mode now has a same-document CRT displacement surface spanning the shared app shell, with browser smoke coverage proving filter scoping, picker usability, and responsive drawer geometry.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-17T18:10:17Z
- **Completed:** 2026-05-17T18:13:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `CrtFilterDefs` with the planned `ahp-crt-warp` turbulence/displacement graph and mounted it once from the shared shell.
- Wrapped the entire existing `AppShell` ownership set in `crt-display-surface`, then attached the warp filter only while `data-theme="hacker"` is active.
- Added a safe-fixture Playwright `CRT smoke` flow covering the Hacker theme toggle, rendered filter scope, ordinary row/search/picker interactions, drawer viewport geometry, close flow, and Dark-mode escape.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount a shared Hacker CRT displacement surface** - `78fc966` (feat)
2. **Task 2 RED: Add CRT placement browser smoke** - `e2d57bd` (test)
3. **Formatting cleanup after verification** - `84ad851` (style)

_Note: Task 2's GREEN run validated the Task 1 production surface after rebuilding the shared UI bundle that the CLI serves; no second product-code diff was required._

## Files Created/Modified
- `packages/ui/src/components/shell/CrtFilterDefs.tsx` - Inline, inert SVG filter definitions for the Hacker CRT displacement map.
- `packages/ui/src/components/shell/AppShell.tsx` - Shared CRT display wrapper around the full shell presentation.
- `packages/ui/src/styles/global.css` - Hacker-only filter attachment and zero-size filter-def surface styling.
- `e2e/phase23.spec.ts` - Fixture-backed Playwright smoke for filter scope and interaction/geometry safety.

## Decisions Made
The placement proof follows the plan as approved: the effect remains same-document and local, the filter applies at a single shared surface rather than panel-by-panel, and Dark/Light stay outside the new selector.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The initial RED browser run correctly failed to find `crt-display-surface` because the CLI serves `packages/ui/dist`; rebuilding `@ahp-inspector/ui` refreshed the served bundle, after which the focused CRT smoke passed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Plan 23-02 can safely intensify Hacker CRT tokens, overlays, and motion on top of a verified whole-shell filter placement. The reduced-motion and broader visual evidence work remain queued for the later plans exactly as scheduled.

## Self-Check: PASSED

- Confirmed the summary's created/modified key files exist on disk.
- Confirmed task and formatting commits `78fc966`, `e2d57bd`, and `84ad851` exist in git history.

---
*Phase: 23-i-want-to-improve-the-so-called-hacker-theme-can-we-do-somet*
*Completed: 2026-05-17*
