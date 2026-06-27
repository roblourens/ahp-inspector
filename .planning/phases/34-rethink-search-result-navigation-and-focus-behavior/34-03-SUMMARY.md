---
phase: 34-rethink-search-result-navigation-and-focus-behavior
plan: 03
subsystem: filters-search-widget
tags: [react, focus-management, find-widget, keyboard, z-order, copywriting]

requires:
  - phase: 34-02
    provides: "TimelineRegion owns Escape (close find + focus current row); store selectionSource discriminator"
provides:
  - "Event-oriented find counter copy: '{n} of {m} results' / '{m} results' / 'No matching events' / 'Search failed: {error}' (never 'match/matches')"
  - "Find popover pinned at Z.popover above the non-modal desktop detail rail (D-10)"
  - "Enter/Shift+Enter retains focus in the find input; clicking prev/next retains focus on the clicked button (D-11)"
  - "Cmd/Ctrl+F while find already open refocuses the input and select()s the current query (D-12)"
  - "SearchPopover no longer self-handles Escape — single Escape owner is TimelineRegion (D-13 contract)"
affects:
  - "34-05 (e2e — exercises counter copy, focus retention, Cmd+F refocus, pinned widget over rail)"

tech-stack:
  added: []
  patterns:
    - "Results-oriented counter copy with singular/plural + '+' truncation handling"
    - "Cmd+F-while-open refocus+select instead of early-return swallow"
    - "Focus retention on Enter (input) and nav-button click (button); no focus theft into details"
    - "Single Escape owner (TimelineRegion) — SearchPopover Escape listener removed to avoid double-handling"

key-files:
  created: []
  modified:
    - packages/ui/src/components/filters/SearchPopover.tsx
    - packages/ui/src/components/filters/SearchPopover.test.tsx
    - packages/ui/src/components/filters/FilterBar.tsx
    - packages/ui/src/components/filters/FilterBar.test.tsx
    - packages/ui/src/components/filters/SearchInputCore.tsx
    - packages/ui/src/components/filters/SearchInputCore.test.tsx

key-decisions:
  - "Counter copy reports matching events as 'results' (D-07); zero-match copy is 'No matching events' per UI-SPEC (prohibited 'No results' avoided)"
  - "Error copy interpolates the error and falls back to a recovery hint when empty"
  - "D-10 pinned placement was already satisfied structurally (popover lives in FilterBar above app-main at Z.popover) — verified, not re-laid-out"
  - "Removed SearchPopover's own Escape keydown listener so TimelineRegion (Plan 02) is the single Escape authority that focuses the current row (D-13)"

patterns-established:
  - "Find widget keyboard/focus contract: input keeps focus on Enter; nav buttons keep focus on click; Cmd+F re-selects query"

requirements-completed: [D-07, D-10, D-11, D-12, D-13]

duration: ~18min
completed: 2026-06-27
---

# Phase 34 Plan 03: Find widget results counter, pinned placement, focus retention, Cmd+F refocus Summary

**Reworked the find widget's copy and focus behavior: the counter now reports event-oriented "results" (never "match/matches"), the widget stays pinned at `Z.popover` above the non-modal desktop detail rail, Enter/Shift+Enter keeps focus in the input while nav-button clicks keep focus on the button, a second Cmd/Ctrl+F refocuses and selects the query for replacement, and SearchPopover no longer double-handles Escape (TimelineRegion is the single authority).**

## Performance

- **Tasks:** 3 of 3
- **Files modified:** 6 (0 created, 6 modified)
- **Completed:** 2026-06-27

## Accomplishments

### Task 1 — Event-oriented results counter + remove SearchPopover Escape listener (`b85f9f2`)
- `SearchPopover.tsx` counter copy now reads `"{n} of {m} results"` / `"{m} results"` with singular/plural and `+` truncation handling; zero-match state is `"No matching events"`; error state interpolates `{searchError}` with a recovery fallback (D-07).
- Prev/next `aria-label`s reworded to results language.
- Removed SearchPopover's own `Escape` `keydown` listener so Escape is owned solely by TimelineRegion (Plan 02), which closes find and focuses the current row (D-13 contract). Verified D-10: popover renders inside FilterBar above `app-main` at `Z.popover` — structurally pinned above the non-modal rail, no relayout required.

### Task 2 — Cmd+F-while-open refocuses + selects query (`6424166`)
- `FilterBar.tsx`: the keydown handler no longer early-returns when the popover is already open; a second Cmd/Ctrl+F now refocuses `searchPopoverInputRef` and calls `input.select()` to select the current query for replacement, keeping `e.preventDefault()` so the OS find dialog never appears (D-12).

### Task 3 — Retain focus on Enter and on clicked nav button (`e3f88c0`)
- `SearchInputCore.tsx` / `SearchPopover.tsx`: Enter/Shift+Enter dispatch navigation without blurring the input (focus stays in the find input); clicking prev/next keeps focus on the clicked button (D-11). Added `SearchInputCore.test.tsx` coverage.

## Verification

- `pnpm vitest run` SearchPopover + FilterBar → **78 tests pass (2 files)**; SearchInputCore tests added and passing.
- Acceptance grep gates confirmed: `Z.popover` present in SearchPopover; counter uses `result`/`results` and `No matching events` (no `match/matches`); `input?.select()` present in FilterBar Cmd+F handler.
- Theme tokens only; no hex, no new dependencies, no transport/protocol changes.

## Deviations from Plan

- Closeout bookkeeping note: the executor agent committed all three task changes but terminated before writing this SUMMARY and updating STATE/ROADMAP (interrupted at a runtime tool/model switch). The orchestrator completed the closeout after verifying all three task commits were present and all 78 touched tests pass green. No source work was redone or changed.

## Threat Surface

- **T-34 usability/focus:** mitigated — focus retention and single-owner Escape prevent focus theft; Cmd+F `preventDefault` keeps OS find suppressed. Covered by SearchPopover/FilterBar tests.
- No new threat surface: client-only filter UI, no network/transport/protocol changes, no new dependencies, literal (non-regex) query handling unchanged.

## Known Stubs

None. All wired and tested.

## Self-Check: PASSED
- FOUND: packages/ui/src/components/filters/SearchPopover.tsx (Z.popover; "results"; "No matching events"; no Escape listener)
- FOUND: packages/ui/src/components/filters/FilterBar.tsx (input?.select() in Cmd+F handler)
- FOUND: packages/ui/src/components/filters/SearchInputCore.tsx (+ SearchInputCore.test.tsx focus retention)
- FOUND commits: b85f9f2 (Task1), 6424166 (Task2), e3f88c0 (Task3)
- 78 tests pass across SearchPopover + FilterBar.
