---
status: complete
phase: quick-260508-pj1
completed: 2026-05-09
---

# Quick Task 260508-pj1: Scrollable Response Viewer

Fixed missing vertical scrolling in the right-side response viewer for both Pretty and Raw JSON tabs.

Root cause: the shared JSON tab panel was a flex child in a column layout without `minHeight: 0`, so it could not shrink enough for `overflow: auto` to activate.

Changes:
- Added `minHeight: 0` to the shared `DetailPanel` JSON tabpanel style.
- Added regression tests covering the scroll-critical tabpanel styles for both Pretty and Raw tabs.

Verification:
- `pnpm --filter @ahp-inspector/ui test -- DetailPanel.test.tsx`
- `pnpm --filter @ahp-inspector/ui test`
- `pnpm --filter @ahp-inspector/ui typecheck`