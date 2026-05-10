---
quick_id: 260510-kuo
title: Remember filters per-jsonl file. When switching to a new one, reset all the filters
date: 2026-05-10
---

# Quick Task 260510-kuo

## Description

Remember filters per-jsonl file. When switching to a new one, reset all the filters.

## Diagnosis

Per-log persistence already exists (`usePersistEffect` + `persistence.ts`), keyed by `logKey`. Filters/search/grouping/group-collapsed/selectedIdx are saved per log and hydrated on snapshot-end.

Bug: when the user switches to a JSONL file that has **no stored prefs yet**, `hydrate()` short-circuits (`if (stored) { ... }`), leaving the previous log's filters/search/grouping in place. The existing test even asserts this:

> `snapshot-end with no stored prefs leaves store untouched`

That assertion captures the bug — the user wants the opposite: new file = fresh view state.

## Fix

In `packages/ui/src/persistence/persist-effect.ts`, when `logKey` transitions from one non-null value to a different non-null value:

1. Flush the previous log's pending save (already done).
2. Reset per-log view state (`filters`, `searchQuery` + search results, `grouping`, `groupCollapsed`) to defaults.
3. Clear `hydratedFor` (already done).

If the new log has stored prefs, `hydrate()` will restore them when rows arrive (0→N transition) — so this only changes behavior for **new** files. `detailWidth` and `livePaused` are global UI prefs and stay as-is.

## Tasks

1. Update `hydrate()` / subscribe in `persist-effect.ts` to reset per-log view state on logKey change.
2. Update `persist-effect.test.ts`:
   - Replace the now-incorrect assertion in "snapshot-end with no stored prefs leaves store untouched" with one that asserts the reset.
   - Add a test for the new switch-with-no-stored-prefs reset.
3. Run UI tests + build.
