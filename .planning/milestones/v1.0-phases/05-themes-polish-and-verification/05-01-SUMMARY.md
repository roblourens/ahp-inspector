---
phase: 05-themes-polish-and-verification
plan: 01
subsystem: responsive-shell
tags: [layout, drawer, timeline]
requires: [playwright-e2e-infra]
provides: [responsive-detail-drawer, detail-layout-constants]
affects: [packages/ui/src/components/shell, packages/ui/src/components/detail, packages/ui/src/styles]
tech_stack:
  added: []
  patterns: ["media-query responsive shell", "shared detail layout constants"]
key_files:
  created: [packages/ui/src/components/detail/detail-layout.ts]
  modified: [packages/ui/src/components/shell/AppShell.tsx, packages/ui/src/components/shell/AppShell.test.tsx, packages/ui/src/components/detail/DetailPanel.tsx, packages/ui/src/components/detail/DetailResizeHandle.tsx, packages/ui/src/styles/global.css, packages/ui/src/styles/tokens.css]
decisions:
  - "Use 1400px as the side-rail threshold and render selected details as a right overlay drawer below that breakpoint."
metrics:
  completed: 2026-05-08T04:47:00Z
  tasks: 3
---

# Phase 05 Plan 01: Responsive Detail Drawer Layout Summary

The shell now keeps the timeline primary at laptop widths by moving event details into an overlay drawer below 1400px, while retaining the resizable desktop side rail above the breakpoint.

## Completed Tasks

| Task | Result |
|------|--------|
| Shared detail layout constants | Added constants for min/default/max width, desktop breakpoint, and keyboard step; store and resize handle use them. |
| Side rail vs overlay drawer | Added deterministic responsive detection, drawer rendering, Escape/close behavior, and `Close details` control. |
| Responsive overflow/filter CSS | Added shell/timeline/filter/drawer classes and breakpoint CSS; timeline overflow remains localized. |

## Verification

- `pnpm -F @ahp-viewer/ui test src/components/shell/AppShell.test.tsx src/components/detail/DetailPanel.test.tsx src/components/timeline/TimelineList.virt.test.tsx src/components/filters/FilterBar.test.tsx` — passed
- `pnpm -F @ahp-viewer/ui build` — passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical functionality] Added baseline Phase 5 layout tokens early**
- **Found during:** CSS implementation
- **Issue:** Drawer/row CSS needed `--shadow-*`, `--row-*`, `--overlay-backdrop`, and `--drawer-border` tokens before Plan 05-02.
- **Fix:** Added baseline token definitions to all three theme blocks; Plan 05-02 will refine and enforce the full list.
- **Files modified:** `packages/ui/src/styles/tokens.css`

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- Created file exists: `packages/ui/src/components/detail/detail-layout.ts`
- Responsive shell and build verification passed.
