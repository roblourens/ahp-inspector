# Phase 34: Rethink search result navigation and focus behavior - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Make in-app find navigation continuous and understandable. Command+F/Ctrl+F opens a find widget, Enter/Shift+Enter moves between matching events without losing the user's ability to continue navigating, and details may stay synchronized only when they do not obstruct that flow. This phase refines search result selection, detail presentation, match highlighting, responsive behavior, and focus management; it does not turn search back into a row filter or add a new search language.

</domain>

<decisions>
## Implementation Decisions

### Navigation versus opening details
- **D-01:** Enter/Shift+Enter navigation selects the matching event and keeps details synchronized when the detail surface does not obstruct find, such as the desktop detail rail.
- **D-02:** Search-driven navigation must not open the narrow-screen detail drawer. The matching row remains selected while the drawer stays closed.
- **D-03:** Closing find after search-driven navigation keeps the current matching row selected and does not automatically open the suppressed drawer.
- **D-04:** An explicit timeline-row click is different from search navigation: it may open the narrow-screen detail drawer over the still-open find widget.
- **D-05:** Updating an unobstructive desktop detail pane must never steal keyboard focus from the find input.

### Event-level result semantics and detail highlighting
- **D-06:** Find navigation advances once per matching event, not once per individual text occurrence inside an event.
- **D-07:** The find counter reports matching events and labels them as results rather than implying a count of text occurrences.
- **D-08:** The active query is highlighted in both the matching timeline row and the visible detail content for the selected result.
- **D-09:** If the selected event's first relevant match is hidden by the current detail tab or a collapsed JSON branch, the detail view should reveal that match without changing event-level navigation semantics.

### Find widget placement and focus
- **D-10:** While open, the find widget is pinned above the content and remains above non-modal details instead of being covered by the desktop detail rail.
- **D-11:** Enter/Shift+Enter keeps focus in the find input. Clicking previous/next keeps focus on the clicked navigation button.
- **D-12:** Pressing Command+F/Ctrl+F while find is already open refocuses the input and selects the current query for replacement.
- **D-13:** Escape closes the find widget while preserving the query/results, then focuses the current matching timeline row.

### the agent's Discretion
- Choose the state shape that distinguishes search-driven selection from explicit inspection without duplicating the event selection model.
- Choose the exact pinned-widget layout, responsive dimensions, and layering implementation while preserving existing theme tokens and toolbar density.
- Choose how detail tabs and JSON expansion are controlled to reveal the first hidden match, including sensible behavior when a view cannot expose a match.
- Choose accessible announcements and labels for result counts and navigation state.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and prior search decisions
- `.planning/PROJECT.md` — Defines the local-first inspector, detail-first inspection value, and established decision that search highlights and navigates rather than filters.
- `.planning/STATE.md` — Records Phase 12 search semantics, Phase 14 keyboard navigation, and later find-widget behavior.
- `.planning/milestones/v1.1-ROADMAP.md` — Defines Phase 12's context-preserving search goal and Phase 14's Enter/Shift+Enter/F3 navigation hardening.
- `.planning/phases/14-hardening-state-diagnostics-scrolling-and-parsing-row-highli/14-CONTEXT.md` — Preserves selected > pair > search-match row precedence and treats this as UI polish rather than search transport rearchitecture.

### Current find and navigation implementation
- `packages/ui/src/components/filters/FilterBar.tsx` — Owns Command+F/Ctrl+F opening, find popover state, result count derivation, and navigation dispatch.
- `packages/ui/src/components/filters/SearchInputCore.tsx` — Owns Enter/Shift+Enter dispatch and input focus behavior.
- `packages/ui/src/components/filters/SearchPopover.tsx` — Current anchored widget layout, status copy, and previous/next controls.
- `packages/ui/src/components/timeline/TimelineRegion.tsx` — Converts find navigation into selected event indexes and owns F3 plus timeline keyboard navigation.
- `packages/ui/src/components/shell/AppShell.tsx` — Renders desktop detail rail versus narrow-screen drawer and currently moves focus to the drawer close button when the drawer opens.

### Detail rendering
- `packages/ui/src/components/detail/DetailPanel.tsx` — Detail tabs and selected-event rendering surface that must synchronize with unobstructive search navigation.
- `packages/ui/src/components/detail/PrettyJsonView.tsx` — Current collapsible JSON renderer; its unused query prop and expansion behavior are relevant to detail highlighting and reveal.

`.planning/REQUIREMENTS.md` is not currently present. Downstream planning should use the project, state, archived roadmap, prior Phase 14 context, and the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useVisibleSearchMatches()` already supplies event indexes that both pass active facets and match the query.
- `selectSearchMatch()` in `TimelineRegion.tsx` already wraps next/previous navigation across matching events and selects the resulting event.
- `searchPopoverOpen`, `selectedIdx`, and existing detail breakpoint handling already expose the core state needed to distinguish open find, selected result, and responsive detail mode.
- Timeline rows already receive `searchQuery` and `searchMatches`, so timeline highlighting should extend rather than replace the established path.

### Established Patterns
- Search result state is separate from faceted filtering; nonmatching rows stay visible.
- Selection is the shared mechanism for timeline emphasis, scrolling, and detail synchronization.
- Desktop details are a persistent rail, while narrow-screen details are a dialog-like drawer with a backdrop and initial focus transfer.
- Escape has an explicit priority order: close the find widget before clearing search or selection.
- Theme styling uses shared tokens and z-layer constants rather than per-theme component branches.

### Integration Points
- `FilterBar.tsx` and `SearchPopover.tsx` are the integration point for pinned placement, repeated Command+F/Ctrl+F behavior, counter wording, and focus restoration.
- `TimelineRegion.tsx` is the integration point for search-driven selection intent, event-level navigation, scrolling, and row focus after Escape.
- `AppShell.tsx` is the integration point for suppressing drawer opening/focus transfer only for search-driven selection while preserving explicit-click inspection.
- `DetailPanel.tsx` and its Summary/Pretty/Raw child views are the integration point for detail highlighting, tab reveal, and collapsed-branch expansion.

</code_context>

<specifics>
## Specific Ideas

- The central UX is uninterrupted repeated Enter/Shift+Enter navigation: showing details is acceptable, but covering find or stealing focus is not.
- Search remains event-oriented: one result means one request/response/notification row that contains at least one match.
- Explicit user inspection may temporarily take priority over find on narrow screens; clicking a row is allowed to open the drawer even while find remains open behind it.
- Closing find should land keyboard users on the current result, not on the toolbar trigger or an unrelated previously focused control.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 34-rethink-search-result-navigation-and-focus-behavior*
*Context gathered: 2026-06-27*
