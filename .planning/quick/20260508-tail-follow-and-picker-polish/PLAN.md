---
slug: tail-follow-and-picker-polish
date: 2026-05-08
type: quick
---

# Quick: Tail-follow timeline + clickable filename + picker polish

## Description

Three small UX papercuts noticed while running the viewer against real OSS dev logs.

## Scope

1. Auto-scroll the timeline to the bottom on initial load, and keep auto-scrolling
   on append while the user is parked at the bottom (tail-follow). Scrolling up
   disables follow; scrolling back to the bottom re-enables it.
2. Make the filename in the source strip clickable to open the log picker. Remove
   the dedicated "Switch log…" button in the header in favor of this affordance.
3. Tighten the candidate row in the log picker:
   - Move the relative-time metadata ("1m ago") to the left of the filename.
   - Hide the trailing `.jsonl` extension from displayed labels (every candidate
     is JSONL now).
   - Drop the `JSONL` confidence badge from each row (also redundant now).

Bonus: surface OSS dev origin in the picker (`vscode-oss-dev` was added in the
prior quick task but the UI's `SafeCandidate.origin` union and `ORIGIN_LABEL` map
hadn't been updated, so origin would render blank).

## Out of scope

- Persisting tail-follow state across reloads.
- A user-visible "follow" toggle in the chrome.
- Reorganizing the picker beyond the row layout tweak.

## Verification

- `pnpm -F @ahp-viewer/ui typecheck`
- `pnpm vitest run packages/ui packages/host-node`
- Manual: load a fixture log → timeline opens scrolled to the end. Click the
  filename in the source strip → picker opens. Picker rows show time on the left,
  no `.jsonl`, no `JSONL` badge.
