# Plan 33-01 Summary: Theme and Density Tokens

## Completed

- Added `--color-event-name-prefix` to the required theme token guard.
- Verified the RED state failed only because dark, light, and hacker themes were missing the new token.
- Changed the shared `--row-height` design token from `28px` to `24px` in dark, light, and hacker themes.
- Added `--color-event-name-prefix` in all three themes using a tokenized `color-mix(...)` value derived from existing text tokens.

## Verification

- `pnpm vitest run packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/no-hex-in-components.test.ts` — passed.
- Confirmed `tokens.css` has exactly three `--row-height: 24px` declarations, exactly three `--color-event-name-prefix` declarations, and no remaining `--row-height: 28px` declarations.

## Notes for Later Plans

- Plan 33-02 still needs to align timeline virtualizer estimates and rendered row heights with the new `24px` token.
- Plan 33-03 can consume `--color-event-name-prefix` for event-name prefix styling without adding raw component colors.
