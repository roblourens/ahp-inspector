---
phase: 05-themes-polish-and-verification
plan: 02
subsystem: themes
tags: [tokens, hacker, crt, reduced-motion]
requires: [responsive-detail-drawer]
provides: [phase5-token-completeness, hacker-crt-effects]
affects: [packages/ui/src/styles, packages/ui/src/components/shell/HeaderBar.tsx, packages/ui/src/components/timeline/EventRow.tsx]
tech_stack:
  added: []
  patterns: ["semantic CSS token families", "reduced-motion guarded decorative effects"]
key_files:
  created: [packages/ui/src/styles/reduced-motion-css.test.ts]
  modified: [packages/ui/src/styles/tokens.css, packages/ui/src/styles/global.css, packages/ui/src/styles/theme-tokens.test.ts, packages/ui/src/components/shell/HeaderBar.tsx, packages/ui/src/components/timeline/EventRow.tsx]
decisions:
  - "Keep dense timeline text free of text-shadow while applying hacker glow to chrome, rails, borders, and selected row halos."
metrics:
  completed: 2026-05-08T04:48:00Z
  tasks: 3
---

# Phase 05 Plan 02: Theme Token Polish and Hacker CRT Effects Summary

Dark, light, and hacker themes now share the Phase 5 polish token family, and hacker mode has bounded CRT/terminal effects with reduced-motion safeguards.

## Completed Tasks

| Task | Result |
|------|--------|
| Complete Phase 5 theme tokens | Expanded token completeness tests to include shadows, focus, rows, drawer, effects, and selection tokens. |
| Tokenize component polish surfaces | Replaced HeaderBar raw menu shadow with `--shadow-menu`; selected rows now use `--row-selected-bg`. |
| Add hacker CRT effects | Added scanline/grid/glow/terminal styling and a static reduced-motion CSS guard test. |

## Verification

- `pnpm -F @ahp-inspector/ui test src/styles/theme-tokens.test.ts src/styles/no-hex-in-components.test.ts src/styles/reduced-motion-css.test.ts` — passed
- `pnpm -F @ahp-inspector/ui test src/components/shell/HeaderBar.test.tsx src/components/timeline/TimelineList.virt.test.tsx src/components/detail/DetailPanel.test.tsx` — passed
- `pnpm -F @ahp-inspector/ui build` — passed

## Deviations from Plan

None - plan executed as written.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- Created file exists: `packages/ui/src/styles/reduced-motion-css.test.ts`
- Theme/token guard, component tests, and build passed.
