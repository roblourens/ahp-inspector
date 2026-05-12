---
phase: 17
plan: 01
status: complete
date: 2026-05-12
---

# 17-01 SUMMARY — parseDroppedUri parser

## What Was Built

Pure DOM-free parser at `packages/ui/src/components/drop/parseDroppedUri.ts` that turns a `DataTransfer`-shaped input into either a decoded absolute filesystem path string or a typed error code (`no-uri` | `not-jsonl`). Implements CONTEXT D-02 (text/uri-list first, friendly error otherwise) and D-04 (first .jsonl wins, count rejected entries).

Vitest unit suite at `packages/ui/src/components/drop/parseDroppedUri.test.ts` covers all six must_have truths via 11 named cases.

## Key Files

- created:
  - `packages/ui/src/components/drop/parseDroppedUri.ts`
  - `packages/ui/src/components/drop/parseDroppedUri.test.ts`

## Verification

- `pnpm -F @ahp-inspector/ui exec vitest run src/components/drop/parseDroppedUri.test.ts` — 11/11 passed.
- `pnpm exec biome check packages/ui/src/components/drop/` — 0 errors.
- `grep -RIn "parseDroppedUri" packages/ui/src/` — only the parser file and its test, no premature imports from Plan 02 / 03.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0. **Impact:** none.

## Self-Check: PASSED
