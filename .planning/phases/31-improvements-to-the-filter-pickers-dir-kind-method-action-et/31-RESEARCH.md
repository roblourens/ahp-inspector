# Phase 31: Improvements to the Filter Pickers - Research

**Researched:** 2026-06-11
**Domain:** React facet-picker interaction, deterministic option ordering, compact popover layout, and fixture-backed UI verification
**Confidence:** HIGH
**Context:** The user explicitly chose to continue without a `CONTEXT.md`; Phase 31's roadmap goal and the request that launched this research are the locked scope. [VERIFIED: `gsd-tools.cjs init phase-op 31`; `.planning/ROADMAP.md`]

## Summary

Phase 31 should be planned as a focused browser-UI polish slice over the existing Phase 25 visibility-menu architecture. The current data contract is already correct: categorical filter arrays store hidden values, `FacetPopover` receives the corresponding checked-visible values, and bulk operations translate back through `FilterBar`. No state schema, persistence migration, server work, host adapter change, or new dependency is needed. [VERIFIED: `packages/ui/src/state/filters.ts`; `packages/ui/src/components/filters/FilterBar.tsx`; Phase 25 research and summaries]

The conventional bulk behavior should be one full-facet contextual command: show `Uncheck all` only when every complete option is selected; otherwise show `Select all`. The command must always operate on the complete `options` array, never only the query-filtered or first-100 visible subset. This preserves Phase 25's checked-means-visible contract, makes the default-hidden `ping` state immediately offer `Select all`, and avoids a misleading third state for partial selection. [VERIFIED: `FacetPopover.tsx`; `FilterBar.test.tsx`; `25-UI-SPEC.md`] [RECOMMENDED: current checked-visible semantics]

Sort every categorical picker by visible label ascending, case-insensitively, with raw `value` as a deterministic tie-breaker. Do not sort by count: facet counts change as live rows arrive, so count order can move a checkbox while the user is interacting. The current order is first-occurrence order because `useFacetCounts` fills `Map` objects while scanning timeline rows and `mapToOptions` preserves map iteration order. [VERIFIED: `packages/ui/src/state/selectors.ts`; `packages/ui/src/components/filters/FilterBar.tsx`] [RECOMMENDED: stable interaction geometry]

The two reported layout defects share a concrete box-model cause. The searchable facet input and each selected grouping row use `width: "100%"` with horizontal padding/border, but the project has no global `box-sizing: border-box` rule. Their rendered boxes can therefore exceed their parent width. Add local `boxSizing: "border-box"` to those full-width controls, preserving the existing compact inline-style pattern. [VERIFIED: `FacetPopover.tsx`; `GroupToggleChip.tsx`; `global.css` grep for `box-sizing`] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing]

**Primary recommendation:** Implement one shared, contextual full-facet bulk toggle; sort options once in `mapToOptions` by display label plus raw-value tie-breaker; remove the footer `Close` action; apply local border-box sizing to the facet search input and grouping rows; then prove the complete interaction and geometry with focused component tests plus fixture-only desktop/narrow Playwright screenshots.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Contextual bulk-toggle label and action | Browser / Client | — | It derives entirely from `options` and `selected` props and calls the existing `onChange` callback. [VERIFIED: `FacetPopover.tsx`] |
| Deterministic categorical-option ordering | Browser / Client | — | `FilterBar.mapToOptions` is the existing projection boundary from facet-count maps to display options. [VERIFIED: `FilterBar.tsx`; `selectors.ts`] |
| Facet search-input box geometry | Browser / Client | — | The defect is local CSS box sizing inside `FacetPopover`. [VERIFIED: `FacetPopover.tsx`; `global.css`] |
| Group picker selected-row background geometry | Browser / Client | — | The selected background and full-width row are local inline styles in `GroupTogglePopover`. [VERIFIED: `GroupToggleChip.tsx`] |
| Responsive and visual proof | Browser / Client | CLI / local server test harness | Playwright launches the local CLI against synthetic fixture data and captures browser evidence. [VERIFIED: `e2e/phase25.spec.ts`; Phase 25 summary 04] |

## Project Constraints (from copilot-instructions.md)

- Keep the portable browser UI behind the host-adapter boundary; this phase must not add Node-specific behavior to the UI. [VERIFIED: `.github/copilot-instructions.md`]
- Preserve the local-only privacy posture: no telemetry, CDN assets, or outbound viewing dependencies. [VERIFIED: `.github/copilot-instructions.md`]
- Use real AHP logs only for local inspection; every saved/committed screenshot or sample must come from fake fixtures and belongs under `screenshots/phase31/`. [VERIFIED: `.github/copilot-instructions.md`]
- Use `../agent-host-protocol` as the protocol source of truth; Phase 31 does not need protocol changes. [VERIFIED: `.github/copilot-instructions.md`; inspected Phase 31 surface]
- Keep changes focused and preserve existing virtualization, incremental parsing, correlation, and filter-state boundaries. [VERIFIED: `.github/copilot-instructions.md`; `.planning/STATE.md`]
- There is no active `.planning/REQUIREMENTS.md`; Phase 31 requirements remain TBD in the roadmap, so the planner must map tasks directly to the locked goal slices until a requirements ledger is restored. [VERIFIED: workspace file search; `.planning/ROADMAP.md`]
- Nyquist validation is enabled and research must include validation architecture. [VERIFIED: `.planning/config.json`]

## Current Implementation Findings

### Facet option and selection flow

```text
Zustand rows
  -> useFacetCounts() scans rows into insertion-ordered Maps
  -> FilterBar.mapToOptions() projects Map entries without sorting
  -> visibleSelectionFromHidden() converts stored exclusions to checked values
  -> FacetPopover renders searchable/limited checked rows and footer actions
  -> onChange(complete visible values)
  -> hiddenValuesFromSelection() converts checked values back to exclusions
  -> patchFilter() updates the existing durable filter state
```

[VERIFIED: `packages/ui/src/state/selectors.ts`; `packages/ui/src/components/filters/FilterBar.tsx`; `FacetPopover.tsx`]

- `useFacetCounts` scans all rows and inserts values into `Map`s as they are first encountered; count increments do not alter insertion order. [VERIFIED: `selectors.ts`]
- `mapToOptions` currently maps entries directly and therefore exposes first-occurrence order to users. [VERIFIED: `FilterBar.tsx`]
- Only Method, Channel, and Turn currently enable the popover-local text filter; every categorical picker uses the same `FacetPopover`. [VERIFIED: `FilterBar.tsx`]
- `FacetPopover` limits rendered option rows to 100 after applying its local query and reports the overflow count. [VERIFIED: `FacetPopover.tsx`]
- Existing `Select all` and `Uncheck all` actions correctly use the complete `options` array rather than `filtered` or `visible`. [VERIFIED: `FacetPopover.tsx`; `FilterBar.test.tsx`]
- Phase 25 established that checked means visible, arrays store hidden values, `ping` is hidden by application default, and newly discovered non-hidden values appear visible. Phase 31 must preserve these semantics exactly. [VERIFIED: `filters.ts`; `25-UI-SPEC.md`; `25-RESEARCH.md`; `FilterBar.test.tsx`]

### Closure behavior

- A facet popover currently closes when the user clicks outside it or clicks its open facet chip again; it also has a visible `Close` footer button. [VERIFIED: `FacetPopover.tsx`; `FilterBar.test.tsx`]
- `FacetPopover` does not currently install an Escape handler, while the neighboring `SearchPopover` does. [VERIFIED: `FacetPopover.tsx`; `SearchPopover.tsx`]
- Removing `Close` does not require a new state owner because click-outside and trigger-toggle closure already exist. [VERIFIED: `FacetPopover.tsx`; `FilterBar.tsx`]

**Recommendation:** Remove only the visible `Close` footer action in the required slice. Preserve click-outside and chip-toggle closure. Add Escape-to-close only if the planner explicitly includes the corresponding event-propagation regression, because `TimelineRegion` also handles Escape for search/selection and Phase 29 deliberately protects filter state. [VERIFIED: `TimelineRegion.tsx`; `SearchPopover.tsx`; Phase 29 roadmap goal] [RECOMMENDED: avoid accidental Escape behavior regression]

### Layout root causes

- The searchable facet header wraps an input with `width: "100%"`, border, and horizontal padding but no `boxSizing`; standard `content-box` sizing adds padding and border outside that width. [VERIFIED: `FacetPopover.tsx`] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing]
- Grouping option labels use `width: "100%"`, horizontal padding, and a selected-row background but no `boxSizing`; the selected background can therefore extend beyond the popover's content width. [VERIFIED: `GroupToggleChip.tsx`] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing]
- `SearchPopover` already demonstrates the local project fix by applying `boxSizing: "border-box"` to a constrained raised surface. [VERIFIED: `SearchPopover.tsx`]
- The persistent `RowFilterInput` is a separate toolbar control and is not the likely target of the picker-local “filter input layout” defect. It already lives in a flex wrapper and has independent Phase 29 Escape behavior. [VERIFIED: `RowFilterInput.tsx`; `RowFilterInput.test.tsx`; Phase 31 scope wording]

## Standard Stack

No package installation or update is required. Use the repository's installed stack and local component patterns. [VERIFIED: `package.json`; `packages/ui/package.json`; inspected implementation]

### Core

| Library / API | Version | Purpose | Why Standard Here |
|---------------|---------|---------|-------------------|
| React | 19.2.6 | Render picker state and local effects | Existing filter and grouping controls are React components. [VERIFIED: `packages/ui/package.json`; component imports] |
| Native checkbox/radio/input/button controls | Browser platform | Preserve checked-visible and grouping interactions | Existing controls and tests depend on native semantics and focus behavior. [VERIFIED: `FacetPopover.tsx`; `GroupToggleChip.tsx`; `FilterBar.test.tsx`] |
| Existing semantic CSS tokens | Repository-local | Color, spacing, borders, focus, raised surfaces | Project rules and Phase 25 require token-only styling across Dark, Light, and Hacker themes. [VERIFIED: `.github/copilot-instructions.md`; `25-UI-SPEC.md`; `tokens.css`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.5 | Focused component regressions | Test bulk-label state, ordering, removal of `Close`, and geometry style contract. [VERIFIED: root `package.json`; Vitest configs] |
| React Testing Library | 16.3.2 | Interact with picker controls by accessible role/name | Extend `FilterBar.test.tsx`; a dedicated `FacetPopover.test.tsx` is optional if the planner wants tighter ownership. [VERIFIED: `packages/ui/package.json`; `FilterBar.test.tsx`] |
| Playwright | 1.59.1 | Fixture-backed responsive browser verification and screenshots | Verify rendered bounding boxes and desktop/narrow picker appearance. [VERIFIED: root `package.json`; local `npx playwright --version`; `e2e/phase25.spec.ts`] |

**Installation:** None. [VERIFIED: no new capability requires a dependency]

## Architecture Patterns

### System Architecture Diagram

```text
Local/synthetic JSONL fixture
          |
          v
 Existing CLI + local-only HTTP/SSE server
          |
          v
 Browser store rows -> useFacetCounts() -> Map counts
                                      |
                                      v
                          mapToOptions(label, count)
                                      |
                       deterministic label sort
                                      |
                                      v
 FacetChip click -> FacetPopover -> checkbox / contextual bulk action
                                      |
                                      v
                  existing hidden-value adapter -> patchFilter()

 GroupToggleChip click -> GroupTogglePopover -> radio selection -> setGrouping()

 Playwright fixture flow -> desktop/narrow geometry assertions -> screenshots/phase31/
```

[VERIFIED: current code and Phase 25 E2E architecture]

### Recommended Project Structure

```text
packages/ui/src/components/filters/
├── FacetPopover.tsx          # contextual bulk command, footer/input layout
├── FilterBar.tsx             # deterministic option projection and picker wiring
├── GroupToggleChip.tsx       # grouping option background geometry
└── FilterBar.test.tsx        # focused interaction/order/layout contract
e2e/
└── phase31.spec.ts           # fixture-only browser geometry and screenshots
screenshots/phase31/
├── 01-method-contextual-bulk.png
├── 02-method-search-layout.png
└── 03-group-session-background.png
```

[RECOMMENDED: smallest ownership-aligned file set based on current implementation]

### Pattern 1: Contextual Complete-Set Bulk Toggle

**What:** Derive one command from whether every complete option value is selected. `allSelected` must compare against `options`, not `filtered` or `visible`. When `allSelected` is true, render `Uncheck all` and call `onChange([])`; otherwise render `Select all` and call `onChange(options.map(...))`. [RECOMMENDED: Phase 31 locked scope and Phase 25 semantics]

**When to use:** Every categorical `FacetPopover`; never the Time range picker or single-select Group picker. [VERIFIED: `FilterBar.tsx`; Phase 25 UI contract]

```tsx
// Source: existing FacetPopover prop contract plus Phase 31 recommendation
const allSelected = options.length > 0 && options.every((option) => selected.includes(option.value));
const bulkLabel = allSelected ? "Uncheck all" : "Select all";

<button
  type="button"
  disabled={options.length === 0}
  onClick={() => onChange(allSelected ? [] : options.map((option) => option.value))}
>
  {bulkLabel}
</button>
```

**Empty-options policy:** Disable the single bulk command when there are no complete options. This avoids presenting `Select all` as an action that cannot change state. [RECOMMENDED: conventional command-state behavior]

### Pattern 2: Sort Once at the Display Projection Boundary

**What:** Sort in `mapToOptions`, after formatting the visible label and before all picker-specific selection logic. Use a case-insensitive visible-label key and the raw value as a tie-breaker. Do not mutate the `Map` or count state. [RECOMMENDED: current projection boundary] [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort]

**When to use:** Direction, Kind, Method, Action, Channel, Turn, and Status because all are constructed through `mapToOptions`. [VERIFIED: `FilterBar.tsx`]

```ts
// Source: current mapToOptions structure plus Phase 31 recommendation
function compareOptionLabels(a: FacetOption, b: FacetOption): number {
  const byLabel = a.label.toLocaleLowerCase().localeCompare(b.label.toLocaleLowerCase());
  return byLabel || a.value.localeCompare(b.value);
}

return Array.from(m.entries())
  .map(([value, count]) => ({ value, label: labelFor(value), count }))
  .sort(compareOptionLabels);
```

**Policy:** Alphabetical visible-label ascending is the default and only Phase 31 sort. Keep counts visible but non-ordering. Count sorting would cause live-tail reorder as counts change and is not requested as a user-selectable mode. [RECOMMENDED: stable interaction geometry; current live-tail architecture]

### Pattern 3: Local Border-Box Fixes

**What:** Apply `boxSizing: "border-box"` to the `width: "100%"` searchable facet input and grouping option label so their declared width includes padding and border. [RECOMMENDED: root-cause fix] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing]

**When to use:** Only the two reported full-width controls in this focused phase. Do not introduce a global `* { box-sizing: border-box }` rule because that changes geometry throughout the application. [RECOMMENDED: narrow blast radius; `global.css` has no existing global box-sizing convention]

### Anti-Patterns to Avoid

- **Two simultaneously visible bulk commands:** It repeats Phase 25's functional implementation but conflicts with Phase 31's contextual-toggle goal. [VERIFIED: `FacetPopover.tsx`; `.planning/ROADMAP.md`]
- **Deriving bulk state/action from `filtered` or `visible`:** Search queries and the 100-row rendering cap would make the command affect only a subset, violating Phase 25's complete-facet behavior. [VERIFIED: `FacetPopover.tsx`; `25-UI-SPEC.md`]
- **Sorting by count on every render:** Live-tail count updates can move option targets during interaction. [VERIFIED: counts derive from live rows in `useFacetCounts`; live-tail architecture in `.planning/STATE.md`] [RECOMMENDED: stable label sort]
- **Sorting raw values before formatting labels:** Channel values are displayed through `formatSessionShort`; raw-value order would not match what users see. [VERIFIED: `FilterBar.tsx`]
- **Global box-sizing reset:** It broadens a two-control geometry fix into an application-wide layout change. [VERIFIED: no current global reset in `global.css`] [RECOMMENDED: focused change]
- **Changing hidden-value storage or persistence:** The existing state contract already supports the requested behavior; reopening it adds migration risk without benefit. [VERIFIED: `filters.ts`; Phase 25 summaries]
- **Capturing screenshots from real logs:** Saved evidence must remain fixture-only. [VERIFIED: `.github/copilot-instructions.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk-selection state | A new store field or persisted mode | Derive from existing `options` and `selected` props | The state is fully derivable and must track live options immediately. [VERIFIED: `FacetPopover.tsx`] |
| Option ordering | A separate sorting library or server sort endpoint | A small pure comparator in `FilterBar.tsx` | The option set is already client-local and bounded by loaded facet values. [VERIFIED: `FilterBar.tsx`; `selectors.ts`] |
| Layout correction | JavaScript width measurements | CSS `box-sizing: border-box` | The defects are box-model overflow, not dynamic positioning problems. [VERIFIED: inspected inline styles] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing] |
| Browser fixture harness | A new dev server or external fixture source | Existing Phase 25 Playwright CLI harness and synthetic fixture data | It already proves local-only, responsive picker flows and path-leak checks. [VERIFIED: `e2e/phase25.spec.ts`] |
| Icons or visual dependencies | New package/CDN assets | Existing controls and semantic tokens | Phase 31 requires no new icon and the project forbids outbound viewing dependencies. [VERIFIED: scope; `.github/copilot-instructions.md`] |

**Key insight:** This phase is a presentation-policy correction over an already-correct state model. Keep all new logic pure and local to option projection or picker rendering. [VERIFIED: inspected data flow] [RECOMMENDED: minimal implementation]

## Common Pitfalls

### Pitfall 1: Contextual Toggle Uses the Search Result Set

**What goes wrong:** Typing in Method search and clicking `Select all` changes only matching or first-100 rows. [VERIFIED: `FacetPopover` has separate `options`, `filtered`, and `visible` collections]

**Why it happens:** The filtered list is nearest to rendering code, but Phase 25 deliberately made bulk actions operate on complete facet options. [VERIFIED: `FacetPopover.tsx`; `25-UI-SPEC.md`]

**How to avoid:** Compute `allSelected` and the next selection from `options` only; add a test with a query-active picker or more options than the visible subset. [RECOMMENDED: regression design]

**Warning signs:** A bulk action changes its label when only the local query changes, or hidden options remain unchanged after `Select all`. [RECOMMENDED: test oracle]

### Pitfall 2: Default-Hidden Ping Produces the Wrong Initial Command

**What goes wrong:** Method opens with `Uncheck all` even though `ping` is unchecked. [VERIFIED: `APP_DEFAULT_FILTERS.method = ["ping"]`; Method checked-visible adapter]

**Why it happens:** Code checks `selected.length > 0` instead of all complete options being selected. [RECOMMENDED: likely implementation trap]

**How to avoid:** Use `options.length > 0 && options.every(option => selected.includes(option.value))`; explicitly test the default Method state. [RECOMMENDED: exact policy]

**Warning signs:** The command label does not flip after clicking it, or the first Method command hides everything instead of revealing `ping`. [RECOMMENDED: test oracle]

### Pitfall 3: Ordering Still Moves During Live Tail

**What goes wrong:** Options reorder as counts increase or new values arrive. [VERIFIED: facet counts update from store rows]

**Why it happens:** Count-based sorting or missing a raw-value tie-breaker makes order dependent on changing data or first occurrence. [VERIFIED: current insertion-order path] [RECOMMENDED: deterministic comparator]

**How to avoid:** Sort by formatted label, then raw value; test with deliberately scrambled row insertion and equal/case-colliding labels. [RECOMMENDED: regression design]

**Warning signs:** A test only asserts that labels exist, not their DOM order. [RECOMMENDED: test oracle]

### Pitfall 4: Removing Close Leaves No Keyboard Dismissal Story

**What goes wrong:** Mouse users retain click-outside/trigger closure, but keyboard users may have no direct dismiss command. [VERIFIED: `FacetPopover` has no Escape listener; `Close` is currently focusable]

**Why it happens:** The scope asks to remove the visible action, while closure behavior is spread across the popover and trigger. [VERIFIED: `.planning/ROADMAP.md`; current components]

**How to avoid:** At minimum verify click-outside and chip-toggle closure after removal. If Escape is included, stop it from causing TimelineRegion's subsequent search/selection action and test the Phase 29 filter-preservation contract. [VERIFIED: `TimelineRegion.tsx`; `SearchPopover.tsx`] [RECOMMENDED: explicit planner decision]

**Warning signs:** Pressing Escape closes the menu and also clears Search or selection, or the only remaining closure path requires a pointer. [RECOMMENDED: test oracle]

### Pitfall 5: Fixing the Symptom with Width Arithmetic

**What goes wrong:** Hard-coded `calc(100% - Npx)` values fix one theme or viewport but drift with token spacing. [RECOMMENDED: CSS layout analysis]

**Why it happens:** The root cause is content-box width plus padding/border, not the parent width. [VERIFIED: current inline styles] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing]

**How to avoid:** Use local `boxSizing: "border-box"` and Playwright bounding-box assertions. [RECOMMENDED: root-cause fix]

**Warning signs:** New magic-number width calculations or theme-specific geometry rules. [RECOMMENDED: review oracle]

### Pitfall 6: Accidental Accessibility Expansion

**What goes wrong:** A visual polish change partially rewrites ARIA roles without implementing the required keyboard/focus model. [CITED: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/]

**Why it happens:** The current facet container uses `role="listbox"` while containing native checkboxes and footer buttons; WAI states that listbox does not provide an accessible way to present interactive descendants such as checkboxes or buttons. [VERIFIED: `FacetPopover.tsx`] [CITED: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/]

**How to avoid:** Keep Phase 31's semantic changes out of scope by default and record a deliberate follow-up for picker semantics/keyboard model. If the planner chooses to include it, treat it as a separate tested task rather than a role-string edit. [RECOMMENDED: focused phase boundary]

**Warning signs:** Changing `role` or `aria-haspopup` without adding matching focus and keyboard tests. [RECOMMENDED: review oracle]

## Exact Likely Files

| File | Expected Change | Confidence |
|------|-----------------|------------|
| `packages/ui/src/components/filters/FacetPopover.tsx` | Replace three-button footer with one contextual complete-set bulk button; remove `Close`; add border-box to searchable input; optionally add tested Escape closure. | HIGH [VERIFIED: owns all listed behavior] |
| `packages/ui/src/components/filters/FilterBar.tsx` | Sort projected option rows by formatted label plus raw-value tie-breaker; no change to hidden-value adapters. | HIGH [VERIFIED: owns `mapToOptions`] |
| `packages/ui/src/components/filters/GroupToggleChip.tsx` | Add border-box to full-width option labels so selected background stays within the popover. | HIGH [VERIFIED: owns selected-row background] |
| `packages/ui/src/components/filters/FilterBar.test.tsx` | Replace dual-action assertions; assert contextual label flips, default-hidden ping behavior, deterministic DOM order, no `Close`, and grouping layout style contract. | HIGH [VERIFIED: current picker component coverage lives here] |
| `e2e/phase31.spec.ts` | Fixture-backed desktop/narrow flow asserting menu containment, filter-input containment, contextual command behavior, absence of `Close`, deterministic labels, and group selected-background containment; save Phase 31 screenshots. | HIGH [VERIFIED: Phase 25 E2E is the established analog] |
| `screenshots/phase31/*.png` | Fresh fixture-only visual evidence for Method picker, searchable input, narrow containment, and Group: Session picker. | HIGH [VERIFIED: project screenshot rules] |

**Probably unchanged:** `packages/ui/src/state/filters.ts`, `packages/ui/src/state/selectors.ts`, persistence modules, server/CLI implementation, documentation, and `global.css`. [VERIFIED: requested behavior is already expressible through current component props and inline style pattern]

## Code Examples

### Deterministic Display-Label Ordering

```ts
// Source: recommended adaptation of current FilterBar.mapToOptions
interface FacetOption {
  value: string;
  label: string;
  count: number;
}

function compareFacetOptions(a: FacetOption, b: FacetOption): number {
  const labelA = a.label.toLocaleLowerCase();
  const labelB = b.label.toLocaleLowerCase();
  return labelA.localeCompare(labelB) || a.value.localeCompare(b.value);
}
```

This comparator is pure and includes a tie-breaker; MDN documents that comparator correctness requires stable, reflexive, anti-symmetric, and transitive behavior. [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort]

### Full-Set Contextual Action

```ts
// Source: recommended adaptation of current FacetPopover actions
const allSelected =
  options.length > 0 && options.every((option) => selected.includes(option.value));

function toggleAll(): void {
  onChange(allSelected ? [] : options.map((option) => option.value));
}
```

The implementation intentionally ignores `query`, `filtered`, `visible`, and `MAX_VISIBLE`. [RECOMMENDED: preserve current complete-option behavior]

### Root-Cause Geometry Fix

```tsx
// Source: MDN box-sizing guidance and existing SearchPopover precedent
style={{
  width: "100%",
  boxSizing: "border-box",
  padding: "var(--space-1) var(--space-2)",
}}
```

With `border-box`, declared width includes border and padding. [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing]

## State of the Art

| Old / Current Approach | Phase 31 Approach | Impact |
|------------------------|-------------------|--------|
| First-occurrence option order from timeline-row insertion | Stable visible-label order with raw-value tie-breaker | Users can scan and revisit options without count/live-tail movement. [VERIFIED: current code] [RECOMMENDED: Phase 31 policy] |
| Separate `Select all`, `Uncheck all`, and `Close` footer actions | One contextual complete-set bulk action; no visible Close action | Footer becomes conventional and compact while preserving explicit all/none behavior. [VERIFIED: current code and roadmap goal] |
| Full-width padded controls under default content-box sizing | Local border-box sizing on affected controls | Input and selected grouping background remain inside their parent surface. [VERIFIED: current code] [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing] |
| Phase 25 screenshots/assertions expect dual actions and Close | Phase 31 fixture evidence asserts contextual command, no Close, deterministic order, and geometry | Verification matches the new visible contract. [VERIFIED: `e2e/phase25.spec.ts`] |

**Deprecated/outdated for Phase 31:**
- The Phase 25 UI-SPEC statements requiring both `Select all` and `Uncheck all` simultaneously are superseded by Phase 31's locked contextual-toggle goal. The checked-visible and complete-option semantics remain binding. [VERIFIED: `25-UI-SPEC.md`; `.planning/ROADMAP.md`]
- Existing Phase 25 screenshots remain historical evidence, not acceptance evidence for Phase 31. [VERIFIED: screenshots and requested Phase 31 scope]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. Recommendations are grounded in the locked Phase 31 goal, current code, prior Phase 25 artifacts, or cited platform guidance. | — | — |

## Open Questions (RESOLVED)

1. **RESOLVED by deferral per the approved UI-SPEC: Escape-to-close is not included in Phase 31.**
   - What we know: the visible `Close` action must be removed; click-outside and trigger-toggle closure already exist; `FacetPopover` lacks Escape handling; `TimelineRegion` also owns Escape behavior. [VERIFIED: roadmap goal; `FacetPopover.tsx`; `TimelineRegion.tsx`]
  - Resolution: preserve current Escape behavior and defer Escape-to-close to the coordinated keyboard-model follow-up required by the approved UI-SPEC. [VERIFIED: `31-UI-SPEC.md`]

2. **RESOLVED by deferral per the approved UI-SPEC: picker ARIA/keyboard redesign is not included in Phase 31.**
   - What we know: current `role="listbox"` contains native checkboxes and buttons, which does not match WAI's listbox interaction model. [VERIFIED: `FacetPopover.tsx`] [CITED: https://www.w3.org/WAI/ARIA/apg/patterns/listbox/]
  - Resolution: preserve current roles, ARIA attributes, focus management, and keyboard semantics; defer the coordinated redesign to the approved UI-SPEC follow-up. [VERIFIED: `31-UI-SPEC.md`]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Build, Vitest, CLI fixture harness | Yes | v22.22.1 | None needed. [VERIFIED: local command audit] |
| pnpm | Workspace scripts | Yes | 9.15.0 | None needed. [VERIFIED: local command audit; root `package.json`] |
| Playwright CLI / Chromium project | Fixture-backed browser proof | Yes | 1.59.1 | Component tests can verify logic, but not final geometry. [VERIFIED: local command audit; `playwright.config.ts`] |
| Existing synthetic fixture sources | Privacy-safe screenshot evidence | Yes | Repository-local | Build a Phase 31 temporary JSONL from `PHASE5_BASE_JSONL`, following Phase 25. [VERIFIED: `e2e/phase25.spec.ts`] |

**Missing dependencies with no fallback:** None. [VERIFIED: environment audit]

**Missing dependencies with fallback:** None. [VERIFIED: environment audit]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + React Testing Library 16.3.2; Playwright 1.59.1 for browser geometry/evidence. [VERIFIED: package manifests] |
| Config files | `vitest.config.ts`, `packages/ui/vitest.config.ts`, `playwright.config.ts`. [VERIFIED: workspace files] |
| Quick run command | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` [VERIFIED: existing test path and root script tooling] |
| Focused UI safety command | `pnpm --filter @ahp-inspector/ui typecheck && pnpm --filter @ahp-inspector/ui build` [VERIFIED: `packages/ui/package.json`] |
| Phase browser command | `pnpm --filter @ahp-inspector/ui build && pnpm exec playwright test e2e/phase31.spec.ts --project=chromium` [VERIFIED: Phase 25 established command pattern] |
| Full suite command | `pnpm test && pnpm typecheck && pnpm lint` [VERIFIED: root `package.json`] |

### Phase Goal → Test Map

| Goal Slice | Behavior | Test Type | Automated Command | File Exists? |
|------------|----------|-----------|-------------------|--------------|
| Contextual bulk toggle | Partial/default-hidden selection shows `Select all`; clicking selects complete set and flips to `Uncheck all`; clicking again unchecks complete set. | component | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` | Existing file; revise Phase 25 assertion. [VERIFIED: current test] |
| Complete-set behavior under local search/cap | Bulk state and action ignore filtered/visible subset. | component | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` | Existing file; add case. [VERIFIED: current component supports searchable Method] |
| Remove Close action | No `Close` button; click-outside and chip-toggle closure still work. | component | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` | Existing file; chip-toggle case already exists. [VERIFIED: current test] |
| Deterministic sort | Scrambled row insertion renders all categorical options in label order; formatted Channel labels determine Channel order; count changes do not reorder. | component | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` | Existing file; add cases. [VERIFIED: option construction path] |
| Searchable input layout | Facet input border box stays within popover on desktop and narrow widths. | E2E geometry | `pnpm --filter @ahp-inspector/ui build && pnpm exec playwright test e2e/phase31.spec.ts --project=chromium` | Missing — Wave 0. [RECOMMENDED: browser-only geometry proof] |
| Group: Session background layout | Selected grouping row/background bounding box stays within popover. | E2E geometry + component style contract | Same Phase 31 Playwright command; focused Vitest command | Browser file missing — Wave 0. [RECOMMENDED: root-cause proof] |
| Privacy/theme/responsive evidence | Fixture-only desktop/narrow screenshots, no path leak, no clipping, semantic tokens preserved. | E2E + visual review | Same Phase 31 Playwright command | Browser file and screenshots missing — Wave 0. [VERIFIED: project constraints; Phase 25 analog] |

### Sampling Rate

- **Per task commit:** `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` [RECOMMENDED: fastest ownership-aligned regression]
- **Per wave merge:** `pnpm --filter @ahp-inspector/ui typecheck && pnpm --filter @ahp-inspector/ui build && pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` [RECOMMENDED: focused safety gate]
- **Phase gate:** Run the Phase 31 Playwright flow, inspect every saved fixture screenshot, then run `pnpm test && pnpm typecheck && pnpm lint`. [VERIFIED: established project verification pattern]

### Wave 0 Gaps

- [ ] `e2e/phase31.spec.ts` — add fixture-only contextual-action, ordering, narrow-input, group-background, viewport-containment, and path-leak proof. [RECOMMENDED: Phase 25 analog]
- [ ] `screenshots/phase31/` — create only through the Phase 31 fixture-backed E2E and inspect before completion. [VERIFIED: project screenshot rules]
- [ ] Update or replace Phase 25 E2E expectations that currently require both bulk buttons and visible `Close`; otherwise the full E2E suite will fail after the product change. [VERIFIED: `e2e/phase25.spec.ts`]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No | Local viewer picker polish introduces no authentication surface. [VERIFIED: inspected scope] |
| V3 Session Management | No | “Session” is an AHP grouping label, not an auth session. [VERIFIED: `GroupToggleChip.tsx`; project context] |
| V4 Access Control | No | No new privileged action or server route. [VERIFIED: inspected scope] |
| V5 Input Validation | Yes | Keep facet query as local lowercase string inclusion over existing option labels/values; never interpret it as regex or HTML. [VERIFIED: `FacetPopover.tsx`] |
| V6 Cryptography | No | No cryptographic operation. [VERIFIED: inspected scope] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Real-log content leaks into saved screenshot evidence | Information Disclosure | Generate and save Phase 31 screenshots only from repository fixtures/synthetic rows; retain path-leak assertion. [VERIFIED: project instructions; `e2e/phase25.spec.ts`] |
| Picker search or sorting causes avoidable UI work on large option sets | Denial of Service | Preserve `MAX_VISIBLE = 100`, keep query matching literal, and sort once at option projection rather than inside every row render. [VERIFIED: `FacetPopover.tsx`; `FilterBar.tsx`] [RECOMMENDED: bounded work] |
| User-controlled option text interpreted as markup | Tampering / XSS | Continue rendering labels as React text and never use HTML injection. [VERIFIED: `FacetPopover.tsx`] |
| External dependency or asset added for a local UI polish | Information Disclosure / privacy regression | Use existing local React controls, tokens, and test harness; no CDN or outbound dependency. [VERIFIED: project instructions; no dependency need] |

## Sources

### Primary (HIGH confidence)

- `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json` — Phase goal, history, and Nyquist setting. [VERIFIED: workspace reads]
- `.github/copilot-instructions.md` — local-only privacy, fixture evidence, host boundary, and protocol constraints. [VERIFIED: workspace read]
- `packages/ui/src/components/filters/FacetPopover.tsx` — current option filtering/cap, bulk actions, footer, searchable input, and closure behavior. [VERIFIED: workspace read]
- `packages/ui/src/components/filters/FilterBar.tsx` — option projection, checked-visible adapters, and picker wiring. [VERIFIED: workspace read]
- `packages/ui/src/components/filters/GroupToggleChip.tsx` — grouping popover and selected-row layout. [VERIFIED: workspace read]
- `packages/ui/src/state/selectors.ts`, `packages/ui/src/state/filters.ts` — facet count insertion order and hidden-value semantics. [VERIFIED: workspace reads]
- `packages/ui/src/components/filters/FilterBar.test.tsx`, `RowFilterInput.test.tsx`, `e2e/phase25.spec.ts` — current automated contracts and required expectation changes. [VERIFIED: workspace reads]
- Phase 25 research, UI-SPEC, summaries, verification, and screenshots — prior decisions and fixture-backed evidence architecture. [VERIFIED: workspace reads and image inspection]
- https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing — standard box-model behavior and border-box fix. [CITED: fetched official platform documentation]
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort — comparator requirements and mutation behavior. [CITED: fetched official platform documentation]
- https://www.w3.org/WAI/ARIA/apg/patterns/listbox/ — listbox selection, bulk controls, interactive-descendant, and keyboard-model guidance. [CITED: fetched W3C guidance]

### Secondary (MEDIUM confidence)

- None required; critical implementation findings were verified in current source or cited platform/W3C guidance. [VERIFIED: research record]

### Tertiary (LOW confidence)

- None. [VERIFIED: research record]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — this phase uses only existing repository dependencies and platform controls. [VERIFIED: package manifests and implementation]
- Architecture: HIGH — all requested behavior has a single, directly inspected component owner and an established Phase 25 verification analog. [VERIFIED: current code and artifacts]
- Interaction recommendation: HIGH — it preserves the existing checked-visible/complete-set contract while satisfying the locked contextual-toggle goal. [VERIFIED: Phase 25 contract and Phase 31 goal]
- Layout diagnosis: HIGH — both defects match directly inspected full-width content-box controls with padding, and the root-cause behavior is documented by MDN. [VERIFIED: current source] [CITED: MDN box-sizing]
- Pitfalls: HIGH — each is grounded in current data flow, prior phase decisions, or cited W3C/platform guidance. [VERIFIED: sources above]

**Research date:** 2026-06-11
**Valid until:** 2026-07-11, unless the picker components or Phase 31 scope change first. [RECOMMENDED: 30-day validity for stable local UI surface]