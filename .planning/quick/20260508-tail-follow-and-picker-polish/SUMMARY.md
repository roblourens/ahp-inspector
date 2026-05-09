---
slug: tail-follow-and-picker-polish
date: 2026-05-08
status: complete
---

# Summary: Tail-follow timeline + clickable filename + picker polish

## Outcome

All three UX tweaks landed. Tests pass (309/309 UI + host-node; full suite has
974/974 passing tests, with one pre-existing fixture-missing test-file failure
in `packages/parser/src/legacy.test.ts` that is unrelated to this task).

## Changes

- [packages/ui/src/components/timeline/TimelineList.tsx](packages/ui/src/components/timeline/TimelineList.tsx)
  - Added `followTailRef` plus a `useEffect` that scrolls to the bottom on
    `items.length` change while following. `onScroll` flips the ref based on
    distance from bottom (≤4px = following). Initial mount defaults to
    following, so opening a log lands at the tail.
- [packages/ui/src/components/shell/SourceStrip.tsx](packages/ui/src/components/shell/SourceStrip.tsx)
  - Filename is now a `<button aria-label="Switch log">` when an `onSwitchLog`
    handler is provided. Falls back to a static span when no handler.
- [packages/ui/src/components/shell/HeaderBar.tsx](packages/ui/src/components/shell/HeaderBar.tsx)
  - Removed `SwitchLogButton` mount and the `onSwitchLog` prop.
- [packages/ui/src/components/shell/SwitchLogButton.tsx](packages/ui/src/components/shell/SwitchLogButton.tsx)
  — deleted (no remaining callers).
- [packages/ui/src/components/shell/AppShell.tsx](packages/ui/src/components/shell/AppShell.tsx)
  - Pipes `onToggleSwitchLog` to `SourceStrip` instead of `HeaderBar`.
- [packages/ui/src/components/picker/CandidateRow.tsx](packages/ui/src/components/picker/CandidateRow.tsx)
  - Reordered cells: dot → relative time (left-aligned) → filename → origin → size.
  - Strips trailing `.jsonl` from displayed label.
  - Dropped the `CONFIDENCE_BADGE` (the "JSONL" tag).
  - Added `vscode-oss-dev` to `ORIGIN_LABEL`.
- [packages/ui/src/types/safe-candidate.ts](packages/ui/src/types/safe-candidate.ts)
  - Widened `origin` union to include `"vscode-oss-dev"`.
- [packages/ui/src/components/picker/CandidateRow.test.tsx](packages/ui/src/components/picker/CandidateRow.test.tsx)
  - Updated assertions: stripped extension, no JSONL badge.
- [packages/ui/src/components/picker/LogPickerPanel.tsx](packages/ui/src/components/picker/LogPickerPanel.tsx)
  - Bumped picker `z-index` from 800 to 1200 so it sits above the FilterBar
    (z-index 1000) — without this, the FilterBar's search input painted on top
    of the picker header and made the "Switch log" title look truncated.
  - Moved Refresh into the panel header alongside Close (was a separate
    right-aligned button row), added a separator under the title, added
    `var(--shadow-menu)`. Renamed the button copy "Refresh List" → "Refresh".
  - Widened `maxHeight` to `calc(100vh - 40px)` so long candidate lists scroll
    inside the panel rather than getting clipped to 60vh.
- [packages/ui/src/components/states/NoActiveLogState.test.tsx](packages/ui/src/components/states/NoActiveLogState.test.tsx)
  - Updated label assertions to use stripped-extension text.
- [packages/ui/src/components/shell/AppShell.test.tsx](packages/ui/src/components/shell/AppShell.test.tsx)
  - Updated picker click target to the stripped label.

## Verification

- `pnpm -F @ahp-inspector/ui typecheck` — clean.
- `pnpm vitest run packages/ui packages/host-node` — 309/309 pass.
- `pnpm test` — 974/974 actual tests pass (one unrelated pre-existing fixture
  failure in `packages/parser/src/legacy.test.ts`).
- Manual: `pnpm start:fixture` rebuilt UI and started the server at
  http://127.0.0.1:5173 with the new behavior live.
- Browser-verified the picker fix via the integrated browser; saved
  [screenshots/quick/20260508-tail-follow-and-picker-polish-picker.png](screenshots/quick/20260508-tail-follow-and-picker-polish-picker.png)
  showing the cleaned-up "Switch log" header with Refresh + Close in the title
  bar and no overlap with the FilterBar.

## Notes

- Tail-follow uses raw `scrollTop = scrollHeight` rather than
  `virtualizer.scrollToIndex` to avoid layout-measurement races with
  variable-height rows; the rAF defer lets the virtualizer settle the new total
  size first.
- Detection threshold is 4px to absorb sub-pixel rounding from the virtualizer's
  estimated heights.
