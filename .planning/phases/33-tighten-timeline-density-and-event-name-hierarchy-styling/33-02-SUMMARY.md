# Plan 33-02 Summary: Timeline Density and Typography

## Completed

- Changed timeline virtualizer row and parse-error estimates from `28` to `24`.
- Added parse-error-aware item height selection so parse-error rows use the dedicated `ITEM_HEIGHT["parse-error"]` path.
- Updated missing-item and unknown-kind virtualizer fallbacks to `24`.
- Kept timeline column and group/header heights at `24px`.
- Tightened event-row and parse-error row padding to `2px 8px`.
- Added timeline-local `12px`/`16px` typography on timeline rows and the column header without changing global typography tokens.
- Preserved `LatencyCell` alignment to `height: "var(--row-height)"`.

## Verification

- `pnpm vitest run packages/ui/src/components/timeline/TimelineList.virt.test.tsx` — passed.
- `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx packages/ui/src/components/timeline/ParseErrorRow.test.tsx packages/ui/src/components/timeline/cells/LatencyCell.test.tsx packages/ui/src/components/timeline/TimelineList.virt.test.tsx` — passed.
- `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx packages/ui/src/components/timeline/TimelineList.virt.test.tsx packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/no-hex-in-components.test.ts` — passed.
- Confirmed `tokens.css` had no changes during this plan.

## Notes for Later Plans

- Plan 33-03 can add event-name hierarchy styling on top of the compact timeline row typography.
- Plan 33-04 should capture visual fixture proof for the tighter 24px rows across themes.
