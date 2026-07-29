---
quick_id: 260729-json-tree-expansion-stays-open
status: complete
date: 2026-07-29
commit: 85a4491
---

# Quick Task 260729-json-tree-expansion-stays-open Summary

## Result

Manually expanding or collapsing a JSON tree node in the detail sidebar now stays in that state across unrelated rerenders (e.g. live `rows` updates from SSE), instead of snapping back to the `shouldExpandNode` default.

## Diagnosis Confirmed

`react-json-view-lite`'s `ExpandableObject` re-invokes `shouldExpandNode` and calls `setExpanded(...)` whenever the **function identity** of `shouldExpandNode` changes (guarded only on first mount). `PrettyJsonView.tsx` was passing a fresh inline arrow function as `shouldExpandNode` on every render, so any unrelated parent rerender (e.g. `DetailPanel` re-rendering from live `rows` store updates while the same node stays mounted) produced a new closure identity and silently overwrote the user's manually toggled expansion state.

## Changes

- `packages/ui/src/components/detail/PrettyJsonView.tsx`: wrapped the `shouldExpandNode` callback passed to `JsonView` in `useCallback`, keyed only on `hasQuery` and `query` (the actual determinants of expansion policy), computed before the truncation-banner early return to satisfy rules-of-hooks. Behavior is unchanged: `hasQuery ? level < 1 || subtreeContainsQuery(value, query) : level < 5`.
- `DetailPanel.tsx`'s existing `key={selectedIdx}:{query}...}` remount-on-selection/query-change behavior was left untouched (out of scope, confirmed correct).
- `packages/ui/src/components/detail/PrettyJsonView.test.tsx`: added a `PrettyJsonView — stable expansion across unrelated rerenders` suite:
  - manually collapsing a level-1 node stays collapsed across a rerender with the same `data`/no `query`.
  - manually expanding a deep (level-6) node stays expanded across a rerender with the same `data`/no `query`.
  - a genuine `query` change on rerender still recomputes expansion (guards against overcorrecting into a callback that never updates).

## Verification

- `pnpm -F @ahp-inspector/ui test -- PrettyJsonView.test.tsx` — 11/11 tests passed (8 pre-existing + 3 new regression tests), including existing match-aware (D-08/D-09) and default-expansion coverage, confirming no regression.
- `pnpm -F @ahp-inspector/ui typecheck` — passed, no errors.
- `npx biome check` on both touched files — passed, no lint or format issues (surfaced and fixed a rules-of-hooks violation from an earlier draft where `useCallback` was placed after the truncation-banner early return; moved it above per rules-of-hooks).
