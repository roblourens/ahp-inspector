# Phase 14 Plan 01 Summary

**Plan:** State diagnostics scrolling and parsed row layout (HARDEN-01)

## Changes

- `packages/ui/src/styles/global.css`: `.state-diagnostic-group ul` now caps at `max-height: 240px` with `overflow-y: auto`; `li` wraps long content via `overflow-wrap: anywhere; word-break: break-word`. New `.state-diagnostic-message` rule for wrapping body text.
- `packages/ui/src/components/detail/StateDiagnosticsPanel.tsx`: each `<li>` now renders the meta header + a separate `.state-diagnostic-message` span instead of a bare span.

## Verification

`StateInspectorPanel.test.tsx` (15 tests) passes; full vitest suite (1097 tests) passes.

## Notes

No prop or type changes; purely visual hardening.
