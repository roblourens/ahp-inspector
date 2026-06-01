---
phase: 27-fix-broken-details-view-layout-regression
plan: 01
type: execute
status: COMPLETE
requirements: [UX-DETAIL-JSON-LAYOUT]
files_modified:
  - packages/ui/src/styles/global.css
  - packages/ui/src/styles/json-tree-indent.test.ts
commit: TBD
---

# Phase 27 · Plan 01 — Summary

## Objective

Fix the broken pretty-JSON layout in the event detail pane: nested values were
over-indented and separated by unwanted vertical gaps.

## Root Cause

react-json-view-lite (2.5.0) wraps each object/array's child fields in a
`<ul class="ahp-json-children">`. That class is mapped in PrettyJsonView's
`JSON_STYLES` (`childFieldsContainer: "ahp-json-children"`) but had **no** rule
in `global.css`, so the `<ul>` fell back to browser defaults:
`padding-inline-start: 40px`, `margin: 12px 0`, and `list-style: disc`. The 40px
padding stacked on top of the intended per-level
`.ahp-json-child { margin-left: var(--space-4) }`, producing ~56px of
indentation per depth plus vertical gaps and bullet artifacts.

## Changes

- **packages/ui/src/styles/global.css** — added a `.ahp-json-children` reset
  (`margin: 0; padding: 0; list-style: none;`) next to the other `.ahp-json-*`
  rules, so nested-JSON indentation comes solely from `.ahp-json-child`.
- **packages/ui/src/styles/json-tree-indent.test.ts** — new regression guard
  (modeled on `no-hex-in-components.test.ts`) that reads `global.css` and
  asserts the `.ahp-json-children` selector exists and resets `margin`,
  `padding`, and `list-style`, and that `.ahp-json-child` still carries the
  `margin-left: var(--space-4)` indentation. Text-based because jsdom does not
  compute layout.

`PrettyJsonView.tsx` and the `JSON_STYLES` mapping were intentionally left
unchanged — the only product change is the CSS reset.

## Verification

- `pnpm -F @ahp-inspector/ui exec vitest run src/styles/` — 5 files, 12 tests
  pass (including the new `json-tree-indent` guard).
- `pnpm -F @ahp-inspector/ui exec vitest run src/components/detail/PrettyJsonView.test.tsx`
  — 3 tests pass (existing pretty-JSON behavior unchanged).
- Visual: rebuilt the UI (`pnpm -F @ahp-inspector/ui build`) and opened a
  request against `test/fixtures/long-realistic-ahp.jsonl` in the detail pane.
  Nested JSON now indents exactly one level per depth with no vertical gaps and
  no list bullets. Evidence: `screenshots/phase27/detail-fixed.png` (fixture
  data only).

## Must-Haves

- ✅ Pretty JSON indents one level (`var(--space-4)`) per depth, no extra
  browser-default list padding.
- ✅ No spurious vertical gaps between nested objects/arrays.
- ✅ Child-fields container has no list bullets.
- ✅ Regression test fails if the `.ahp-json-children` reset is removed.

## Threat Model

- T-27-01 (Tampering, CSS-only change to a local static stylesheet) — client-only
  presentation, no data or trust boundary affected. **Accepted.**
