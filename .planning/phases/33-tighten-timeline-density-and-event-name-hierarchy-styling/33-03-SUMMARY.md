# Plan 33-03 Summary: Event-Name Hierarchy Styling

## Completed

- Added `EventNameLabel` with `splitHierarchicalEventName(...)` using a last-slash split.
- Rendered prefixes such as `session/` and `session/tool/` with `var(--color-event-name-prefix)`.
- Kept unsplit labels unchanged for `initialize`, `/leading`, and `trailing/`.
- Preserved safe React text/span/mark rendering with no HTML injection.
- Integrated `EventNameLabel` into `EventRow` while preserving the full unsplit label in the method-cell title and row accessibility label.
- Preserved case-insensitive search highlighting inside the event-name label.

## Verification

- `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx packages/ui/src/styles/no-hex-in-components.test.ts` — passed.
- `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx packages/ui/src/components/timeline/TimelineList.virt.test.tsx packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/no-hex-in-components.test.ts` — passed.
- Confirmed `EventNameLabel.tsx` exports `splitHierarchicalEventName`, uses `lastIndexOf("/")`, uses `var(--color-event-name-prefix)`, and contains no `dangerouslySetInnerHTML`.

## Notes for Later Plans

- Plan 33-04 should capture synthetic all-theme screenshots that show the tighter rows and subtle prefix styling together.
