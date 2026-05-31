# 26-01 Summary

## Status

COMPLETE

## Requirements

- UX-SEARCH-SHORTCUT — `cmd+f` / `ctrl+f` opens the search popover (in addition to the existing `/` shortcut), suppressing the browser's native find dialog.
- UX-SEARCH-FOCUS — Clicking the search trigger (or using a shortcut) opens the popover and moves focus into the search input.
- UX-SEARCH-ICON — The search trigger is now icon-only; the redundant "Search" text label was removed.

## Changes

### `packages/ui/src/components/filters/FilterBar.tsx`

- Added a local `openSearch()` helper that sets the popover open and focuses `searchPopoverInputRef` on the next tick (`setTimeout(0)`), so open + focus logic is defined once.
- Extended the existing keydown `useEffect` to also match `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f"`. Both `/` and the find shortcut call `e.preventDefault()` and `openSearch()`. The handler early-returns when the popover is already open, preserving prior behavior. No second listener was added.
- Changed the `SearchTrigger` `onClick` to open + focus via `openSearch()` when closed, and to close when already open (toggle-to-close preserved).

### `packages/ui/src/components/filters/SearchTrigger.tsx`

- Removed the `<span>Search</span>` label — the button is now icon-only.
- Made the control a 28×28 square (`width: 28`, `height: 28`) with symmetric `var(--space-1)` padding; removed the now-unused `gap` and asymmetric horizontal padding.
- Preserved `aria-label="Open search"`, `title="Press / to open search"`, the Search icon, focus/blur outline behavior, and active styling.

### Tests

- `FilterBar.test.tsx`: added coverage for cmd+f (opens + `preventDefault` + input focused), ctrl+f (opens), plain `f` (no-op), trigger click (opens + input focused), and a `/` regression. Switched the file to fake timers so the `setTimeout(0)` focus is deterministic.
- `SearchTrigger.test.tsx`: updated the label test to the icon-only contract (no "Search" text, svg present, accessible name "Open search" preserved).

## Verification

- `pnpm -F @ahp-inspector/ui exec vitest run src/components/filters/FilterBar.test.tsx` — 44 passed.
- `pnpm -F @ahp-inspector/ui exec vitest run src/components/filters/SearchTrigger.test.tsx` — 8 passed.
- `pnpm -F @ahp-inspector/ui exec vitest run src/components/filters/` — 63 passed.
- `pnpm -F @ahp-inspector/ui exec vitest run src/styles/no-hex-in-components.test.ts` — 1 passed (no hardcoded hex introduced).

## Threat Model

- T-26-01 (DoS via FilterBar keydown handler) — accepted, client-only UI.
- T-26-02 (Tampering via `preventDefault` on cmd+f) — accepted, client-only UI.
