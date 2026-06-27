---
phase: 34-rethink-search-result-navigation-and-focus-behavior
plan: 04
subsystem: ui
tags: [search, highlight, react, css-custom-highlight-api, react-json-view-lite, detail-panel]

# Dependency graph
requires:
  - phase: 34-01
    provides: shared HighlightedText / findMatchRanges highlighter (<mark> + theme tokens, literal matching)
  - phase: 34-02
    provides: selectionSource discriminator + search-driven selection sync
provides:
  - Active query highlighted in the Raw view and Summary method/actionType label via the shared <mark> highlighter (D-08)
  - Literal query occurrences highlighted in the Pretty JSON tree via the CSS Custom Highlight API (no markup injection) (D-08)
  - Match-aware shouldExpandNode + key remount that auto-expands and re-seeds the path to the first hidden match per selection/query (D-09)
  - Reveal fallback that switches to the Raw tab when a match is buried behind the >256KB Pretty truncation banner (D-09)
affects: [34-05, detail-panel, search-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS Custom Highlight API: Range objects over existing text nodes + ::highlight() pseudo, feature-detected, for highlighting third-party renderers with no per-node hook and no innerHTML"
    - "Match-aware shouldExpandNode + key={selectedIdx:query} remount to drive uncontrolled react-json-view-lite expansion"

key-files:
  created:
    - packages/ui/src/components/detail/RawJsonView.test.tsx
  modified:
    - packages/ui/src/components/detail/RawJsonView.tsx
    - packages/ui/src/components/detail/DetailSummary.tsx
    - packages/ui/src/components/detail/DetailSummary.fields.test.tsx
    - packages/ui/src/components/detail/PrettyJsonView.tsx
    - packages/ui/src/components/detail/PrettyJsonView.test.tsx
    - packages/ui/src/components/detail/DetailPanel.tsx
    - packages/ui/src/components/detail/DetailPanel.test.tsx
    - packages/ui/src/styles/global.css

key-decisions:
  - "Pretty tree highlighting uses the CSS Custom Highlight API rather than the UI-SPEC's literal <mark> element — a deliberate divergence, since wrapping <mark> around react-json-view-lite text would require swapping the renderer (forbidden) or innerHTML (forbidden). Raw + Summary still use <mark>."
  - "All matching is literal indexOf/includes (case-insensitive, query.length >= 2); never compiles a regular expression from the untrusted query (T-34-02)."
  - "subtree scan bounded at 512KB to avoid pathological JSON.stringify."
  - "Reveal logic only switches to Raw when the serialized event exceeds CLIENT_CAP_BYTES AND literally contains the query (match is in elided content); otherwise the tab is left untouched and Pretty expands to the match."

patterns-established:
  - "Feature-detected CSS Custom Highlight registration in a useEffect keyed on [data, query], with cleanup that deletes the named highlight."
  - "Per-selection expansion re-seed via key remount on the Pretty view."

requirements-completed: [D-08, D-09]

# Metrics
duration: 10min
completed: 2026-06-27
---

# Phase 34 Plan 04: Detail Query Highlight & Reveal Summary

**The selected event's detail now highlights the active search query across Raw (`<mark>`), Summary method label (`<mark>`), and the Pretty JSON tree (CSS Custom Highlight API), and reveals the first hidden match by auto-expanding the Pretty path or, when truncated, switching to the Raw tab.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-27T22:00Z
- **Completed:** 2026-06-27T22:09Z
- **Tasks:** 3 / 3
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments
- D-08: query highlight wired into Raw, Summary, and Pretty detail views, reusing the Plan-01 shared highlighter and the `--color-search-match-*` tokens.
- D-09: first hidden match revealed via match-aware `shouldExpandNode` + key remount, with a Raw-tab fallback when the match is behind the >256KB Pretty truncation banner.
- XSS/ReDoS safety preserved: no markup injection anywhere (React text children + `<mark>`, or `Range`-based highlights), all matching literal.

## Task Commits

1. **Task 1: Highlight Raw view and Summary via the shared highlighter (TDD)** - `267b6ce` (feat)
2. **Task 2: Pretty — match-aware expansion + CSS Custom Highlight** - `47829ce` (feat)
3. **Task 3: DetailPanel wiring — pass query, key remount, reveal tab** - `1fec3c3` (feat)

## Files Created/Modified
- `packages/ui/src/components/detail/RawJsonView.tsx` - Renders payload text via shared `HighlightedText`.
- `packages/ui/src/components/detail/RawJsonView.test.tsx` - New: highlight + inert-payload tests.
- `packages/ui/src/components/detail/DetailSummary.tsx` - Optional `query` prop; method label highlighted.
- `packages/ui/src/components/detail/DetailSummary.fields.test.tsx` - Added method-label highlight tests.
- `packages/ui/src/components/detail/PrettyJsonView.tsx` - `subtreeContainsQuery`, match-aware `shouldExpandNode`, CSS Custom Highlight effect; exported `CLIENT_CAP_BYTES`.
- `packages/ui/src/components/detail/PrettyJsonView.test.tsx` - Expansion/collapse, feature-detect no-op, stubbed re-seed tests.
- `packages/ui/src/components/detail/DetailPanel.tsx` - Reads `searchQuery`, threads `query` to all detail children, key remount, reveal-tab effect.
- `packages/ui/src/components/detail/DetailPanel.test.tsx` - Query-wiring + reveal-tab cases.
- `packages/ui/src/styles/global.css` - `::highlight(ahp-search-match)` rule using search-match tokens.

## Deviations from Plan

### UI-SPEC divergence (recorded for UI-checker)
- **Pretty tree highlight mechanism:** UI-SPEC §Query Highlighting prescribes a literal `<mark>` element. This is infeasible for react-json-view-lite@2.5.0 (no per-node render hook; swapping the renderer and `innerHTML` are both forbidden). The Pretty view therefore uses the **CSS Custom Highlight API** (`Range` objects + `::highlight(ahp-search-match)`), delivering the same literal, token-colored highlight intent with zero markup injection. Raw + Summary still use `<mark>`. This is the divergence the plan's DESIGN NOTE anticipated.

### Auto-fixed Issues
- **[Rule 3 - Blocking] `dangerouslySetInnerHTML` / `RegExp` mentions in comments tripped the grep acceptance gates.** Reworded the RawJsonView safety comment and the PrettyJsonView literal-matching comments so the gates (`grep -c dangerouslySetInnerHTML == 0`, `grep -cE "RegExp|..." == 0`) pass while preserving the documented safety guarantees. No behavior change.
- **[Rule 1 - Bug] `exactOptionalPropertyTypes` typecheck failure** in the PrettyJsonView stubbed-API test (restoring an optional `CSS` global). Widened the local stub type to allow `undefined`. Commit `1fec3c3`.
- **[Rule 3 - Blocking] Biome `useExhaustiveDependencies`** flagged the intentional `data`/`selectedIdx` re-run triggers. Moved the `globalThis` access inside the Pretty effect and documented the intentional triggers with scoped `biome-ignore` comments. Commit `1fec3c3`.

## Browser Support Floor (CSS Custom Highlight API)
- Fully supported: **Chromium/Edge ≥105, Safari ≥17.2, Firefox ≥117.**
- Below those versions the API is absent and the Pretty highlight **degrades non-destructively**: auto-expand + scroll still work; only the colored highlight is skipped via the `if (CSS.highlights)` feature gate — no markup injection, no error.
- Playwright/Chromium (the e2e runtime) supports the API, so Plan 05's `CSS.highlights?.has("ahp-search-match")` assertion is expected to pass.

## Out-of-scope (not fixed)
- `packages/ui/src/styles/global.css:744 lint/style/noDescendingSpecificity` is a **pre-existing** lint error (present with this plan's changes stashed) unrelated to the added `::highlight` rule — left untouched.
- Repo-wide `pnpm lint` reports pre-existing errors/warnings in unrelated files (e.g. e2e tests); all 9 files touched by this plan pass `biome check` cleanly.

## Verification
- `pnpm vitest run` for all four detail test files: **46 passed**.
- `pnpm --filter @ahp-inspector/ui typecheck`: clean.
- `biome check` on all 9 touched files: clean.

## Self-Check: PASSED
