---
phase: 33-tighten-timeline-density-and-event-name-hierarchy-styling
reviewed: 2026-06-24T02:31:30Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - e2e/phase33.spec.ts
  - packages/ui/src/components/timeline/EventRow.columns.test.tsx
  - packages/ui/src/components/timeline/EventRow.tsx
  - packages/ui/src/components/timeline/ParseErrorRow.test.tsx
  - packages/ui/src/components/timeline/ParseErrorRow.tsx
  - packages/ui/src/components/timeline/TimelineList.tsx
  - packages/ui/src/components/timeline/TimelineList.virt.test.tsx
  - packages/ui/src/components/timeline/cells/EventNameLabel.tsx
  - packages/ui/src/components/timeline/cells/LatencyCell.test.tsx
  - packages/ui/src/styles/theme-tokens.test.ts
  - packages/ui/src/styles/tokens.css
findings:
  critical: 0
  warning: 4
  info: 0
  total: 4
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-06-24T02:31:30Z  
**Depth:** standard  
**Files Reviewed:** 11  
**Status:** issues_found

## Summary

Reviewed the listed timeline density, hierarchy styling, token, unit-test, and E2E files. Targeted Vitest tests and workspace typecheck pass, but the implementation still has UI correctness/accessibility and test reliability defects.

## Warnings

### WR-01 [WARNING]: Sticky group label can be computed from overscan rows instead of the top visible row

**File:** `packages/ui/src/components/timeline/TimelineList.tsx:179-184`

**Issue:** `topGroup` uses `virtualItems[0]`, but TanStack virtual items include overscan. With `overscan: 12`, the first virtual item can be above the viewport, so the StickyGroupBar may continue showing the previous group while the user is already viewing a new group.

**Fix:** Choose the first virtual item intersecting the actual viewport top, not the first overscanned item.

### WR-02 [WARNING]: Grid ARIA row indices become invalid after filtering/grouping

**File:** `packages/ui/src/components/timeline/TimelineList.tsx:233`, `packages/ui/src/components/timeline/EventRow.tsx:132`, `packages/ui/src/components/timeline/ParseErrorRow.tsx:28`

**Issue:** The grid declares `aria-rowcount={items.length}`, but rows use `row.idx + 1` for `aria-rowindex`. After filtering, `row.idx` can be much larger than the visible `items.length`, producing invalid ARIA such as row index 101 in a grid with 5 rows.

**Fix:** Pass the visible grid row index from `TimelineList` and make `aria-rowcount` consistent with the header row.

### WR-03 [WARNING]: Search highlights are lost when a match crosses the hierarchy slash

**File:** `packages/ui/src/components/timeline/cells/EventNameLabel.tsx:63-68`

**Issue:** Hierarchical labels are split before highlighting. A query like `o/b` matches the full label `foo/bar`, but it spans the prefix/leaf boundary, so neither `highlightMatches(split.prefix, query)` nor `highlightMatches(split.leaf, query)` marks it. The row can be a search match while the event name shows no highlight.

**Fix:** Compute match ranges against the full label first, then render those ranges with prefix/leaf styling applied by character position.

### WR-04 [WARNING]: E2E cleanup can leave the spawned CLI process running

**File:** `e2e/phase33.spec.ts:69-73`

**Issue:** `killCli` sends `SIGTERM` and waits up to 3 seconds, but if the process does not exit, it returns without escalating. That can leave a server process behind and make later tests flaky.

**Fix:** Escalate to `SIGKILL` if the graceful shutdown times out.

---

_Reviewed: 2026-06-24T02:31:30Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_
