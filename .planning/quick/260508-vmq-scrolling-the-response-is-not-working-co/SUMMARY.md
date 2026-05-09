---
quick_id: 260508-vmq
slug: scrolling-the-response-is-not-working-co
status: complete
completed: "2026-05-09T05:55:00.000Z"
---

Fixed response detail scrolling and noisy serverSeq gap banners.

Changed:
- Constrained the desktop detail rail/detail panel flex chain with `height: 100%` and `minHeight: 0` so the JSON response tab panel can scroll to the bottom.
- Added `previousServerSeq` to projected rows so gap banners use the real previous sequence instead of fabricating `curr - 1`.
- Switched app-state gap detection to global monotonic serverSeq tracking and only flags true forward skips.
- Updated selector and projection tests for accurate gap banner rendering.

Verification:
- `pnpm test -- packages/server/src/app-state.test.ts packages/core/src/row-projection.test.ts`
- `pnpm --filter @ahp-inspector/ui test -- selectors.test.ts DetailPanel.test.tsx AppShell.test.tsx DetailSummary.fields.test.tsx TimelineList.virt.test.tsx grouping.test.tsx EventRow.columns.test.tsx ParseErrorRow.test.tsx TimelineRegion.test.tsx FilterBar.test.tsx selectors.perf.test.ts`
- `pnpm --filter @ahp-inspector/core typecheck && pnpm --filter @ahp-inspector/server typecheck && pnpm --filter @ahp-inspector/ui typecheck`
- `pnpm exec biome check ...touched files...`
- `pnpm --filter @ahp-inspector/ui build`
