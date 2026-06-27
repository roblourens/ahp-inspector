---
phase: 34-rethink-search-result-navigation-and-focus-behavior
plan: 02
subsystem: timeline-search
tags: [zustand, react, focus-management, responsive-drawer, selection-source]

requires:
  - phase: 34-01
    provides: "shared highlighter (cells/highlight.tsx) — independent; not consumed by this plan"
provides:
  - "store SelectionSource discriminator: selectIdx(idx, source?) + selectionSource field (single field, no duplicate index)"
  - "AppShell narrow drawer gated on selectionSource === \"explicit\" (search nav never opens/focuses drawer; clicks still do)"
  - "TimelineRegion search nav routes through source=\"search\"; Escape closes find non-destructively and focuses the current matching row"
  - "test-fixtures/viewport.ts narrow/desktop breakpoint helper (this plan only)"
affects:
  - "34-03 (SearchPopover Escape removal — relies on TimelineRegion now owning Escape)"
  - "34-04 (detail highlight/reveal — builds on selection sync)"
  - "34-05 (e2e — exercises drawer suppression + Escape focus end-to-end)"

tech-stack:
  added: []
  patterns:
    - "Single selection-source discriminator on the store (no parallel searchSelectedIdx) — D-01..D-05 spine"
    - "Drawer-open derivation gated on selectionSource === \"explicit\" to prevent search-driven focus theft (Pitfall 1)"
    - "Escape authoritative in TimelineRegion: setSearchPopoverOpen(false) + requestAnimationFrame row focus, preserving query/results/selection/source (D-13/D-03)"
    - "Shared jsdom viewport helper for the 1400px detail breakpoint"

key-files:
  created:
    - packages/ui/src/test-fixtures/viewport.ts
  modified:
    - packages/ui/src/state/store.ts
    - packages/ui/src/state/store.test.ts
    - packages/ui/src/components/shell/AppShell.tsx
    - packages/ui/src/components/shell/AppShell.test.tsx
    - packages/ui/src/components/timeline/TimelineRegion.tsx
    - packages/ui/src/components/timeline/TimelineRegion.test.tsx

key-decisions:
  - "One selectionSource field beside selectedIdx; no duplicate index (the agent's-Discretion guidance, RESEARCH anti-pattern)"
  - "clearSelection preserves selectionSource (Open Question 1 RESOLVED) so closing find never pops the suppressed drawer (D-03)"
  - "Escape does NOT flip source to explicit — preserved \"search\" selection stays drawer-suppressed even after a later narrow resize"
  - "Existing EventRow already exposes data-testid=row-{idx} with tabIndex (0 when selected); no TimelineList change needed for Escape focus"

patterns-established:
  - "selectionSource discriminator: search-driven nav sets \"search\", explicit clicks/arrow-keys set \"explicit\" (default arg)"
  - "Drawer suppression for search selections; desktop rail syncs for both without stealing find-input focus"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-13]

duration: ~12min
completed: 2026-06-27
---

# Phase 34 Plan 02: Selection-source discriminator + drawer suppression + Escape row focus Summary

**Introduced a single `selectionSource: "search" | "explicit"` store discriminator and rewired search navigation, the narrow-screen detail drawer, and Escape so repeated Enter/Shift+Enter/F3 never opens or re-focuses the drawer while explicit clicks still do — and Escape closes find non-destructively, landing keyboard focus on the current matching row.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-27T19:50Z
- **Completed:** 2026-06-27T19:56Z
- **Tasks:** 3 of 3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

### Task 1 — `selectionSource` store discriminator (TDD)
- Exported `SelectionSource = "search" | "explicit"`, added `selectionSource` state field (default `"explicit"`), and changed `selectIdx(idx, source = "explicit")` to set both fields in one `set()`.
- `clearSelection()` left unchanged — intentionally **preserves** `selectionSource` (D-03 / Open Question 1).
- **No** parallel `searchSelectedIdx` (RESEARCH anti-pattern — single index, single source of truth).
- RED (`3e83f8e`) → GREEN (`cecd60c`): 5 new store tests for default/search/explicit/flip-back/preserve-on-clear.

### Task 2 — Viewport helper + narrow-drawer gating
- Created `packages/ui/src/test-fixtures/viewport.ts` (`setViewportWidth`, `NARROW_WIDTH=1366`, `DESKTOP_WIDTH=1440`) derived from `DETAIL_DESKTOP_BREAKPOINT`.
- `AppShell.tsx`: reads `selectionSource`; the `drawerOpen` focus-effect derivation and the drawer JSX guard both now require `selectionSource === "explicit"` (effect dep array updated). The `drawerWasOpenRef`/`drawerCloseRef.current?.focus()` first-open latch is untouched and never added to the rail (D-05).
- Desktop rail render stays gated on `selectedIdx` only, so it syncs for search selections too (D-01).
- `AppShell.test.tsx`: switched to the shared helper and added D-01/D-02/D-03/D-04 cases (15 tests pass). Commit `cd227be`.

### Task 3 — Search-source nav + authoritative Escape
- `TimelineRegion.tsx`: `selectSearchMatch` now calls `select(next, "search")`, so prev/next/Enter/Shift+Enter/F3 (all routed through it) become `"search"`. Arrow/Page/Home/End nav stays default `"explicit"`.
- Escape (while find open) is now authoritative here: `setSearchPopoverOpen(false)` without clearing `searchQuery`/`searchMatches`/`selectedIdx`, then `requestAnimationFrame` focuses `[data-testid="row-{idx}"]`. Source is **not** flipped. The non-find Escape paths (clear search → clear selection) are preserved.
- `TimelineRegion.test.tsx`: added search-source assertion + Escape-closes-and-focuses-row test (uses offset override to render virtualized rows). 21 tests pass. Commit `5241602`.

## Verification

- `pnpm vitest run` store + AppShell + TimelineRegion → **54 tests pass (3 files)**.
- `pnpm -r typecheck` → all packages Done (new optional `selectIdx` arg compiles at every call site).
- `biome check` clean on all touched **source** files and both edited tests' additions (see Deferred below for one pre-existing test format nit).
- Acceptance grep gates for all three tasks pass:
  - store: `selectionSource`×3, type×1, `searchSelectedIdx`×0, `source = "explicit"`×1.
  - AppShell: `setViewportWidth`×1, `DETAIL_DESKTOP_BREAKPOINT`×3, `selectionSource === "explicit"`×2, focus latch×1, helper import×1.
  - TimelineRegion: `select(next, "search")`×1, `setSearchPopoverOpen(false)`×1, row selector×1, Escape-clear path present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-sorted imports in AppShell.test.tsx**
- **Found during:** Task 3 lint.
- **Issue:** The new `test-fixtures/viewport.js` import was appended after `./AppShell.js`, tripping Biome's organize-imports.
- **Fix:** Moved the viewport import into sorted position (after `store.js`).
- **Files modified:** `packages/ui/src/components/shell/AppShell.test.tsx`
- **Commit:** `5241602`

### Out of scope (not fixed)

- `TimelineRegion.test.tsx` has a **pre-existing** Biome format nit on the unrelated `stream-backlog-pill` assertion (line ~120, present with my changes stashed). Not introduced by this plan; left untouched per scope boundary. (Consistent with Plan 01's note of 44 pre-existing repo-wide lint issues.)

## Threat Surface

- **T-34-S2 (denial of focus / usability):** mitigated — drawer gating prevents repeated-Enter focus theft (Pitfall 1); Escape focus move is guarded by `selectedIdx !== null` + `requestAnimationFrame`. Covered by AppShell (D-02/D-04) and TimelineRegion (D-13) tests.
- **T-34-S1 (selectionSource tampering):** accepted per plan — pure local UI discriminator, type-safe, no persistence/network/external input.
- No new threat surface introduced (client-only state + focus; no server/transport/protocol changes; no new dependencies).

## Known Stubs

None. All wired and tested.

## Self-Check: PASSED
- FOUND: packages/ui/src/test-fixtures/viewport.ts
- FOUND: packages/ui/src/state/store.ts (selectionSource)
- FOUND: packages/ui/src/components/shell/AppShell.tsx (selectionSource === "explicit" ×2)
- FOUND: packages/ui/src/components/timeline/TimelineRegion.tsx (select(next, "search") + setSearchPopoverOpen(false))
- FOUND commits: 3e83f8e (test/RED), cecd60c (feat/GREEN Task1), cd227be (Task2), 5241602 (Task3)
- TDD gate (Task 1): RED (3e83f8e) → GREEN (cecd60c) present and ordered.
