---
phase: 02-vertical-slice-cli-server-timeline
plan: 04
subsystem: ui
tags: [react, zustand, tanstack-virtual, lucide-react, virtualization, a11y, design-tokens]

requires:
  - phase: 02-00
    provides: EventRow projection contract (idx/seq/dir/kindTag/status/latencyMs/...) consumed by row renderers
  - phase: 02-02
    provides: useAppStore (Zustand), AppShell, design tokens, hex-literal guard, TimelineRegion stub being replaced here
  - phase: 02-03
    provides: Six timeline cells (DirectionGlyph, KindTag, ActionDot, StatusCell, LatencyCell, PayloadPreview)
provides:
  - Five screen-level states (Loading / Empty / NoResults / Disconnected / ServerNotRunning) with verbatim UI-SPEC §10 copy
  - EventRow with 11-column grid, role=row + aria-rowindex/aria-selected, rail-color logic (selected/orphan/error)
  - ParseErrorRow with hatched destructive rail and "BAD · line N · reason" copy
  - TimelineList: TanStack Virtual fixed-height list, role=grid + aria-rowcount, ≤~50 DOM rows for 50K-row fixture
  - TimelineRegion (real, replacing 02-02 stub): routes between states + global keyboard nav (Up/Down/PageUp/PageDown/Home/End/Esc)
  - App.tsx no-server short-circuit to ServerNotRunningState
affects: [02-05, 02-06]

tech-stack:
  added: []
  patterns:
    - "Virtualized list with fixed rowHeight=28 + overscan=12 via @tanstack/react-virtual"
    - "Window-scoped keydown handler that mutates store via fixed action set; cleaned up on unmount"
    - "All screen-state copy lives in component source verbatim from UI-SPEC §10 (no string table indirection)"

key-files:
  created:
    - packages/ui/src/components/states/LoadingState.tsx
    - packages/ui/src/components/states/EmptyState.tsx
    - packages/ui/src/components/states/NoResultsBanner.tsx
    - packages/ui/src/components/states/DisconnectedBanner.tsx
    - packages/ui/src/components/states/ServerNotRunningState.tsx
    - packages/ui/src/components/states/states.test.tsx
    - packages/ui/src/components/timeline/EventRow.tsx
    - packages/ui/src/components/timeline/EventRow.columns.test.tsx
    - packages/ui/src/components/timeline/EventRow.orphan.test.tsx
    - packages/ui/src/components/timeline/ParseErrorRow.tsx
    - packages/ui/src/components/timeline/ParseErrorRow.test.tsx
    - packages/ui/src/components/timeline/TimelineList.tsx
    - packages/ui/src/components/timeline/TimelineList.virt.test.tsx
  modified:
    - packages/ui/src/components/timeline/TimelineRegion.tsx
    - packages/ui/src/App.tsx
    - packages/ui/src/App.test.tsx

key-decisions:
  - "Plan 02-04: TanStack Virtual reads offsetWidth/offsetHeight (via virtual-core getRect), not getBoundingClientRect — virt test mocks both prototype getters on HTMLElement to give jsdom an 800x400 viewport so virtualization actually runs."
  - "Plan 02-04: Window-scoped keydown handler in TimelineRegion (not list-scoped) — keyboard nav works regardless of focus, and the empty-rows guard prevents bogus selection when no rows exist."
  - "Plan 02-04: App.tsx no-server short-circuit returns before AppShell mounts — keeps ServerNotRunningState the entire viewport without a half-rendered chrome. Plan 02-06 SSE client will set 'no-server' when EventSource fails."

patterns-established:
  - "Virtualized timeline pattern: useRef container, useVirtualizer({count, getScrollElement, estimateSize:28, overscan:12}), absolute-positioned rows via translateY"
  - "Banner / state component shape: data-testid='state-*' or 'banner-*', verbatim UI-SPEC copy in JSX, design tokens for color/spacing only"

requirements-completed: [TIME-01, TIME-02, TIME-03, TIME-06, EVENT-05, INGEST-06]

duration: 10min
completed: 2026-05-07
---

# Phase 02 Plan 04: Timeline UI integration Summary

**Virtualized 50K-row TanStack Virtual timeline + five UI-SPEC §10 screen states + window-keyboard nav, replacing the 02-02 TimelineRegion stub and routing App.tsx to ServerNotRunningState when the CLI is not running.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-07T15:11:00Z
- **Completed:** 2026-05-07T15:17:17Z
- **Tasks:** 3 (all autonomous, all TDD)
- **Files modified:** 16 (13 new, 3 modified)

## Accomplishments

- Five screen-level states (LoadingState / EmptyState / NoResultsBanner / DisconnectedBanner / ServerNotRunningState) with verbatim UI-SPEC §10 copy and unit tests
- EventRow with all 11 columns from §7.2, role=row + aria-rowindex + aria-selected, and rail-color logic covering selected / orphan / unmatched / error / default
- ParseErrorRow with hatched destructive rail and the verbatim "BAD · line N · reason" copy plus null-fallback path
- TimelineList: TanStack Virtual fixed-height list (28px rows, overscan 12), role=grid + aria-rowcount, proven to render <100 DOM `[role=row]` elements for a 50,000-row fixture
- TimelineRegion (real impl, replacing 02-02 stub) routes Loading / Empty / NoResultsBanner / DisconnectedBanner / TimelineList based on store state, plus a global keydown handler for Up/Down/PageUp/PageDown/Home/End/Esc
- App.tsx now short-circuits to ServerNotRunningState when `connection === 'no-server'`, ready for Plan 02-06 SSE wiring

## Task Commits

Each task was committed atomically:

1. **Task 1: Five screen-level states + tests** — `5158e17` (feat)
2. **Task 2: EventRow + ParseErrorRow with rail-color logic** — `3c93a50` (feat)
3. **Task 3: TimelineList virtualization + TimelineRegion routing + App no-server short-circuit** — `ac62e20` (feat)

## Files Created/Modified

Created:
- `packages/ui/src/components/states/LoadingState.tsx` — `Loader2.spin`, "Loading log…", `Reading <span class="mono">{filename}</span>`
- `packages/ui/src/components/states/EmptyState.tsx` — "No events yet" / "This log file is empty…"
- `packages/ui/src/components/states/NoResultsBanner.tsx` — 64px banner, 4px warning border-left, heading + body props
- `packages/ui/src/components/states/DisconnectedBanner.tsx` — 40px banner, WifiOff icon, "Retry connection" text-button calling `onReconnect`
- `packages/ui/src/components/states/ServerNotRunningState.tsx` — full-page "Start the viewer from the CLI" + run command
- `packages/ui/src/components/states/states.test.tsx` — five describe blocks covering verbatim copy + retry callback
- `packages/ui/src/components/timeline/EventRow.tsx` — memoized 11-column grid composing the six 02-03 cells; rail-color helper
- `packages/ui/src/components/timeline/EventRow.columns.test.tsx` — 11 gridcells + aria-rowindex/aria-selected
- `packages/ui/src/components/timeline/EventRow.orphan.test.tsx` — 5 rail-color paths
- `packages/ui/src/components/timeline/ParseErrorRow.tsx` — 2-column grid, repeating-linear-gradient rail, "BAD · line N · reason"
- `packages/ui/src/components/timeline/ParseErrorRow.test.tsx` — copy + rail + null fallback
- `packages/ui/src/components/timeline/TimelineList.tsx` — useVirtualizer + role=grid + dispatch to EventRow vs ParseErrorRow on `kind === 'parse-error'`
- `packages/ui/src/components/timeline/TimelineList.virt.test.tsx` — 50K-row fixture proves <100 DOM rows after measurement

Modified:
- `packages/ui/src/components/timeline/TimelineRegion.tsx` — removed Plan 02-02 stub; now selects rows/connection/meta/selectedIdx from store, attaches window keydown handler, routes states + renders TimelineList
- `packages/ui/src/App.tsx` — added `connection === 'no-server'` short-circuit returning `<ServerNotRunningState />`
- `packages/ui/src/App.test.tsx` — updated smoke test to reflect new TimelineRegion contract; added second test covering no-server routing

## Decisions Made

- **Window-scoped keydown listener.** Keyboard nav lives on `window` rather than the grid container so navigation works without manually focusing the list. Cleanup on unmount; empty-rows guard prevents accidental selection of `0` when there are no rows.
- **No-server is a top-level App route, not a banner.** The plan calls for full-page replacement, not chrome+overlay; this matches UI-SPEC §10 and keeps the wiring Plan 02-06 needs to a single `setConnection('no-server')` call.
- **Virt test mocks `offsetWidth`/`offsetHeight`, not just `getBoundingClientRect`.** TanStack Virtual core uses `getRect = (el) => ({ width: el.offsetWidth, height: el.offsetHeight })`; mocking only `getBoundingClientRect` (as the plan specified) leaves the virtualizer measuring 0 and rendering zero items. Documented as Rule 3 deviation below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Virtualization test needed offsetWidth/offsetHeight mocks**

- **Found during:** Task 3 (TimelineList.virt.test)
- **Issue:** Plan 02-04 Task 3 step 2 instructed mocking `Element.prototype.getBoundingClientRect` to give jsdom a non-zero viewport. `@tanstack/virtual-core@3.14.0` uses `getRect(element) => ({ width: element.offsetWidth, height: element.offsetHeight })` (verified in `node_modules/.pnpm/@tanstack+virtual-core@3.14.0/.../dist/esm/index.js` line 2-5), not `getBoundingClientRect`. With only the rect mock the virtualizer measured a 0×0 viewport and rendered 0 virtual items, so the assertion `screen.getAllByRole("row").length >= 1` failed.
- **Fix:** Kept the original `getBoundingClientRect` mock and additionally redefined `offsetHeight`/`offsetWidth` getters on `window.HTMLElement.prototype` in `beforeEach` (returning 400 / 800), restoring the original property descriptors in `afterEach`. Also switched the assertion to `await screen.findAllByRole("row")` to cover the case where measurement happens after first paint.
- **Files modified:** `packages/ui/src/components/timeline/TimelineList.virt.test.tsx`
- **Verification:** `pnpm vitest run src/components/timeline/TimelineList.virt.test.tsx` passes (1 test, ≤~50 DOM rows for 50K fixture)
- **Committed in:** `ac62e20` (Task 3 commit)

**2. [Rule 3 - Blocking] App smoke test rewritten for new TimelineRegion contract**

- **Found during:** Task 3 (full UI suite verification)
- **Issue:** The pre-existing `App.test.tsx` (from Plan 02-02) asserted `getByTestId("timeline-region")`. After replacing the stub, that test ID is no longer present when `connection==='connecting' && rows.length===0` (TimelineRegion returns `<LoadingState />` directly). Test failed.
- **Fix:** Updated smoke test to assert `state-loading` is rendered for the default store state (matches new contract), added `useAppStore.setState` in `afterEach` to reset state between tests, and added a second `it` covering the `no-server` → `ServerNotRunningState` short-circuit. Net result: the App test now also covers Task 3's App.tsx change.
- **Files modified:** `packages/ui/src/App.test.tsx`
- **Verification:** `pnpm -F @ahp-viewer/ui test` → 15 files / 55 tests passing
- **Committed in:** `ac62e20` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking).
**Impact on plan:** Both required to make the documented assertions actually run. No scope creep — the test contract in the plan is preserved (50K-row fixture, <100 DOM rows, App routes to ServerNotRunningState).

## Issues Encountered

- TanStack Virtual core changed measurement primitive from `getBoundingClientRect` to `offsetWidth/Height` between plan research and execution; resolved by inspecting `@tanstack+virtual-core@3.14.0/dist/esm/index.js` and updating the mock surface.

## Verification

- `pnpm -F @ahp-viewer/ui test` — 15 files / 55 tests passing
- `pnpm -F @ahp-viewer/ui typecheck` — clean
- `pnpm -F @ahp-viewer/ui build` — `dist/assets/index-*.js` 223.89 kB (gzip 70.10 kB), 215 ms
- `pnpm typecheck` — all 6 packages clean
- `grep -rEn "#[0-9a-fA-F]{3,8}" packages/ui/src/components/` — 0 matches (token guard preserved)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02-05 (detail rail JSON) and Plan 02-06 (SSE client wiring) can proceed: every UI surface they need is mounted, store-wired, and tested.
- Plan 02-06 must call `setConnection("no-server")` from the SSE client when EventSource cannot connect — the App.tsx short-circuit is already in place.
- 50K-row virtualization headroom is proven; no further DOM-cost optimization needed for v1 timeline.

## Self-Check: PASSED

- All 13 created files exist on disk (verified via `[ -f ]` checks).
- Commits `5158e17`, `3c93a50`, `ac62e20` all reachable via `git log`.

---
*Phase: 02-vertical-slice-cli-server-timeline*
*Completed: 2026-05-07*
