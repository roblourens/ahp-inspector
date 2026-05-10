# Phase 14 Context

**Goal:** Hardening pass over four user-visible roughness areas after v1.1 shipped.

## Scope (from ROADMAP)

1. **State diagnostics scrolling and parsing** — Long replay-diagnostics lists in the state inspector run off the panel; messages render verbatim with little structure.
2. **Row highlighting cleanup** — Selected, pair-highlighted, and search-match background/outline treatments overlap; precedence is unclear when a row matches multiple states.
3. **Smarter event/notification summaries** — `eventSummaryOf` falls back to a generic `summarizeValue` JSON dump for notifications. Common shapes (status updates, request-permission, plain text deltas) deserve more readable summaries.
4. **Search ergonomics** — F3/Shift+F3 cycles matches, but Enter/Shift+Enter from the focused search input don't, and the timeline doesn't reliably scroll the current match into view.

## Decisions

- D-01: Keep changes local to existing files; no new packages, no new state surfaces.
- D-02: Treat each scope as an independent plan (no cross-plan file overlap → all Wave 1).
- D-03: No protocol or transport changes. Pure UI/projection polish.
- D-04: Row visual precedence: `selected` > `pair-highlight` > `search-match` (most specific wins). Search-match indicator becomes a left-side glyph rail mark + subtle bg, never an outline competing with selection.
- D-05: Diagnostics panel scrolls inside its own container with a max-height; outer detail scroll still works.

## Out of Scope (Deferred Ideas)

- Restructuring DetailPanel layout.
- New filter facets or projection columns.
- Re-architecting search transport.

## Requirements

This is a hardening phase; no new top-level requirements. Tracks under HARDEN-01..HARDEN-04 (one per scope above).
