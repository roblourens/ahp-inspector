# Phase 34: Rethink search result navigation and focus behavior - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 34-rethink-search-result-navigation-and-focus-behavior
**Areas discussed:** Navigation versus opening details, Event-level versus occurrence-level matches, Find widget focus and responsive placement

---

## Navigation versus opening details

### Search navigation and details

| Option | Selected |
|--------|----------|
| Keep details synchronized only when they do not obstruct search | ✓ |
| Never open or update details during search navigation | |
| Always open/update details, including the drawer | |

**User's choice:** Keep details synchronized only when they do not obstruct search.
**Notes:** Desktop details can update, but search-driven navigation must not open the narrow-screen drawer.

### Closing find after narrow-screen navigation

| Option | Selected |
|--------|----------|
| Keep the matched row selected but leave details closed | ✓ |
| Open details for the current match immediately | |
| Clear the search-driven selection | |

**User's choice:** Keep the matched row selected but leave details closed.

### Explicit row click while find is open

| Option | Selected |
|--------|----------|
| Treat the click as intent to inspect: close find and open details | |
| Keep find open and suppress details | |
| Open details over the still-open find widget | ✓ |

**User's choice:** Open details over the still-open find widget.
**Notes:** Explicit inspection is intentionally allowed to behave differently from Enter navigation.

### Focus while desktop details update

| Option | Selected |
|--------|----------|
| Always keep focus in the find input | ✓ |
| Move focus into details on the first result only | |
| Move focus into details on every result | |

**User's choice:** Always keep focus in the find input.

---

## Event-level versus occurrence-level matches

### Navigation granularity

| Option | Selected |
|--------|----------|
| Once per matching event | ✓ |
| Once per individual occurrence | |
| Event-level by default with a separate occurrence mode | |

**User's choice:** Once per matching event.

### Counter semantics

| Option | Selected |
|--------|----------|
| Count matching events, labeled clearly as results | ✓ |
| Count every text occurrence | |
| Show both event and occurrence counts | |

**User's choice:** Count matching events, labeled clearly as results.

### Highlight location

| Option | Selected |
|--------|----------|
| Highlight matches in both timeline row and visible detail content | ✓ |
| Highlight only the timeline row | |
| Highlight only the detail content | |

**User's choice:** Highlight matches in both the timeline row and visible detail content.

### Hidden detail matches

| Option | Selected |
|--------|----------|
| Reveal the first hidden match without changing event-level navigation | ✓ |
| Preserve the current detail view and highlight only visible text | |
| Show a match-location hint but never change tabs or expansion | |

**User's choice:** Reveal the first hidden match without changing event-level navigation.
**Notes:** Detail reveal supports the current event result; it does not introduce occurrence-by-occurrence navigation.

---

## Find widget focus and responsive placement

### Widget placement

| Option | Selected |
|--------|----------|
| Pinned above content and always above non-modal details | ✓ |
| Keep it anchored under the toolbar trigger | |
| Move it into the detail pane when details are visible | |

**User's choice:** Pinned above content and always above non-modal details.

### Previous/next button focus

| Option | Selected |
|--------|----------|
| Keep focus on the clicked button; keyboard navigation still stays in input | ✓ |
| Always return focus to the search input | |
| Move focus to the matched timeline row | |

**User's choice:** Keep focus on the clicked button; keyboard navigation still stays in the input.

### Repeated Command+F/Ctrl+F

| Option | Selected |
|--------|----------|
| Refocus the input and select the current query | ✓ |
| Refocus without selecting the query | |
| Leave focus wherever it is | |

**User's choice:** Refocus the input and select the current query.

### Escape focus destination

| Option | Selected |
|--------|----------|
| Restore the element that had focus before find opened | |
| Focus the current matching timeline row | ✓ |
| Focus the search trigger button | |

**User's choice:** Focus the current matching timeline row.
**Notes:** Escape closes only the widget; the query, results, and selected event remain active.

---

## the agent's Discretion

- Internal state design for distinguishing search navigation from explicit row inspection.
- Exact pinned layout, z-layer, accessibility announcement, detail-tab reveal, and JSON expansion implementation.

## Deferred Ideas

None.
