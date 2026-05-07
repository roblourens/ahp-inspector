---
phase: 03-detail-search-and-filtering
plan: "05"
subsystem: ui
tags: [react, tanstack-virtual, zustand, search, grouping, keyboard]

# Dependency graph
requires:
  - phase: 03-01
    provides: search endpoint GET /api/log/search; SearchIndex; correlatorDataFor
  - phase: 03-02
    provides: useFilteredRows; useGroupedItems; VirtualItem type; selectors
  - phase: 03-03
    provides: FilterBar; ActiveFilterChips; FacetPopover; SearchInput; GroupToggleChip
  - phase: 03-04
    provides: DetailPanel; fetchEvent; AhpFieldStrip; PrettyJsonView; resize handle

provides:
  - "searchEvents() — fetch /api/log/search?q=...&limit=5000; AbortSignal support"
  - "useSearch() — debounced 150ms search hook with AbortController; dispatches setSearchMatches"
  - "GroupHeaderRow — session/turn labels, duration formatting, collapse toggle"
  - "GapBannerRow — serverSeq gap display with AlertTriangle glyph"
  - "StickyGroupBar — sticky topmost group label above timeline list"
  - "TimelineList — polymorphic VirtualItem[] rendering: header(24px)/gap-banner(20px)/row(28px)"
  - "AppShell — full Phase 3 layout: FilterBar + ActiveFilterChips + StickyGroupBar + DetailPanel"
  - "TimelineRegion — keyboard: / focuses search, Esc priority order, g+s chord cycles grouping, navigation over filteredRowIdxs"
  - "EventRow — ShieldAlert when isAuthFailure; highlightMatches for search query highlighting"
  - "StatusBar — visible/total and group count segments when filtered/grouped"

affects: [04-e2e-and-perf, 05-packaging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "exactOptionalPropertyTypes conditional spread: ...(x !== undefined ? { x } : {})"
    - "React 19 ref as prop (no forwardRef needed)"
    - "TanStack Virtual mixed estimateSize via VirtualItem kind lookup"
    - "useSearch debounce pattern: clearTimeout + AbortController per keystroke"
    - "highlightMatches: React mark elements (XSS-safe, auto-escaped)"

key-files:
  created:
    - packages/ui/src/transport/search-client.ts
    - packages/ui/src/transport/search-client.test.ts
    - packages/ui/src/components/filters/useSearch.ts
    - packages/ui/src/components/timeline/GroupHeaderRow.tsx
    - packages/ui/src/components/timeline/GapBannerRow.tsx
    - packages/ui/src/components/timeline/StickyGroupBar.tsx
    - packages/ui/src/components/timeline/grouping.test.tsx
  modified:
    - packages/ui/src/components/timeline/TimelineList.tsx
    - packages/ui/src/components/timeline/TimelineList.virt.test.tsx
    - packages/ui/src/components/timeline/TimelineRegion.tsx
    - packages/ui/src/components/timeline/EventRow.tsx
    - packages/ui/src/components/shell/AppShell.tsx
    - packages/ui/src/components/shell/StatusBar.tsx
    - packages/ui/src/components/filters/FilterBar.tsx
    - packages/ui/src/components/filters/SearchInput.tsx

key-decisions:
  - "search-client.ts uses conditional spread for AbortSignal (exactOptionalPropertyTypes: RequestInit.signal is AbortSignal|null, not |undefined)"
  - "TimelineList onSelect wraps store selectIdx in lambda to adapt number|null → number signature"
  - "TimelineRegion passes onTopGroupChange via conditional spread (exactOptionalPropertyTypes: optional callbacks must not be spread as undefined)"
  - "FilterBar passes searchInputRef to SearchInput via conditional spread; SearchInput accepts ref as plain prop (React 19)"
  - "highlightMatches uses React mark elements with CSS token colors — never interpret searchQuery as HTML (T-03-05-03)"
  - "StickyGroupBar returns null when topGroup is null — no DOM overhead when grouping is off"
  - "TimelineList.virt.test.tsx updated from rows[] API to items[]/rows[] API"

patterns-established:
  - "TDD RED→GREEN for new transport + UI component pairs (search-client + grouping tests)"
  - "VirtualItem polymorphic rendering pattern: getItemKindKey() → ITEM_HEIGHT const lookup"

requirements-completed: [SEARCH-01, SEARCH-03, TIME-04, TIME-05, EVENT-06]

# Metrics
duration: 14min
completed: 2026-05-07
---

# Phase 03 Plan 05: Final Assembly Summary

**Phase 3 wave-3 assembly: search client + debounced hook, polymorphic TanStack Virtual timeline (GroupHeaderRow/GapBannerRow/StickyGroupBar), and full AppShell wiring with FilterBar + DetailPanel + keyboard shortcuts**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-07T18:38:21Z
- **Completed:** 2026-05-07T18:52:28Z
- **Tasks:** 2 (TDD + assembly)
- **Files modified:** 15

## Accomplishments

- Search transport layer: `searchEvents()` fetches `/api/log/search?q=…&limit=5000` with AbortSignal; `useSearch()` hook debounces 150ms, manages one AbortController per query, dispatches `setSearchMatches`
- Polymorphic TimelineList: accepts `VirtualItem[]` + `rows[]`; mixed heights (header=24px, gap-banner=20px, row=28px); tracks topmost visible group for StickyGroupBar via `onTopGroupChange`
- GroupHeaderRow + GapBannerRow: correct labels, duration formatting, aria attributes, CSS token colors
- AppShell Phase 3 layout: FilterBar → [ActiveFilterChips?] → flex[StickyGroupBar+TimelineRegion | DetailPanel]
- Keyboard: `/` focuses search, `Esc` priority order (search→filters→selection), `g s` chord cycles grouping
- EventRow: `ShieldAlert` when `isAuthFailure`; `highlightMatches` wraps matches in `<mark>` elements
- StatusBar: `{visible}/{total} visible` and `· {N} groups` segments when filtered/grouped
- All 149 UI tests + 77 boundary tests green; build + typecheck clean

## Task Commits

1. **Task 1: Search client + useSearch + polymorphic TimelineList + grouping components** - `0fea78d` (feat)
2. **Task 2: AppShell assembly + TimelineRegion keyboard + EventRow auth glyph + StatusBar** - `2e524a8` (feat)

## Files Created/Modified

- `packages/ui/src/transport/search-client.ts` — `searchEvents()` fetch; AbortSignal conditional spread
- `packages/ui/src/transport/search-client.test.ts` — 11 tests: fetch URL, shape, abort, useSearch debounce
- `packages/ui/src/components/filters/useSearch.ts` — debounced hook; AbortController lifecycle
- `packages/ui/src/components/timeline/GroupHeaderRow.tsx` — session/turn headers; duration formatter; collapse toggle
- `packages/ui/src/components/timeline/GapBannerRow.tsx` — gap display with AlertTriangle and aria-label
- `packages/ui/src/components/timeline/StickyGroupBar.tsx` — sticky label above list; null-safe
- `packages/ui/src/components/timeline/grouping.test.tsx` — 18 tests for all new timeline components
- `packages/ui/src/components/timeline/TimelineList.tsx` — polymorphic VirtualItem[]; mixed estimateSize; onTopGroupChange
- `packages/ui/src/components/timeline/TimelineList.virt.test.tsx` — updated to new items/rows API
- `packages/ui/src/components/timeline/TimelineRegion.tsx` — keyboard handler; filteredRowIdxs navigation; searchInputRef; onTopGroupChange
- `packages/ui/src/components/timeline/EventRow.tsx` — ShieldAlert glyph; highlightMatches helper; searchQuery prop
- `packages/ui/src/components/shell/AppShell.tsx` — full Phase 3 assembly replacing DetailRailPlaceholder
- `packages/ui/src/components/shell/StatusBar.tsx` — visibleCount/totalCount/groupCount segments
- `packages/ui/src/components/filters/FilterBar.tsx` — searchInputRef prop; conditional spread to SearchInput
- `packages/ui/src/components/filters/SearchInput.tsx` — ref prop (React 19); forwarded to input element

## Decisions Made

- `search-client.ts`: conditional spread `...(signal !== undefined ? { signal } : {})` required because `RequestInit.signal` is `AbortSignal | null` (not `| undefined`); `exactOptionalPropertyTypes` forbids `{ signal: undefined }`
- `TimelineList.onSelect`: wraps `store.selectIdx` in `(idx) => select(idx)` lambda to adapt `(number|null) → void` to `number → void`  
- All optional callback props use conditional spread pattern at call sites (exactOptionalPropertyTypes enforcement)
- `SearchInput` accepts `ref` as a plain prop (React 19 — no `forwardRef` needed)
- `highlightMatches`: uses React `<mark>` elements with CSS variable colors, never innerHTML — XSS safe per T-03-05-03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test import path in grouping.test.tsx**
- **Found during:** Task 1 (RED phase)
- **Issue:** Initial test import used `'../../../state/selectors.js'` (3 levels up) but file is 2 levels from `src/`
- **Fix:** Changed to `'../../state/selectors.js'`
- **Files modified:** `packages/ui/src/components/timeline/grouping.test.tsx`
- **Committed in:** `0fea78d` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed useSearch "clear matches" test timing**
- **Found during:** Task 1 (GREEN/verify phase)
- **Issue:** Test used `vi.advanceTimersByTime(10)` (sync) after Zustand state update — React effects hadn't flushed
- **Fix:** Changed to `await vi.advanceTimersByTimeAsync(0)` to flush pending microtasks/effects
- **Files modified:** `packages/ui/src/transport/search-client.test.ts`
- **Committed in:** `0fea78d` (Task 1 commit)

**3. [Rule 1 - Bug] Fixed TimelineList.virt.test.tsx for new API**
- **Found during:** Task 1 (implementation)
- **Issue:** Existing test passed `rows={fixture}` which is the old `TimelineListProps`; new API requires `items` + `rows`
- **Fix:** Added `fixtureItems: VirtualItem[]` and updated render call to `items={fixtureItems} rows={fixture}`
- **Files modified:** `packages/ui/src/components/timeline/TimelineList.virt.test.tsx`
- **Committed in:** `0fea78d` (Task 1 commit)

**4. [Rule 1 - Bug] Fixed exactOptionalPropertyTypes violations in TimelineList estimateSize**
- **Found during:** Task 2 (typecheck)
- **Issue:** `items[i] ?? { kind: "row" }` created an invalid fallback lacking `rowIdx`, causing type error
- **Fix:** Changed to explicit guard: `const item = items[i]; if (!item) return 28; return ITEM_HEIGHT[...]`
- **Files modified:** `packages/ui/src/components/timeline/TimelineList.tsx`
- **Committed in:** `2e524a8` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (4 Rule 1 bugs)
**Impact on plan:** All fixes necessary for correctness/TypeScript compliance. No scope creep.

## Issues Encountered

None - TypeScript errors caught by `pnpm typecheck` and resolved in one pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 is now fully assembled: all components wired into AppShell
- Search, filtering, grouping, gap detection, auth-failure rail all operational
- Phase 4 (e2e and perf) can verify the end-to-end flow including search, keyboard shortcuts, and group rendering
- Phase 5 (packaging) can proceed with the complete UI

---
*Phase: 03-detail-search-and-filtering*
*Completed: 2026-05-07*
