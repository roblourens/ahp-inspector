# Phase 34: Rethink search result navigation and focus behavior - Research

**Researched:** 2026-06-27
**Domain:** React (19) client-side find/navigation UX, focus management, responsive drawer/rail layout, collapsible JSON detail highlighting
**Confidence:** HIGH (all findings verified against the live codebase; no transport/server work required)

## Summary

This phase is **entirely UI-layer and entirely client-side**. The search transport already returns event-level matches: `GET /api/log/search` responds with `{ matches: number[], total, truncated }` where each entry is an *event index*, stored verbatim as `searchMatches: Set<number>` in the Zustand store. There is no per-occurrence counting anywhere — find already advances once per matching event. No server, protocol, or transport change is needed, and inventing any would violate the "do not invent protocol behavior" constraint. `[VERIFIED: packages/ui/src/transport/search-client.ts, packages/ui/src/state/store.ts]`

The central defect is **state conflation**: search-driven navigation (`selectSearchMatch` in `TimelineRegion.tsx`) calls the same `select(idx)` action that explicit row clicks use. Because `AppShell.tsx` derives the narrow-screen drawer's open state purely from `selectedIdx !== null`, every Enter/Shift+Enter jump opens (and re-focuses) the drawer on narrow screens, interrupting repeated navigation. The fix the agent's-Discretion item calls for — "a state shape that distinguishes search-driven selection from explicit inspection without duplicating the event selection model" — is the spine of the whole phase: a single discriminator (e.g. a `selectionSource: "search" | "explicit"` flag set alongside `selectedIdx`) lets AppShell suppress the drawer for search selections (D-02/D-03) while preserving it for clicks (D-04), and lets the desktop rail keep syncing without stealing focus (D-05).

Detail highlighting (D-08) and hidden-match reveal (D-09) are the second work cluster. `PrettyJsonView` and `RawJsonView` already accept a `query?` prop but ignore it; a battle-tested highlighter (`findMatchRanges` + `<mark>` rendering with theme tokens) already exists inside `EventNameLabel.tsx` and should be extracted to a shared util and reused — never re-implemented and never via `dangerouslySetInnerHTML`. Reveal-on-collapsed-branch (D-09) is feasible because `react-json-view-lite@2.5.0` exposes `shouldExpandNode(level, value, field)` which receives the node's *value*, so a subtree-contains-match predicate can auto-expand the path to the first match (with a `key`-based remount to re-evaluate on selection change).

**Primary recommendation:** Introduce a selection-source discriminator in the store, route search navigation through it, and gate the AppShell drawer on `source === "explicit"`. Reuse the existing `findMatchRanges` highlighter in the detail views, and drive react-json-view-lite expansion via a match-aware `shouldExpandNode`. Keep focus in the find input on Enter/Shift+Enter and on the clicked nav button on click; restore focus to the current matching row on Escape.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Event-level match set | API/Backend (search endpoint) | — | Already returns event indexes; no change. `[VERIFIED]` |
| Search-driven selection intent | Client store (Zustand) | — | New discriminator lives in shared UI state, not transport. |
| Find widget open/focus/shortcuts | Client (FilterBar/SearchPopover/SearchInputCore) | — | Pure DOM/React focus management. |
| Event-level navigation (next/prev/F3) | Client (TimelineRegion) | — | Already owns `selectSearchMatch` + `ahp-search-nav`. |
| Drawer-vs-rail responsive suppression | Client (AppShell) | — | Owns breakpoint + drawer render + focus transfer. |
| Detail highlight + collapsed-branch reveal | Client (DetailPanel + Pretty/Raw views) | — | Local rendering; react-json-view-lite expansion API. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Navigation versus opening details**
- **D-01:** Enter/Shift+Enter navigation selects the matching event and keeps details synchronized when the detail surface does not obstruct find, such as the desktop detail rail.
- **D-02:** Search-driven navigation must not open the narrow-screen detail drawer. The matching row remains selected while the drawer stays closed.
- **D-03:** Closing find after search-driven navigation keeps the current matching row selected and does not automatically open the suppressed drawer.
- **D-04:** An explicit timeline-row click is different from search navigation: it may open the narrow-screen detail drawer over the still-open find widget.
- **D-05:** Updating an unobstructive desktop detail pane must never steal keyboard focus from the find input.

**Event-level result semantics and detail highlighting**
- **D-06:** Find navigation advances once per matching event, not once per individual text occurrence inside an event.
- **D-07:** The find counter reports matching events and labels them as results rather than implying a count of text occurrences.
- **D-08:** The active query is highlighted in both the matching timeline row and the visible detail content for the selected result.
- **D-09:** If the selected event's first relevant match is hidden by the current detail tab or a collapsed JSON branch, the detail view should reveal that match without changing event-level navigation semantics.

**Find widget placement and focus**
- **D-10:** While open, the find widget is pinned above the content and remains above non-modal details instead of being covered by the desktop detail rail.
- **D-11:** Enter/Shift+Enter keeps focus in the find input. Clicking previous/next keeps focus on the clicked navigation button.
- **D-12:** Pressing Command+F/Ctrl+F while find is already open refocuses the input and selects the current query for replacement.
- **D-13:** Escape closes the find widget while preserving the query/results, then focuses the current matching timeline row.

### the agent's Discretion
- Choose the state shape that distinguishes search-driven selection from explicit inspection without duplicating the event selection model.
- Choose the exact pinned-widget layout, responsive dimensions, and layering implementation while preserving existing theme tokens and toolbar density.
- Choose how detail tabs and JSON expansion are controlled to reveal the first hidden match, including sensible behavior when a view cannot expose a match.
- Choose accessible announcements and labels for result counts and navigation state.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Do not turn search back into a row filter; do not add a new search language.)

## Phase Requirements

No `.planning/REQUIREMENTS.md` exists for this milestone and the orchestrator passed no requirement IDs. The locked decisions D-01..D-13 are the authoritative acceptance surface; the planner should treat each `D-NN` as a requirement.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | Enter/Shift+Enter selects + syncs detail when unobstructive | `selectSearchMatch` exists; desktop rail already non-stealing — needs source flag |
| D-02 | Search nav must not open narrow drawer | AppShell drawer gated on `selectedIdx` only — add source gate |
| D-03 | Closing find keeps row selected, drawer stays closed | Selection persists; ensure source flag isn't reset to "explicit" on close |
| D-04 | Explicit click may open drawer over find | Preserve current click path; click sets source="explicit" |
| D-05 | Desktop pane update never steals find-input focus | Desktop rail has no focus transfer today; verify + lock with test |
| D-06 | Advance once per matching event | Already true — `searchMatches` is event-index Set |
| D-07 | Counter labels "results" not occurrence count | `SearchPopover` status text currently says "match/matches" — reword |
| D-08 | Highlight query in row AND visible detail | `findMatchRanges` highlighter exists in EventNameLabel; reuse in detail views |
| D-09 | Reveal first hidden match (tab/collapsed branch) | `shouldExpandNode(level,value,field)` enables match-aware expansion |
| D-10 | Find widget pinned above non-modal details | Popover lives in FilterBar above app-main; verify z-order vs drawer |
| D-11 | Enter/Shift keeps input focus; click keeps button focus | SearchInputCore dispatches event w/o blur; verify nav buttons don't lose focus |
| D-12 | Cmd+F while open refocuses + selects query | NOT implemented — FilterBar keydown early-returns when popover open |
| D-13 | Escape closes find, preserves results, focuses current row | NOT implemented — no row focus restoration today |

## Standard Stack

This phase adds **no new dependencies**. All work uses libraries already in `packages/ui`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.6 | UI + focus refs/effects | Project standard `[VERIFIED: pnpm store]` |
| zustand | (in store) | Selection + search state | Existing `useAppStore` is the single source of UI state `[VERIFIED]` |
| react-json-view-lite | 2.5.0 | Collapsible Pretty JSON tree | Already the detail renderer; exposes the expansion hook needed for D-09 `[VERIFIED: dist/index.d.ts]` |
| lucide-react | (in use) | Chevron/X icons | Existing icon source `[VERIFIED]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-json-view-lite expansion hook | Swap JSON renderer for one with controlled expand state | Rejected — adds a dependency, breaks token styling + 256KB cap behavior, and the existing `shouldExpandNode` is sufficient |
| New `selectionSource` store field | A separate `searchSelectedIdx` parallel to `selectedIdx` | Rejected by the agent's-Discretion guidance ("without duplicating the event selection model") — duplication risks desync between detail load and timeline emphasis |

**Installation:** none.

**Version verification:** `react-json-view-lite@2.5.0` confirmed installed in the pnpm store at `node_modules/.pnpm/react-json-view-lite@2.5.0_react@19.2.6`; its `Props` type exports `shouldExpandNode?: (level: number, value: any, field?: string) => boolean`, `clickToExpandNode?`, `beforeExpandChange?(event: NodeExpandingEvent)`, and `allExpanded()`. `[VERIFIED: dist/index.d.ts]`

## Architecture Patterns

### System Architecture Diagram (current find data flow)

```
                     Cmd+F / "/"                Enter / Shift+Enter            ▲/▼ buttons
                          │                            │                            │
                          ▼                            ▼                            ▼
                 FilterBar.openSearch()      SearchInputCore.onKeyDown      SearchPopover button
                 setSearchPopoverOpen(true)   dispatch CustomEvent          onNavigate()→dispatch
                 focus popover input          "ahp-search-nav"              "ahp-search-nav"
                          │                            │                            │
                          │                            └──────────────┬─────────────┘
                          │                                           ▼
                          │                            window "ahp-search-nav" listener
                          │                                (TimelineRegion useEffect)
                          │                                           │
                          │                                           ▼
                          │                            selectSearchMatch(dir)
                          │                            → next idx from useVisibleSearchMatches()
                          │                            → select(idx)   ◀── SHARED with row click
                          │                                           │
                          ▼                                           ▼
                 SearchPopover (z=popover 1100)            store.selectedIdx = idx
                 absolute, top:100%, right:12                          │
                 inside FilterBar (above app-main)     ┌───────────────┼────────────────────┐
                                                       ▼               ▼                    ▼
                                          TimelineList scroll   DetailPanel fetch    AppShell drawer
                                          to selected (center)  /api/event/:idx      (narrow): opens +
                                          + <mark> highlight     → Pretty/Raw views   focuses close btn
                                                                                      ◀── PROBLEM (D-02)
```

The single bug-class root: `select(idx)` fans out to *three* consumers, one of which (the narrow drawer) must NOT react to search-driven selection. The discriminator must travel with the selection so AppShell can branch.

### Recommended change shape (conceptual, not file listing)

```
store:    selectedIdx + selectionSource ("search" | "explicit")   ← new discriminator
            selectIdx(idx, source="explicit")                       ← default keeps click behavior
TimelineRegion: selectSearchMatch → select(idx, "search")
EventRow onClick → select(idx, "explicit")   (already the default)
AppShell:  drawerOpen = !isDetailDesktop && selectedIdx !== null && selectionSource === "explicit"
           desktop rail: render unconditionally on selectedIdx (D-01), never focus-transfer (D-05)
DetailPanel: pass searchQuery to PrettyJsonView/RawJsonView; compute reveal target
```

### Pattern 1: Selection-source discriminator (the agent's Discretion → recommend)
**What:** Add `selectionSource` to the store, set whenever `selectedIdx` changes. `selectIdx(idx)` defaults to `"explicit"` so every existing call site (row click, keyboard arrows) keeps current behavior; only `selectSearchMatch` passes `"search"`.
**When to use:** Any consumer that must behave differently for find-driven vs. inspection-driven selection (only AppShell's narrow drawer today).
**Why this shape:** One field, no duplicated index, no risk of detail/timeline desync. Reset rules: an explicit click after search navigation flips it to `"explicit"` (D-04); closing find leaves it untouched (D-03).

### Pattern 2: Match-aware JSON expansion (D-09)
**What:** Pass a predicate to `shouldExpandNode(level, value, field)` that returns `true` when `value`'s serialized subtree contains the query (case-insensitive), so the path to the first match auto-expands on mount. Because react-json-view-lite evaluates `shouldExpandNode` at mount/remount (expansion is internally uncontrolled), change the component `key` (e.g. `key={selectedIdx + ":" + query}`) so a new selection or query re-runs expansion.
**When to use:** Pretty tab only. Raw tab is a `<pre>` — already fully expanded, so D-09's "collapsed branch" sub-case doesn't apply there; the tab-switch sub-case (match only visible on the other tab) is handled by selecting the tab that can show the match.
**Fallback (the agent's Discretion):** When a view genuinely cannot expose a match (e.g. match is in a field hidden by truncation banner at >256KB), keep navigation semantics unchanged and do nothing destructive — the row is still selected and highlighted.

### Pattern 3: Reuse the existing highlighter (D-08)
**What:** `EventNameLabel.tsx` contains `findMatchRanges(text, query)` (min query length 2, case-insensitive, non-overlapping ranges) and `renderHighlightedSegment` which emits `<mark>` with `var(--color-search-match-bg)`/`var(--color-search-match-fg)`. Extract these into a shared module (e.g. `cells/highlight.tsx` or a `detail/` sibling) and consume from both the timeline cell and the detail views.
**Why:** XSS-safe (React text children, no `innerHTML`), already theme-tokenized for dark/light/hacker, already unit-shaped.

### Anti-Patterns to Avoid
- **Duplicating selection state** (`searchSelectedIdx` parallel to `selectedIdx`): risks detail/timeline desync; the agent's-Discretion guidance forbids it.
- **`dangerouslySetInnerHTML` for highlighting:** banned — `RawJsonView`/`PrettyJsonView` carry an explicit "React auto-escapes; NO dangerouslySetInnerHTML" guarantee for arbitrary payloads.
- **Filtering rows on search:** out of scope and contradicts the locked product decision (search highlights+navigates; facets filter).
- **Regex from user query:** existing search uses `String.prototype.includes`/`indexOf` (ReDoS mitigation T-03-01-01); keep highlight matching literal, not regex.
- **Per-theme component branches:** use shared tokens + `Z` z-layer constants (`zLayers.test.ts` enforces parity with `tokens.css`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query highlighting in text | New tokenizer + `<span>` splitter | Extract existing `findMatchRanges` + `renderHighlightedSegment` from `EventNameLabel.tsx` | Already tokenized, XSS-safe, tested-shape |
| Collapsible JSON expansion | A controlled expand-state tree | `react-json-view-lite` `shouldExpandNode(level,value,field)` | Library already renders detail; reinventing breaks 256KB cap + styles |
| Event-level match set | Client-side scan of payloads | Existing `searchMatches: Set<number>` from `/api/log/search` | Already event-indexed; D-06 is free |
| Visible (facet-aware) match ordering | Re-filtering matches | `useVisibleSearchMatches()` selector | Already intersects matches with active facets |
| Scroll selected row into view | Custom scroll math | `TimelineList`'s existing `v.scrollToIndex(.., {align:"center"})` effect | Already skips when row is comfortably visible |

**Key insight:** Almost every primitive this phase needs already exists; the work is *re-wiring and discriminating*, not building. The highest-novelty piece (match-aware expansion) is a ~15-line predicate over an existing library hook.

## Common Pitfalls

### Pitfall 1: Drawer focus-steal re-introduced via selection
**What goes wrong:** AppShell's effect `if (drawerOpen && !drawerWasOpenRef.current) drawerCloseRef.current?.focus()` fires whenever the drawer transitions closed→open. If the drawer-open condition still includes search-driven selections, repeated Enter pulls focus to the close button.
**Why it happens:** `drawerOpen` derives from `selectedIdx` alone.
**How to avoid:** Gate `drawerOpen` on `selectionSource === "explicit"`. Verify the `drawerWasOpenRef` latch still resets correctly when an explicit click later opens it.
**Warning signs:** After typing a query and hitting Enter twice on a narrow viewport, the second Enter doesn't advance (focus left the input).

### Pitfall 2: react-json-view-lite expansion is uncontrolled
**What goes wrong:** Updating the `shouldExpandNode` predicate alone does not collapse/expand already-mounted nodes — expansion is decided at mount.
**Why it happens:** The library tracks expansion in internal state seeded from `shouldExpandNode`.
**How to avoid:** Remount via a `key` that includes `selectedIdx` and the query so a new result re-seeds expansion. Keep the key stable across unrelated re-renders to avoid losing user's manual expand/collapse.
**Warning signs:** First navigation reveals the match; subsequent navigations to a new event don't expand to the new match.

### Pitfall 3: Counter wording implies occurrence count (D-07)
**What goes wrong:** `SearchPopover` renders `"{n} of {m} matches"`. "matches" can read as text occurrences.
**Why it happens:** Legacy copy from Phase 12/14.
**How to avoid:** Reword to results-of-events language (e.g. `"{n} of {m} results"` / `"{m} matching events"`). Keep `aria-live`/`aria-atomic` semantics; consider an explicit `aria-label` for screen-reader clarity (the agent's-Discretion: accessible announcements).
**Warning signs:** A single event with 5 textual hits still counts as 1 — confirm copy matches that reality.

### Pitfall 4: Escape priority order regression (D-13)
**What goes wrong:** Escape has a layered contract: SearchPopover's own `keydown` listener closes the widget; TimelineRegion's `onKey` early-returns while `searchPopoverOpen` is true, then handles search-clear, then selection-clear. Adding "focus the current row after close" must slot in without clearing the query/results or the selection.
**Why it happens:** Two independent Escape listeners (`SearchPopover` + `TimelineRegion`) plus a third in `AppShell` (drawer close).
**How to avoid:** On find-close-via-Escape, preserve `searchQuery`/`searchMatches`/`selectedIdx` and move focus to the selected row element (rows are focusable/`tabIndex`-managed at the region level). Don't let AppShell's drawer Escape handler fight it on narrow screens.
**Warning signs:** Escape clears the query, or focus lands on the toolbar trigger instead of the current result row.

### Pitfall 5: Cmd+F-while-open is swallowed (D-12)
**What goes wrong:** `FilterBar`'s `handleKeyDown` returns immediately `if (isSearchPopoverOpen)`, so a second Cmd+F does nothing (browser-native find is already suppressed by the first).
**How to avoid:** When the popover is open and Cmd+F/Ctrl+F fires, instead of early-returning, refocus the input and `select()` its text for replacement. Keep `e.preventDefault()` so the OS find never appears.
**Warning signs:** Pressing Cmd+F twice does not re-select the query text.

## Code Examples

### Existing highlighter to extract (D-08)
```tsx
// Source: packages/ui/src/components/timeline/cells/EventNameLabel.tsx  [VERIFIED]
function findMatchRanges(text: string, query: string): MatchRange[] {
  if (query.length < 2) return [];
  const ranges: MatchRange[] = [];
  const lower = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  let last = 0;
  let idx = lower.indexOf(lowerQ, last);
  while (idx !== -1) {
    ranges.push({ start: idx, end: idx + query.length });
    last = idx + query.length;
    idx = lower.indexOf(lowerQ, last);
  }
  return ranges;
}
// renders <mark style={{ background: var(--color-search-match-bg),
//                        color: var(--color-search-match-fg) }}>
```

### react-json-view-lite expansion hook (D-09)
```tsx
// Source: react-json-view-lite@2.5.0 dist/index.d.ts  [VERIFIED]
export interface Props extends React.AriaAttributes {
  data: unknown;
  style?: Partial<StyleProps>;
  shouldExpandNode?: (level: number, value: any, field?: string) => boolean;
  clickToExpandNode?: boolean;
  beforeExpandChange?: (event: NodeExpandingEvent) => boolean;
}
// Current usage (packages/ui/src/components/detail/PrettyJsonView.tsx):
//   shouldExpandNode={(level) => level < 5}   ← replace with match-aware predicate
//   <JsonView key={selectedIdx + ':' + query} ... />  ← add key to re-seed expansion
```

### Current search→selection coupling (the seam to split)
```tsx
// Source: packages/ui/src/components/timeline/TimelineRegion.tsx  [VERIFIED]
const selectSearchMatch = useCallback((direction) => {
  if (visibleSearchMatches.length === 0) return;
  /* ...compute next... */
  if (next !== undefined) select(next);   // ← pass a "search" source here
}, [select, visibleSearchMatches]);
```

```tsx
// Source: packages/ui/src/components/shell/AppShell.tsx  [VERIFIED]
const drawerOpen = !isDetailDesktop && selectedIdx !== null;  // ← add: && source === "explicit"
if (drawerOpen && !drawerWasOpenRef.current) drawerCloseRef.current?.focus();
```

## Runtime State Inventory

Not a rename/refactor/migration phase — this is UI behavior work. No stored data, live-service config, OS-registered state, secrets/env, or build artifacts are touched. **None — verified by phase scope (no string rename, no datastore keys, no external service config).**

## Environment Availability

Skipped — phase is pure client-side code/config within `packages/ui`. No new external tools, services, or runtimes. Existing dev/test toolchain (pnpm, vitest, playwright, tsx CLI) is already present and exercised by the project.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Search filters rows | Search highlights + navigates; facets filter | Phase 12 (v1.1) | This phase must NOT regress to filtering |
| Single Enter to next match, no cycling | Enter/Shift+Enter + F3 cycle, scroll-to-current | Phase 14 (v1.1) | Reuse `selectSearchMatch`; don't rebuild |
| Search box in toolbar | Cmd+F find popover, icon-only trigger, Esc closes widget first | Phases 26/29 | D-12/D-13 extend this existing popover |

**Deprecated/outdated:** none relevant. react-json-view-lite 2.x `shouldExpandNode` signature `(level, value, field)` is current (older 1.x only passed `level`).

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (jsdom env) + @testing-library/react; Playwright for E2E |
| Config file | `vitest.config.ts` (root), `playwright.config.ts` (root) |
| Quick run command | `pnpm vitest run packages/ui/src/components/filters packages/ui/src/components/shell packages/ui/src/components/detail packages/ui/src/components/timeline` |
| Full suite command | `pnpm test` (i.e. `vitest run`) then `pnpm -r typecheck` and `pnpm lint` |

Baseline: ~101 vitest files in `packages/`; milestone audit recorded 1095 passing tests. E2E specs live in `e2e/phaseNN.spec.ts` and connect to a CLI server (some self-spawn via `tsx`, some assume `127.0.0.1:5173`).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Enter selects + desktop rail syncs | unit (RTL) | `pnpm vitest run packages/ui/src/components/timeline/TimelineRegion.test.tsx` | ✅ (extend) |
| D-02 | Search nav does NOT open narrow drawer | unit (RTL, matchMedia stub) | `pnpm vitest run packages/ui/src/components/shell/AppShell.test.tsx` | ✅ (extend) |
| D-03 | Closing find keeps row, drawer stays closed | unit (RTL) | `pnpm vitest run packages/ui/src/components/shell/AppShell.test.tsx` | ✅ (extend) |
| D-04 | Explicit click opens drawer over find | unit (RTL) | `pnpm vitest run packages/ui/src/components/shell/AppShell.test.tsx` | ✅ (extend) |
| D-05 | Desktop pane update doesn't steal find focus | unit (RTL, document.activeElement) | `pnpm vitest run packages/ui/src/components/shell/AppShell.test.tsx` | ✅ (extend) |
| D-06 | One advance per matching event | unit | `pnpm vitest run packages/ui/src/components/timeline/TimelineRegion.test.tsx` | ✅ (extend) |
| D-07 | Counter labels results, not occurrences | unit | `pnpm vitest run packages/ui/src/components/filters/SearchPopover.test.tsx` | ✅ (extend) |
| D-08 | Query highlighted in detail content | unit | `pnpm vitest run packages/ui/src/components/detail/PrettyJsonView.test.tsx` | ✅ (extend) + ❌ new highlight util test (Wave 0) |
| D-09 | First hidden match revealed (expand/tab) | unit | `pnpm vitest run packages/ui/src/components/detail/DetailPanel.test.tsx` | ✅ (extend) |
| D-10 | Find widget pinned above non-modal detail | unit (z-order/DOM) + E2E | `pnpm vitest run packages/ui/src/components/filters/FilterBar.test.tsx` | ✅ (extend) |
| D-11 | Enter keeps input focus; click keeps button focus | unit (activeElement) | `pnpm vitest run packages/ui/src/components/filters/SearchPopover.test.tsx` | ✅ (extend) |
| D-12 | Cmd+F while open refocuses + selects query | unit | `pnpm vitest run packages/ui/src/components/filters/FilterBar.test.tsx` | ✅ (extend) |
| D-13 | Escape closes find, preserves results, focuses row | unit | `pnpm vitest run packages/ui/src/components/timeline/TimelineRegion.test.tsx` | ✅ (extend) |
| D-01..D-13 | End-to-end find-and-navigate flow | E2E (Playwright) | `pnpm e2e e2e/phase34.spec.ts` | ❌ new (Wave 0) |

### Sampling Rate
- **Per task commit:** the targeted `pnpm vitest run <touched dir>` quick command above.
- **Per wave merge:** `pnpm test` (full vitest) + `pnpm -r typecheck` + `pnpm lint`.
- **Phase gate:** full vitest green, typecheck green, biome clean, and `pnpm e2e e2e/phase34.spec.ts` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `e2e/phase34.spec.ts` — new Playwright spec covering D-01..D-13 against a fixture log (follow `e2e/phase12.spec.ts` self-spawn pattern or the `phase14.spec.ts` 5173 pattern; commit screenshots under `screenshots/phase34/` from a `test/fixtures/*.jsonl` only).
- [ ] `packages/ui/src/components/{timeline/cells|detail}/highlight.test.ts` — unit test for the extracted `findMatchRanges`/highlight util (new shared module).
- [ ] Shared narrow-screen test helper: AppShell tests must stub `window.matchMedia` to simulate `< 1400px`; confirm a reusable stub exists or add one in `test-setup`/local helper.
- *(Framework install: none — vitest, RTL, Playwright already configured.)*

## Security Domain

`security_enforcement` not set → enabled. This phase renders arbitrary log payloads (which may contain secrets/prompts/paths) into detail highlight markup, so input handling matters even though there is no network surface change.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in UI navigation |
| V3 Session Management | no | N/A |
| V4 Access Control | no | Local-only viewer; no new endpoints |
| V5 Input Validation / Output Encoding | yes | Highlight via React text children + `<mark>`; NEVER `dangerouslySetInnerHTML`; literal (non-regex) query matching (ReDoS-safe per existing T-03-01-01) |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for {React detail rendering of untrusted JSON}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via highlighted payload content | Tampering/Elevation | React auto-escaping; `<mark>` wraps text nodes only; no innerHTML (explicit guarantee in RawJsonView/PrettyJsonView) |
| ReDoS via query string | DoS | Literal `indexOf`/`includes` matching, no regex compile from user input; query already capped (256 chars / 5000 results server-side) |
| Secret leakage into committed artifacts | Information Disclosure | Phase-34 screenshots must come from `test/fixtures/*.jsonl`, never real session logs (copilot-instructions constraint) |

## Project Constraints (from copilot-instructions.md)

- **Do not change implementation code beyond this UI phase's scope; do not invent protocol behavior** (orchestrator + repo instruction). Search transport is already event-level — no protocol/server work.
- **Local-only privacy:** no telemetry, CDN assets, or outbound network for viewing logs. This phase adds none.
- **Committed screenshots/samples must come from `test/fixtures/*.jsonl`** (fake fixtures), never real `~/.vscode-oss-agents-dev/logs/**` content. Save under `screenshots/phase34/`.
- **Theme tokens, not hex:** `no-hex-in-components.test.ts` enforces `var(--*)` usage; `zLayers.test.ts` enforces `Z`↔`--z-*` parity. Reuse `--color-search-match-bg/-fg` and `Z.popover`/`Z.drawer`.
- **Branching:** one dev branch per phase (`phase-34`), squash-merge to local `main` on completion; do not push without explicit approval.
- **Portable core:** keep DOM/React concerns in `packages/ui`; do not leak Node/DOM into core parser/search projection modules.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | react-json-view-lite expansion is internally uncontrolled, so changing `shouldExpandNode` requires a `key` remount to re-evaluate | Pitfall 2 / Pattern 2 | If the lib re-evaluates on prop change, the `key` remount is unnecessary (harmless but extra). Verify empirically in a test during planning/execution. |
| A2 | Desktop rail currently does not steal focus on selection (AppShell focus-transfer is guarded by `!isDetailDesktop`) so D-05 mostly needs a regression test, not new code | D-05 row, Pitfall 1 | If some other effect focuses the rail, D-05 needs real code. Low risk — code read shows focus transfer only in the narrow-drawer branch. |
| A3 | "results" wording (D-07) is acceptable copy; exact string is the agent's-Discretion | Pitfall 3 / D-07 | Planner/UX may prefer different copy; non-blocking. |

## Open Questions

1. **Reset semantics of `selectionSource` across the find lifecycle (D-03 vs D-04).**
   - What we know: closing find must keep the row selected and NOT open the drawer (D-03); an explicit click after navigation may open it (D-04).
   - What's unclear: when find closes via Escape, should `selectionSource` stay `"search"` (so a later resize to narrow doesn't pop the drawer) or flip to `"explicit"`?
   - Recommendation: keep it `"search"` until the next explicit user action (click/arrow-key) — most consistent with D-03's "does not automatically open the suppressed drawer."

2. **E2E narrow-viewport coverage approach.**
   - What we know: drawer/rail switch at 1400px; Playwright can set viewport size.
   - What's unclear: whether to assert focus/drawer behavior in jsdom unit tests (matchMedia stub) only, or also in Playwright at `<1400px`.
   - Recommendation: cover focus/drawer logic in fast RTL unit tests with a matchMedia stub; use one Playwright scenario for the holistic happy-path at narrow and wide widths.

## Sources

### Primary (HIGH confidence)
- Live codebase (read in full this session): `FilterBar.tsx`, `SearchInputCore.tsx`, `SearchPopover.tsx`, `TimelineRegion.tsx`, `AppShell.tsx`, `DetailPanel.tsx`, `PrettyJsonView.tsx`, `RawJsonView.tsx`, `DetailTabs.tsx`, `EventNameLabel.tsx`, `ResultCounter.tsx`, `useSearch.ts`, `search-client.ts`, `selectors.ts`, `store.ts`, `TimelineList.tsx`, `zLayers.ts`, `detail-layout.ts`, `tokens.css`.
- `react-json-view-lite@2.5.0` type definitions: `node_modules/.pnpm/react-json-view-lite@2.5.0_react@19.2.6/.../dist/index.d.ts` (`shouldExpandNode`, `beforeExpandChange`, `allExpanded`).
- `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.github/copilot-instructions.md`, `.planning/phases/14-.../14-CONTEXT.md` (row precedence `selected > pair-highlight > search-match`).
- `vitest.config.ts`, `playwright.config.ts`, `e2e/phase12.spec.ts`, `e2e/phase14.spec.ts`, `package.json` scripts.

### Secondary (MEDIUM confidence)
- Test baseline counts (1095 tests / 91 files) from PROJECT.md milestone audit — approximate; current file count ~101.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all versions verified in pnpm store.
- Architecture: HIGH — every integration point read directly; root cause (selection conflation) confirmed in source.
- Pitfalls: HIGH for 1/3/4/5 (verified in code); MEDIUM for 2 (react-json-view-lite expansion behavior — see A1).

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 (stable internal codebase; re-verify only if `react-json-view-lite` or the search transport changes)
