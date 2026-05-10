# Phase 14 Plan 03 Summary

**Plan:** Smarter notification/event summaries (HARDEN-03)

## Changes

- `packages/core/src/row-projection.ts`: `eventSummaryOf` notification branches now extract structured fields:
  - `protocol-notification` prefers `state`/`status`, then `message`/`text`/`detail`/`reason`, then falls back to `summarizeValue`.
  - `client-notification` / `server-notification` show `${method}: ${message}` when a message is present, else `${method} ${state}`, else legacy fallback.
- `packages/core/src/row-projection.test.ts`: three new cases covering state extraction, method+message rendering, and legacy fallback.

## Verification

`row-projection.test.ts` 62/62 pass; full suite green.

## Notes

No public API changes; only summary string content for notifications.
