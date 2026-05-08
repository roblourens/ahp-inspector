---
phase: 03-detail-search-and-filtering
plan: "06"
subsystem: gate-test-docs
tags: [vertical-slice, browser-uat, playwright-cli, user-guide, screenshots]
dependency_graph:
  requires: ["03-01", "03-02", "03-03", "03-04", "03-05"]
  provides: ["phase3-gate-test", "browser-uat-screenshots", "user-guide-phase3"]
  affects: ["USER_GUIDE.md", "screenshots/", "test/"]
tech_stack:
  added: []
  patterns:
    - "@vitest-environment jsdom directive for per-file DOM environment override"
    - "playwright-cli UAT: open → snapshot → screenshot → close"
    - "null over <></> for empty JSX returns (biome noUselessFragments)"
key_files:
  created:
    - test/phase3-vertical-slice.test.ts
    - screenshots/phase3-filter-bar.png
    - screenshots/phase3-detail-pretty.png
    - screenshots/phase3-detail-raw.png
    - screenshots/phase3-detail-error.png
    - screenshots/phase3-detail-auth-banner.png
    - screenshots/phase3-detail-copy-toast.png
    - screenshots/phase3-active-chips.png
    - screenshots/phase3-no-results-filters.png
    - screenshots/phase3-no-results-search.png
    - screenshots/phase3-grouped-story.png
    - screenshots/phase3-gap-banner.png
    - screenshots/phase3-detail-truncation.png
    - screenshots/phase3-keyboard.png
  modified:
    - USER_GUIDE.md
    - packages/ui/src/state/selectors.test.ts
    - packages/ui/src/transport/search-client.test.ts
    - packages/ui/src/components/detail/CopyToast.tsx
    - packages/ui/src/components/detail/DetailPanel.tsx
    - packages/ui/src/components/detail/DetailPanel.test.tsx
    - packages/ui/src/components/detail/DetailSummary.fields.test.tsx
    - packages/ui/src/transport/http-client.ts
    - packages/ui/src/components/timeline/GapBannerRow.tsx
    - packages/ui/src/components/timeline/GroupHeaderRow.tsx
    - packages/ui/src/components/detail/AhpFieldStrip.tsx
    - packages/ui/src/components/detail/AuthFailureBanner.tsx
    - packages/ui/src/components/detail/CopyMenu.tsx
    - packages/ui/src/components/detail/DetailSummary.tsx
    - packages/ui/src/components/detail/DetailTabs.tsx
    - packages/ui/src/components/detail/PrettyJsonView.tsx
    - packages/ui/src/components/detail/PrivacyCaption.tsx
    - packages/ui/src/components/detail/TruncationBanner.tsx
    - packages/ui/src/components/filters/FilterBar.tsx
    - packages/ui/src/components/shell/AppShell.tsx
    - packages/ui/src/components/shell/StatusBar.tsx
    - packages/ui/src/components/timeline/EventRow.tsx
    - packages/ui/src/components/timeline/TimelineList.tsx
    - packages/ui/src/components/timeline/TimelineRegion.tsx
    - packages/ui/src/components/timeline/grouping.test.tsx
    - packages/ui/src/transport/search-client.ts
decisions:
  - "Per-file @vitest-environment jsdom directive needed for UI hook tests when run from root vitest config — avoids duplicating test files between package-level and root runners"
  - "return null instead of <></> for component early returns — satisfies biome noUselessFragments while requiring JSX.Element|null return type annotation"
  - "tabIndex={-1} on gap-banner and group-header role=row divs — biome useFocusableInteractive requires grid row elements to be programmatically focusable"
metrics:
  duration: "15min"
  completed_date: "2026-05-07"
  tasks: 2
  files: 29
---

# Phase 3 Plan 06: Wave 4 Gate Test + Browser UAT + Docs Summary

**One-liner:** Phase 3 gate — 8-assertion vertical-slice integration test + 13 playwright-cli UAT screenshots + 4-section USER_GUIDE update; all 396 tests pass, typecheck clean, lint clean.

## What Was Built

### Task 1: Phase 3 Vertical-Slice Integration Test

Created `test/phase3-vertical-slice.test.ts` — 8 assertions covering the full Phase 3 stack:

1. **Phase 2 regression**: `/api/log/meta` returns 200 (non-regression guard)
2. **Meta endpoint**: returns basename filename without absolute path (T-03-01-04)
3. **SSE snapshot**: delivers ≥6 rows; at least one has `isAuthFailure=true`
4. **Search — basic**: `GET /api/log/search?q=authRequired` returns ≥1 match
5. **Search — long query**: 256+ char query accepted (server caps silently, T-03-01-01)
6. **Search — truncation**: `limit=1` returns `truncated=true` when 2+ matches exist
7. **Event detail**: `GET /api/log/event/0` returns full event with `raw` payload
8. **Event 404**: `GET /api/log/event/999` returns 404

Also fixed pre-existing biome/TypeScript issues in Plans 03-04/03-05 files so the full gate passes:
- Added `@vitest-environment jsdom` to `selectors.test.ts` and `search-client.test.ts`
- Fixed `noUselessFragments` (CopyToast, DetailPanel: `<>` → `null`)
- Fixed `noNonNullAssertion` in http-client.ts (`shift()!` → safe conditional)
- Fixed `useFocusableInteractive` in GapBannerRow/GroupHeaderRow (`tabIndex={-1}`)
- Removed unused imports/variables in test files
- Ran biome `--write` to auto-fix import ordering and formatting

### Task 2: Browser UAT via playwright-cli

Started the CLI with `phase3-mini.jsonl --no-open --port 9879`, opened via `playwright-cli open`, and captured all 13 required screenshots:

| Screenshot | Shows |
|---|---|
| `phase3-filter-bar.png` | Filter bar with all 8 facet chips + Group toggle |
| `phase3-detail-pretty.png` | Detail panel with Pretty tab and AHP field strip |
| `phase3-detail-raw.png` | Detail panel Raw tab with JSON pre block |
| `phase3-detail-error.png` | Error response row (errorCode=-32007) in detail |
| `phase3-detail-auth-banner.png` | Auth failure banner (🔒 -32007) at top of detail |
| `phase3-detail-copy-toast.png` | Copy raw JSON menu |
| `phase3-active-chips.png` | Search "initialize" + Dir:c2s active chips |
| `phase3-no-results-filters.png` | Kind:request + Dir:s2c = 0/6 visible events |
| `phase3-no-results-search.png` | Non-matching search yields 0 results |
| `phase3-grouped-story.png` | Session grouping with group header rows |
| `phase3-gap-banner.png` | serverSeq gap banner between events |
| `phase3-detail-truncation.png` | N/A — mini fixture has no large payload |
| `phase3-keyboard.png` | `/` shortcut focuses search input (active state) |

### USER_GUIDE.md Update

Added 4 new sections under the existing Phase 2 content:

1. **Searching events** — `/` shortcut, Esc behavior, 5000-match cap, highlights
2. **Filtering events** — 8 facet chips table, AND/OR combining, chip clearing
3. **Grouping by session/turn** — None/Session/Session+Turn modes, gap banners
4. **Inspecting event details** — Summary strip, Pretty/Raw tabs, Copy menu, keyboard shortcuts table

All 13 screenshots linked inline in the new sections.

## Gate Results

```
pnpm test               → 396/396 passed (29 test files)
pnpm -F @ahp-viewer/ui build  → ✓ built in ~100ms
pnpm -F @ahp-viewer/cli build → ✓ built in ~19ms
pnpm typecheck          → all packages clean
pnpm lint               → 0 errors, 2 warnings (biome-ignore comment flags)
rg -n '#[0-9a-fA-F]' packages/ui/src/components/ → 0 results
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom environment missing for selectors.test.ts and search-client.test.ts**
- **Found during:** Task 1 gate (pnpm test)
- **Issue:** Root `vitest.config.ts` includes `packages/*/src/**/*.test.ts` but doesn't set `environment: "jsdom"`. The two UI hook tests that use `renderHook` require DOM APIs — they were designed to run via the package-level vitest config but the root runner picked them up without jsdom.
- **Fix:** Added `// @vitest-environment jsdom` at the top of both files.
- **Files modified:** `packages/ui/src/state/selectors.test.ts`, `packages/ui/src/transport/search-client.test.ts`
- **Commit:** e310517

**2. [Rule 1 - Bug] Biome noUselessFragments: `<>` returns in CopyToast and DetailPanel**
- **Found during:** Task 1 lint gate
- **Issue:** `return <></>;` in CopyToast and DetailPanel triggered `noUselessFragments`; converting to `return null;` required updating the function return types to `JSX.Element | null`.
- **Fix:** Changed returns to `null`, updated return type annotations.
- **Files modified:** `CopyToast.tsx`, `DetailPanel.tsx`
- **Commit:** e310517

**3. [Rule 1 - Bug] Non-null assertion in http-client.ts cacheOrder.shift()**
- **Found during:** Task 1 lint gate
- **Issue:** `cacheOrder.shift()!` triggered `noNonNullAssertion`. Safe to fix since `shift()` returns `undefined` only on empty array, which can't happen inside the `length >= MAX_CACHE` guard.
- **Fix:** Conditional `if (evict !== undefined) cache.delete(evict)`.
- **Files modified:** `packages/ui/src/transport/http-client.ts`
- **Commit:** e310517

**4. [Rule 2 - Missing] useFocusableInteractive in GapBannerRow and GroupHeaderRow**
- **Found during:** Task 1 lint gate
- **Issue:** `role="row"` divs need to be programmatically focusable per biome a11y rule.
- **Fix:** Added `tabIndex={-1}` with biome-ignore comment explaining the keyboard manager handles navigation at the TimelineRegion level.
- **Files modified:** `GapBannerRow.tsx`, `GroupHeaderRow.tsx`
- **Commit:** e310517

**5. [Rule 1 - Bug] Biome formatting and import ordering across 03-04/03-05 components**
- **Found during:** Task 1 lint gate
- **Issue:** 35 lint errors total across detail/, timeline/, filters/, shell/, transport/ from previous plans that didn't run `biome --write`.
- **Fix:** Ran `biome check --write` on affected directories.
- **Files modified:** Multiple (AhpFieldStrip.tsx, AuthFailureBanner.tsx, CopyMenu.tsx, DetailSummary.tsx, etc.)
- **Commit:** e310517

## Known Stubs

None — all Phase 3 features are fully wired. The phase3-detail-truncation.png screenshot documents "N/A — mini fixture has no large payload" as noted in the plan.

## Threat Flags

None — screenshots use synthetic fixture data only (test-session-0001, no real tokens/prompts/paths). USER_GUIDE.md is documentation only.

## Self-Check: PASSED
