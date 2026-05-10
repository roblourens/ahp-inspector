---
quick_id: 260510-kuo
title: Remember filters per-jsonl file. When switching to a new one, reset all the filters
date: 2026-05-10
status: complete
---

# Quick Task 260510-kuo — Summary

## What changed

When the user switches to a different JSONL log, per-log view state (filters, search query, grouping, group-collapsed) is now reset before the new file's stored prefs (if any) are hydrated. Previously, switching to a file with no stored prefs left the previous file's filters in place.

## Files

- `packages/ui/src/persistence/persist-effect.ts` — on logKey transition (non-null → different non-null), flush the prior log's pending save, update `ref.lastLogKey` first to avoid re-entrant subscribe recursion, then call `setFilters(EMPTY_FILTERS)`, `setSearchQuery("")`, `clearSearchResults()`, `setGrouping("none")`, and clear `groupCollapsed`. `hydrate()` still restores stored prefs for the new logKey on snapshot-end.
- `packages/ui/src/persistence/persist-effect.test.ts` — added two tests:
  - switching to a logKey with no stored prefs resets filters/search/grouping
  - switching to a logKey with stored prefs restores them after the reset

## Verification

- `vitest run` in `packages/ui`: 335/335 pass
- `pnpm -F @ahp-inspector/ui build`: succeeds

## Out of scope

`detailWidth` and `livePaused` are preserved across switches (they behave as global UI prefs). `selectedIdx` was already cleared by `resetForLogSwitch`.
