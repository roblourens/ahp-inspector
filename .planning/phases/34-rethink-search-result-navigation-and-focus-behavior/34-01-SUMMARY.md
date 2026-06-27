---
phase: 34-rethink-search-result-navigation-and-focus-behavior
plan: 01
subsystem: timeline-search
tags: [highlighter, search, e2e-scaffold, refactor, security]
requires: []
provides:
  - "cells/highlight.tsx shared query highlighter (findMatchRanges, renderHighlightedSegment, HighlightedText, MatchRange)"
  - "e2e/phase34.spec.ts skipped scaffold for Wave-3 e2e plan"
affects:
  - packages/ui/src/components/timeline/cells/EventNameLabel.tsx
tech-stack:
  added: []
  patterns:
    - "Single shared highlighter module — sole producer of <mark> markup (D-08)"
    - "Literal indexOf matching (no RegExp from untrusted query) — ReDoS-safe"
    - "Escaped React text children in <mark> (no dangerouslySetInnerHTML) — XSS-safe"
key-files:
  created:
    - packages/ui/src/components/timeline/cells/highlight.tsx
    - packages/ui/src/components/timeline/cells/highlight.test.tsx
    - e2e/phase34.spec.ts
  modified:
    - packages/ui/src/components/timeline/cells/EventNameLabel.tsx
decisions:
  - "Highlight logic extracted verbatim from EventNameLabel (no re-derivation) to guarantee identical output (D-08)"
  - "Doc comments avoid the literal strings 'RegExp'/'dangerouslySetInnerHTML' so the security grep gate (count==0) stays meaningful"
metrics:
  duration: ~10m
  completed: 2026-06-27
---

# Phase 34 Plan 01: Wave-0 Highlighter & E2E Scaffold Summary

Established the single shared query highlighter (`cells/highlight.tsx`) that every later Phase-34 wave depends on, by extracting the battle-tested literal-match + `<mark>` logic out of `EventNameLabel.tsx` with zero behavior change, plus the standalone Playwright scaffold for the Wave-3 e2e plan.

## What Was Built

### Task 1 — Shared highlighter module (TDD)
- **`cells/highlight.tsx`** exports `MatchRange`, `findMatchRanges`, `renderHighlightedSegment`, and a new convenience `HighlightedText` component (for Plan 04 detail views). Logic was **moved verbatim** from `EventNameLabel.tsx`, not rewritten.
- Matching stays literal: `toLowerCase()` + `indexOf`, min-length 2, non-overlapping (advances past each match). No `RegExp` compiled from the query (ReDoS-safe, T-34-02).
- `<mark>` uses theme tokens only (`var(--color-search-match-bg/fg)`), escaped React text children only — no raw HTML injection (XSS-safe, T-34-01).
- **`highlight.test.tsx`** (8 tests): literal/case-insensitive/non-overlapping ranges, min-length, no-match, regex-meta query stays literal on a 10k-char input, and a `<script>`-bearing payload proven inert (renders escaped text, zero injected `<script>` node).
- **`EventNameLabel.tsx`** refactored to `import { findMatchRanges, renderHighlightedSegment } from "./highlight.js"`; local duplicate definitions deleted. JSX output unchanged (same prefix/leaf segmentation, same `data-testid`s).

### Task 2 — E2E scaffold
- **`e2e/phase34.spec.ts`**: `test.describe("phase34 find navigation")` with 5 `test.skip` placeholders (Enter/Shift+Enter nav, narrow-viewport drawer suppression, repeated Cmd+F refocus, Escape close, detail highlight) for Plan 05 to fill in. 5173 baseURL convention, fixtures-only screenshot privacy note, `screenshots/phase34` reserved (no screenshots yet), no cross-plan helper imports.

## Verification

- `pnpm vitest run packages/ui/src/components/timeline/cells` → 7 files / 36 tests pass.
- `pnpm -r typecheck` → all packages Done.
- `pnpm exec playwright test e2e/phase34.spec.ts --list` → 5 skipped tests collected, no errors.
- Acceptance grep gates all pass, including the security gate `RegExp|dangerouslySetInnerHTML` count == 0 in `highlight.tsx`.
- Biome clean on all touched files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded doc comments to satisfy the security grep gate**
- **Found during:** Task 1 verification.
- **Issue:** Initial JSDoc comments literally mentioned `RegExp` and `dangerouslySetInnerHTML`, which made the acceptance gate `grep -c "RegExp\|...\|dangerouslySetInnerHTML"` return 2 instead of the required 0.
- **Fix:** Reworded comments to "regular expression" / "raw HTML is never injected" so the gate still meaningfully asserts the absence of the dangerous APIs in code.
- **Files modified:** `packages/ui/src/components/timeline/cells/highlight.tsx`
- **Commit:** 8006d6d

**2. [Rule 1 - Formatting] Applied Biome formatting to test file**
- **Found during:** Task 1 lint.
- **Issue:** A `toEqual([...])` array was multi-line where Biome wanted it single-line.
- **Fix:** `biome check --write` on touched files.
- **Commit:** 8006d6d

> Note: `pnpm lint` reports 44 pre-existing errors across the repo (confirmed present with this plan's changes stashed). These are out of scope for this plan; none are in the files touched here.

## Threat Surface

Both registered threats mitigated and proven by unit test:
- **T-34-02 (ReDoS):** no regex from query — grep gate + 10k-char literal-match test.
- **T-34-01 (XSS):** `<script>` payload renders inert escaped text, no injected node.

No new threat surface introduced.

## Known Stubs

None. The 5 skipped e2e tests are intentional scaffolding (documented above), to be filled in by Plan 05.

## Self-Check: PASSED
- FOUND: packages/ui/src/components/timeline/cells/highlight.tsx
- FOUND: packages/ui/src/components/timeline/cells/highlight.test.tsx
- FOUND: e2e/phase34.spec.ts
- FOUND commit d5ba4e6 (test/RED), 8006d6d (feat/GREEN), 48d305b (e2e scaffold)
- TDD gates: RED (d5ba4e6 test) → GREEN (8006d6d feat) present and ordered.
