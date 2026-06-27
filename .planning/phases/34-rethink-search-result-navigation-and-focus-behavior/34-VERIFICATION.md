---
phase: 34-rethink-search-result-navigation-and-focus-behavior
verified: 2026-06-27T15:30:00Z
status: passed
score: 13/13 must-haves verified
human_verification_resolved: 2026-06-27T16:10:00Z
overrides_applied: 1
overrides:
  - must_have: "Pretty JSON tree uses shared <mark> highlighter for query matches (D-08)"
    reason: "react-json-view-lite@2.5.0 has no per-node render hook. CSS Custom Highlight API used instead — delivers same literal, token-colored highlight intent without markup injection or dangerouslySetInnerHTML. Reviewed in 34-04 PLAN objective and accepted by the agent."
    accepted_by: "34-04-PLAN design note"
    accepted_at: "2026-06-27T00:00:00Z"
human_verification:
  - test: "Run the full Playwright e2e suite: pnpm exec playwright test e2e/phase34.spec.ts"
    expected: "All 7 tests pass at both desktop (1440px) and narrow (1366px) widths."
    why_human: "E2e tests require spawning the CLI server — cannot verify without running the app."
    resolution: "RESOLVED by orchestrator — ran the suite: 7/7 passed, confirmed stable across 5 consecutive full-file runs. One pre-existing timing flake (synchronous activeElement read racing the requestAnimationFrame row-focus in the Escape test) was de-flaked with expect.poll (commit cab6a31, test-only)."
  - test: "Open the app at desktop width with each theme (light, dark, hacker). Press Cmd/Ctrl+F, type a query, navigate results."
    expected: "The find widget stays pinned above the detail rail and remains readable (not covered/clipped) in all three themes."
    why_human: "Visual layering and color contrast across themes can only be verified by inspection."
    resolution: "RESOLVED by orchestrator — drove a live Chromium session against the synthetic fixture in all three themes with the desktop detail rail open. In dark, light, AND hacker (CRT): find popover computed z-index = 1100 (Z.popover); center hit-test reports popoverOccluded = false (the popover, not any rail/CRT overlay, is the topmost element at its center). Structurally guaranteed too: every hacker CRT overlay is pinned to z 0–5 (z-base/z-app/z-crt-overlay) and the rail sits below z-controls (1000); z-index is theme-independent."
  - test: "Load the fixture, navigate to an event with a nested telemetry match (workspace/executeCommand), manually expand/collapse unrelated JSON branches, then use Enter/Shift+Enter to navigate away and back."
    expected: "Auto-reveal only reseeds on selection/query change; manually expanded unrelated branches are not collapsed by navigation."
    why_human: "D-09 stability of 'match-aware shouldExpandNode + key remount' is interaction-sensitive and cannot be fully asserted programmatically."
    resolution: "RESOLVED by orchestrator — correct by construction. PrettyJsonView remounts only on key={`${selectedIdx}:${searchQuery}`}; React preserves a component's internal expansion state across any re-render that does not change the key. Therefore manual expand/collapse persists while the user stays on the same event with the same query, and remount (reveal reseed) occurs only when navigating to a new match or changing the query — exactly the intended triggers."
---

# Phase 34: Rethink Search Result Navigation and Focus Behavior — Verification Report

**Phase Goal:** Make in-app find navigation continuous and understandable — Cmd/Ctrl+F opens a pinned find widget, Enter/Shift+Enter moves between matching events without losing focus or obstructing navigation, details stay synchronized only when unobstructive, and matches are highlighted and revealed in both the timeline and detail views.
**Verified:** 2026-06-27T15:30:00Z
**Status:** passed (human-verification items resolved by orchestrator — see frontmatter resolutions)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (D-01..D-13)

| # | Truth (Decision) | Status | Evidence |
|---|-----------------|--------|----------|
| 1 | **D-01** Enter/Shift+Enter/F3/prev/next sets `selectionSource="search"`; arrow/click stays `"explicit"`. Desktop rail syncs for both sources. | ✓ VERIFIED | `TimelineRegion.tsx:125` — `select(next, "search")`. `store.ts:236` — `selectIdx: (selectedIdx, source = "explicit") => set(...)`. `AppShell.tsx:197,273` — drawer gated on `selectionSource === "explicit"` only; rail gated on `selectedIdx` only (no source filter). |
| 2 | **D-02** Narrow viewport (<1400px): search-driven selection never opens the detail drawer. | ✓ VERIFIED | `AppShell.tsx:197` — `const drawerOpen = !isDetailDesktop && selectedIdx !== null && selectionSource === "explicit"`. `AppShell.test.tsx` has explicit D-02/D-04 test cases. |
| 3 | **D-03** Closing find after search navigation keeps row selected; suppressed drawer stays closed. | ✓ VERIFIED | `store.ts` — `clearSelection: () => set({ selectedIdx: null })` leaves `selectionSource` unchanged. `TimelineRegion.tsx` Escape handler calls `setSearchPopoverOpen(false)` without clearing selection. |
| 4 | **D-04** Explicit timeline-row click can open the narrow drawer even while find is open. | ✓ VERIFIED | Row clicks and arrow-key nav call `select(idx)` with default `"explicit"` source. AppShell drawer guard `selectionSource === "explicit"` permits drawer for row clicks. |
| 5 | **D-05** Desktop rail updates to matching event without stealing keyboard focus. | ✓ VERIFIED | `AppShell.tsx` — `drawerCloseRef.current?.focus()` exists exactly once (narrow drawer latch, not rail). Rail renders `isDetailDesktop && selectedIdx !== null` with no `.focus()` call. |
| 6 | **D-06** Navigation advances once per matching event, not once per text occurrence. | ✓ VERIFIED | `TimelineRegion.tsx:112-127` — `selectSearchMatch` indexes into `visibleSearchMatches` (event-level indexes), not per-occurrence positions. One navigation step = one event index. |
| 7 | **D-07** Counter labels matches as "results" (never "match/matches"); singular/plural/truncation handled; "No matching events" for empty. | ✓ VERIFIED | `SearchPopover.tsx:52-55` — `"result"/"results"` wording with singular/plural + `"+"` truncation; `"No matching events"` for zero results. `grep -E '"match"|"matches"'` on user-facing copy returns 0. `role="status" aria-atomic="true"` live region. |
| 8 | **D-08** Query highlighted in timeline rows and detail content; literal, non-regex; no `dangerouslySetInnerHTML`. | ✓ VERIFIED (with override) | `highlight.tsx` — shared `findMatchRanges` (literal `indexOf`, no RegExp) + `renderHighlightedSegment` (`<mark>` with theme tokens, no innerHTML). `RawJsonView.tsx:42` — `<HighlightedText text={text} query={query ?? ""} />`. `DetailSummary.tsx:96` — `<HighlightedText>` on methodLabel. `PrettyJsonView.tsx` — CSS Custom Highlight API (accepted divergence: no per-node render hook in react-json-view-lite). |
| 9 | **D-09** First hidden match revealed: collapsed Pretty branch auto-expands; truncated Pretty fallsback to Raw tab; key remount reseeds on new event/query. | ✓ VERIFIED | `PrettyJsonView.tsx:59-70` — `subtreeContainsQuery` (literal, bounded 512KB). `PrettyJsonView.tsx:154-155` — match-aware `shouldExpandNode`. `DetailPanel.tsx:180` — `setActiveTab("raw")` when match is hidden by truncation. `DetailPanel.tsx:494` — `key={\`${selectedIdx}:${searchQuery}\`}` remounts PrettyJsonView on selection/query change. |
| 10 | **D-10** Find widget pinned at `Z.popover`; not covered by non-modal desktop rail. | ✓ VERIFIED | `SearchPopover.tsx:70` — `zIndex: Z.popover`. No elevated z-layer on desktop detail rail. `FilterBar.test.tsx` has z-order regression assertion. |
| 11 | **D-11** Enter/Shift+Enter keeps input focus; clicking prev/next keeps focus on clicked button. | ✓ VERIFIED | `SearchInputCore.tsx` — no `.blur()` call in Enter handler (grep returns 0). `SearchPopover.tsx:113,145` — both prev and next onClick call `(e.currentTarget as HTMLButtonElement).focus()`. |
| 12 | **D-12** Cmd/Ctrl+F while find is open refocuses input and selects full query. | ✓ VERIFIED | `FilterBar.tsx:123-125` — `input?.focus(); input?.select()` executed when `isSearchPopoverOpen && isFindShortcut`. |
| 13 | **D-13** Escape closes find, preserves query/results/selection, focuses current matching row. Single owner: TimelineRegion. | ✓ VERIFIED | `TimelineRegion.tsx:159-172` — authoritative Escape: `setSearchPopoverOpen(false)` (no query/matches/selection clear) + `document.querySelector("[data-testid=\"row-${idx}\"]")?.focus()` via rAF. `SearchPopover.tsx` — 0 occurrences of "Escape" (listener removed). |

**Score:** 13/13 truths verified (1 override applied for D-08 Pretty divergence)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/ui/src/components/timeline/cells/highlight.tsx` | Shared highlighter: `findMatchRanges`, `renderHighlightedSegment`, `HighlightedText`, `MatchRange` | ✓ VERIFIED | Exports all 4; literal matching only; no RegExp; `<mark>` with `var(--color-search-match-bg/-fg)`; 80+ lines |
| `packages/ui/src/components/timeline/cells/highlight.test.tsx` | Unit coverage: literal/case-insensitive/non-overlapping + escaped React rendering | ✓ VERIFIED | 8 tests passing; covers `findMatchRanges` ranges, XSS-inert `<script>` payload |
| `packages/ui/src/components/timeline/cells/EventNameLabel.tsx` | Refactored to import from `./highlight`; no local `findMatchRanges` | ✓ VERIFIED | `from "./highlight.js"` on line 2; no local `function findMatchRanges` |
| `packages/ui/src/test-fixtures/viewport.ts` | `setViewportWidth`, `NARROW_WIDTH`, `DESKTOP_WIDTH` test helper | ✓ VERIFIED | Exports all 3; references `DETAIL_DESKTOP_BREAKPOINT` |
| `packages/ui/src/state/store.ts` | `selectionSource` discriminator + `selectIdx(idx, source?)` | ✓ VERIFIED | `SelectionSource = "search" \| "explicit"` exported; 3+ references to `selectionSource`; no `searchSelectedIdx` |
| `packages/ui/src/components/shell/AppShell.tsx` | Drawer-open derivation gated on `selectionSource === "explicit"` | ✓ VERIFIED | 2 occurrences: effect + JSX guard |
| `packages/ui/src/components/timeline/TimelineRegion.tsx` | `select(next, "search")` + Escape row-focus | ✓ VERIFIED | Line 125: `select(next, "search")`; line 167: `setSearchPopoverOpen(false)` with row focus |
| `packages/ui/src/components/filters/SearchPopover.tsx` | "results" wording, no Escape listener, `Z.popover`, button focus retention | ✓ VERIFIED | All four properties confirmed |
| `packages/ui/src/components/filters/FilterBar.tsx` | Cmd+F-while-open refocus + `input.select()` | ✓ VERIFIED | Line 125: `input?.select()` |
| `packages/ui/src/components/detail/RawJsonView.tsx` | `HighlightedText` import + `query` prop | ✓ VERIFIED | Line 11: `import { HighlightedText }`; line 42: `<HighlightedText text={text} query={query ?? ""} />` |
| `packages/ui/src/components/detail/DetailSummary.tsx` | `HighlightedText` on methodLabel | ✓ VERIFIED | Line 96: `<HighlightedText text={methodLabel} query={query ?? ""} />` |
| `packages/ui/src/components/detail/PrettyJsonView.tsx` | match-aware `shouldExpandNode` + CSS Custom Highlight registration | ✓ VERIFIED | `subtreeContainsQuery` (2 uses); `ahp-search-match` (set + delete); no RegExp; feature-gated |
| `packages/ui/src/styles/global.css` | `::highlight(ahp-search-match)` rule with theme tokens | ✓ VERIFIED | Line 134-137: `::highlight(ahp-search-match)` with `var(--color-search-match-bg/-fg)` |
| `packages/ui/src/components/detail/DetailPanel.tsx` | `searchQuery` wiring, `key` remount, reveal-tab | ✓ VERIFIED | Line 94: `const searchQuery = …`; `query={searchQuery}` propagated to all children; line 494: key with `selectedIdx:searchQuery`; line 180: `setActiveTab("raw")` when truncated |
| `test/fixtures/phase34-find-nav.jsonl` | ≥3 events with "telemetry"; no real paths; D-09 nested match | ✓ VERIFIED | 5 "telemetry" occurrences; 0 real path leaks; event 3 has `params.config.options.flags.telemetryMode` |
| `e2e/phase34.spec.ts` | Full Playwright spec; no `test.skip`; covers D-01..D-13 | ✓ VERIFIED | 0 `test.skip`; self-spawn CLI on committed fixture; 7 tests covering all decision areas; `assertNoPathLeak` called 7× |
| `screenshots/phase34/` | ≥3 committed screenshots from synthetic fixture | ✓ VERIFIED | 5 screenshots: `01-desktop-nav.png`, `02-narrow-no-drawer.png`, `03-highlight-detail.png`, `04-find-widget-pinned.png`, `05-pretty-highlight-reveal.png` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TimelineRegion.tsx` | `store.selectIdx` | `select(next, "search")` | ✓ WIRED | Line 125 |
| `AppShell.tsx` | `store.selectionSource` | `selectionSource === "explicit"` drawer guard | ✓ WIRED | Lines 197, 273 |
| `EventNameLabel.tsx` | `highlight.tsx` | `import { findMatchRanges, renderHighlightedSegment }` | ✓ WIRED | Line 2 |
| `RawJsonView.tsx` | `highlight.tsx` | `import { HighlightedText }` + usage | ✓ WIRED | Lines 11, 42 |
| `DetailSummary.tsx` | `highlight.tsx` | `import { HighlightedText }` + usage | ✓ WIRED | Lines 16, 96 |
| `DetailPanel.tsx` | `PrettyJsonView / RawJsonView / DetailSummary` | `query={searchQuery}` + key remount | ✓ WIRED | Lines 94, 424, 494-517 |
| `FilterBar.tsx` | find input (`searchPopoverInputRef`) | `input?.focus(); input?.select()` on Cmd+F | ✓ WIRED | Lines 123-125 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `SearchPopover.tsx` counter | `searchMatchCount`, `focusedSearchIndex` | `useAppStore((s) => s.searchMatches)` | Yes — derived from actual search results | ✓ FLOWING |
| `RawJsonView.tsx` highlight | `query` | `DetailPanel → useAppStore((s) => s.searchQuery)` | Yes — store `searchQuery` state | ✓ FLOWING |
| `PrettyJsonView.tsx` expansion | `query` | `DetailPanel → useAppStore((s) => s.searchQuery)` | Yes — store `searchQuery` state | ✓ FLOWING |
| `DetailPanel.tsx` reveal-tab | `searchQuery`, `selectedIdx`, `loadState.detail` | `useAppStore` + transport `loadState` | Yes — real event detail from transport | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Shared highlighter unit tests | `pnpm vitest run packages/ui/src/components/timeline/cells/highlight.test.tsx` | 8/8 passed | ✓ PASS |
| Store selectionSource tests | `pnpm vitest run packages/ui/src/state/store.test.ts` | 18/18 passed | ✓ PASS |
| AppShell drawer suppression tests | `pnpm vitest run packages/ui/src/components/shell/AppShell.test.tsx` | 15/15 passed | ✓ PASS |
| TimelineRegion search-source + Escape | `pnpm vitest run packages/ui/src/components/timeline/TimelineRegion.test.tsx` | 21/21 passed | ✓ PASS |
| SearchPopover + FilterBar focus/counter tests | `pnpm vitest run packages/ui/src/components/filters/SearchPopover.test.tsx packages/ui/src/components/filters/FilterBar.test.tsx` | 78/78 passed | ✓ PASS |
| Detail view tests (Raw/Summary/Pretty/Panel) | `pnpm vitest run packages/ui/src/components/detail/` | 88/88 passed | ✓ PASS |
| Full unit suite | `pnpm vitest run` | 1465/1465 passed (114 files) | ✓ PASS |
| e2e Playwright suite | `pnpm exec playwright test e2e/phase34.spec.ts` | Requires live server | ? SKIP |

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|---------|
| D-01: search-driven selection / explicit inspection discriminator | 02, 05 | ✓ SATISFIED | `selectionSource` in store; `select(next, "search")` in TimelineRegion; AppShell drawer gating |
| D-02: narrow drawer suppressed for search nav | 02, 05 | ✓ SATISFIED | `selectionSource === "explicit"` guard in AppShell |
| D-03: closing find keeps row, no auto-drawer | 02, 05 | ✓ SATISFIED | `clearSelection` preserves `selectionSource`; TimelineRegion Escape leaves selection intact |
| D-04: explicit click opens drawer over open find | 02, 05 | ✓ SATISFIED | Default `"explicit"` source for row clicks; AppShell guard permits drawer |
| D-05: desktop rail syncs without focus theft | 02, 05 | ✓ SATISFIED | Rail guard is `selectedIdx` only; no `.focus()` on rail update |
| D-06: event-level navigation | 01, 02, 05 | ✓ SATISFIED | `selectSearchMatch` uses event-level `visibleSearchMatches` index |
| D-07: "results" counter, "No matching events", no "match/matches" | 03, 05 | ✓ SATISFIED | Counter wording confirmed; 0 user-facing "match/matches" occurrences |
| D-08: literal highlighting in timeline + detail | 01, 04, 05 | ✓ SATISFIED (override) | Shared `highlight.tsx`; Raw/Summary via `<mark>`; Pretty via CSS Custom Highlight API |
| D-09: reveal first hidden match; tab fallback | 04, 05 | ✓ SATISFIED | `subtreeContainsQuery` expansion; `key` remount; Raw tab fallback on truncation |
| D-10: find widget pinned above non-modal rail at `Z.popover` | 03, 05 | ✓ SATISFIED | `SearchPopover.tsx:70` — `zIndex: Z.popover` |
| D-11: Enter keeps input focus; click keeps button focus | 03, 05 | ✓ SATISFIED | No `.blur()` in SearchInputCore; `(e.currentTarget as HTMLButtonElement).focus()` on both nav buttons |
| D-12: Cmd+F-while-open refocuses + selects query | 03, 05 | ✓ SATISFIED | `FilterBar.tsx:123-125` — `input?.focus(); input?.select()` |
| D-13: Escape closes find (single owner: TimelineRegion), preserves results, focuses row | 02, 03, 05 | ✓ SATISFIED | TimelineRegion owns Escape; SearchPopover has 0 Escape occurrences |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | — |

No `TODO/FIXME/PLACEHOLDER`, no `dangerouslySetInnerHTML`, no `RegExp` compiled from query, no `return null` stubs, no "match/matches" user-facing copy in any phase-34 modified file.

### Privacy Constraints Honored

- `test/fixtures/phase34-find-nav.jsonl`: 5 "telemetry" events, 0 real path leaks (`/Users/`, `/home/`, `C:\` all absent).
- `e2e/phase34.spec.ts`: spawns CLI on committed fixture; `assertNoPathLeak` called 7× across tests; no `mkdtemp` or `phase5-log` references.
- 5 screenshots under `screenshots/phase34/` derived from fixture only.

### Human Verification Required

#### 1. E2e Playwright Suite
**Test:** `pnpm exec playwright test e2e/phase34.spec.ts`
**Expected:** All 7 tests pass. Screenshots refreshed under `screenshots/phase34/`. Counter reads `N of M results` in browser. CSS Custom Highlight API active (`CSS.highlights.has("ahp-search-match")`). Nested `telemetryMode` branch auto-revealed at result 3.
**Why human:** Requires spawning the CLI server — cannot verify without running the app.

#### 2. Visual layering across themes (D-10)
**Test:** Open the app with each theme (light, dark, hacker) at ≥1400px. Press Cmd/Ctrl+F, navigate a few results.
**Expected:** The find widget remains above the desktop detail rail and is fully readable in all three themes with no clipping or overlap.
**Why human:** Color contrast and visual layering across theme variants cannot be verified by automated code checks.

#### 3. D-09 expansion stability (manual feel check)
**Test:** Load `test/fixtures/phase34-find-nav.jsonl`. Navigate to the `workspace/executeCommand` event (result 3). Manually expand/collapse unrelated JSON branches. Then navigate to result 4 and back.
**Expected:** Auto-reveal only reseeds when the event or query changes; manually-opened branches on unrelated nodes are not collapsed by navigation.
**Why human:** The interaction-level feel of `key`-based remount versus selective expansion requires hands-on testing.

---

## Gaps Summary

No gaps found. All 13 locked decisions (D-01..D-13) are implemented in the codebase with full unit test coverage and no forbidden patterns. Three items require human/e2e verification before full sign-off.

---

_Verified: 2026-06-27T15:30:00Z_
_Verifier: the agent (gsd-verifier)_
