# Phase 25: Row Search Filter, Consistent Dropdown Defaults, and Select/Clear-All Controls - Research

**Researched:** 2026-05-29
**Status:** Ready for planning
**Context:** User elected to continue without a separate `CONTEXT.md`; the request and current code are the scope source.

## Phase Goal

Let users narrow the visible timeline by text while preserving the existing full-payload Search-as-highlight/navigation behavior, and make categorical facet menus consistently read as visibility controls: options visible by default, `ping` remaining the intentional default-hidden method, with explicit select-all and uncheck-all commands.

## Requested Outcomes

| ID | Outcome | Source |
|----|---------|--------|
| FILTER-25-01 | A string filter narrows timeline rows. | User request |
| FILTER-25-02 | Every categorical filter dropdown uses checked-visible semantics by default; Method's existing default-hidden `ping` exception remains visible as unchecked. | User request plus existing `APP_DEFAULT_FILTERS.method = ["ping"]` intent |
| FILTER-25-03 | Categorical dropdowns offer select-all and uncheck-all controls. | User request |
| FILTER-25-04 | The new filter state remains per-log durable and is proven alongside the existing search/highlight behavior in fixture-backed browser verification. | Existing persistence/E2E architecture |

## Current Implementation Facts

### Search is intentionally non-filtering

- `packages/ui/src/state/store.ts` owns `searchQuery`, volatile `searchMatches`, status, total, and truncation metadata.
- `packages/ui/src/components/filters/useSearch.ts` sends a debounced query to `/api/log/search` and updates volatile result state.
- `packages/ui/src/state/selectors.ts::useFilteredRows()` filters only facets, while `useVisibleSearchMatches()` intersects highlighted search matches with currently faceted rows.
- Phase 12 summaries lock the distinction: Search highlights and navigates; facet filters narrow rows. Its E2E asserts nonmatching rows stay visible after entering a Search query.

### Reusing Search matches as a filtering predicate is not truthful

- `packages/server/src/search-routes.ts` caps raw-event search results at `MAX_RESULTS = 5000`, regardless of client limit.
- `packages/ui/src/transport/search-client.ts` explicitly requests `limit=5000` and receives `truncated` metadata.
- Filtering visible rows to the returned `searchMatches` would incorrectly remove matching rows after the first 5,000 whenever `truncated` is true.

**Recommendation:** Add a distinct client-side `Filter rows` input whose value is part of `FilterState`. Match against bounded, already-published `EventRow` display/projection fields with case-insensitive substring matching and a 256-character input cap. Keep existing Search untouched for raw/full-payload find and navigation. This choice is agent discretion because no `CONTEXT.md` was requested; it protects the earlier Search contract and never lies about a truncated server result set.

### Facet checkbox semantics are inconsistent

- `packages/ui/src/state/filters.ts` stores `method` as a hidden/exclusion list (`APP_DEFAULT_FILTERS.method = ["ping"]`), but stores Direction, Kind, Action, Session, Turn and Status as selected/inclusion lists where `[]` means match-all.
- `packages/ui/src/components/filters/FilterBar.tsx` therefore converts only Method from hidden values to checked options through `methodSelectionFromHidden()` and `hiddenMethodsFromSelection()`.
- `packages/ui/src/components/filters/FacetPopover.tsx` renders checkbox selections and already has `Clear selection`, but for inclusion-list facets an empty selection means no filtering, not “nothing checked.” It cannot correctly implement the requested uncheck-all behavior under the mixed model.
- `packages/ui/src/components/filters/ActiveFilterChips.tsx` describes Method as hidden but describes all other array facets as selected values.

**Recommendation:** Normalize all categorical `FilterState` arrays to exclusion semantics: an array contains hidden values; an empty array means every discovered option is checked/visible. Keep property names stable for a focused change, but document the invariant next to `FilterState` and enforce it in tests. `APP_DEFAULT_FILTERS.method = ["ping"]` remains the deliberate exception, rendering `ping` unchecked at startup while other options and all other facets begin checked.

This representation handles live discovery correctly: options arriving after the user selected all are visible by default; after unchecking all currently known values, a newly arriving value is visible by default rather than invisibly excluded without user action.

### Durability requires a preferences migration boundary

- `packages/ui/src/state/persistence.ts` stores `PerLogPrefs` at schema `v: 1`, including `filters` and `searchQuery`.
- Persisted v1 non-Method filter arrays mean included/allowed values, which would reverse meaning if read as new exclusions.
- `packages/ui/src/persistence/persist-effect.ts` restores preferences only after `loadProgress.phase === "complete"`, and resets to `APP_DEFAULT_FILTERS` on log switch.

**Recommendation:** Bump durable preferences to `v: 2`. Migrate v1 records by preserving unrelated durable view settings and existing Method hidden values, but reset old inclusion-style categorical arrays to unchecked-exclusion defaults because faithfully converting them requires the full option universe and null-value policy. Persist new `filters.rowText` in v2; keep volatile Search result metadata non-durable.

### Existing pending work must be preserved

The worktree currently contains uncommitted Phase 24 UI work in `FilterBar.tsx`, `ActiveFilterChips.tsx`, `TimelineList.tsx`, and related tests: focused `x of y` search feedback, `Channel` terminology, and a bottom navigation control. Phase 25 tasks touching `FilterBar.tsx`, `ActiveFilterChips.tsx`, or their tests must build on those changes and must not revert them.

## Recommended Architecture

### State contract

Extend `FilterState` in `packages/ui/src/state/filters.ts` with `rowText: string`, and define all categorical arrays as **hidden values**:

```ts
export interface FilterState {
  direction: ("c2s" | "s2c")[]; // hidden directions
  kind: EventKind[];               // hidden kinds
  method: string[];                // hidden methods; defaults to ["ping"]
  actionType: string[];            // hidden actions
  session: string[];               // hidden channels
  turn: string[];                  // hidden turns
  status: Status[];                // hidden statuses
  rowText: string;                 // local visible-row substring predicate
  timeFrom: number | null;
  timeTo: number | null;
}
```

`applyFacets(row, filters)` rejects a row when a hidden value contains the row property, then applies `rowText` against a lowercase haystack composed from row-projection display fields (`keyId`, `tsFmt`, `dir`, `kind`, `method`, `actionType`, channel/session labels, turn labels, `status`, `summary`, `payloadPreview`, and parse-error reason). It never requests raw events or interprets the query as regex/HTML.

### UI contract

- Existing `Search` remains the wide raw/full-payload highlight/navigation input.
- Add a compact `Filter rows` input with filter icon and clear icon in the filter bar; it writes `filters.rowText`, renders as an active filter chip, participates in Clear all filters, and uses ordinary text-input semantics.
- Each categorical `FacetPopover` shows an option checked exactly when that value is not in its hidden array.
- Replace ambiguous `Clear selection` with two explicit commands: `Select all` and `Uncheck all`. These commands operate on all facet options, not only the subset matching the popover’s local option-search field.
- Turn is no longer disabled merely because Channel has an empty hidden list; with hidden semantics, empty means every channel is visible.
- Time range is not a checkbox option list and does not get select/uncheck-all commands.

### Validation architecture

| Behavior | Test Type | Automated Command | Existing Surface |
|----------|-----------|-------------------|------------------|
| Row-text matching narrows rows without changing Search metadata/highlighting | unit | `pnpm exec vitest run packages/ui/src/state/selectors.test.ts packages/ui/src/components/timeline/TimelineRegion.test.tsx` | Both files exist; add Phase 25 cases. |
| Categorical arrays uniformly mean hidden values, including paired hidden-Method responses | unit | `pnpm exec vitest run packages/ui/src/state/selectors.test.ts` | Existing Method exclusion cases provide analog. |
| Checkboxes start selected, preserve `ping` unchecked default, and select/uncheck-all update hidden values | component | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` | Existing Method popup coverage provides analog. |
| V1 durable preferences do not reverse old include-filters and v2 restores row text/exclusions | unit | `pnpm exec vitest run packages/ui/src/state/persistence.test.ts packages/ui/src/persistence/persist-effect.test.ts` | Existing durability tests provide analog. |
| Browser flow keeps raw Search contextual while Filter rows hides nonmatches; menu actions are discoverable | E2E | `pnpm --filter @ahp-inspector/ui build && pnpm exec playwright test e2e/phase25.spec.ts` | Follow `e2e/phase12.spec.ts` and use synthetic fixture data only. |

### Wave 0 gaps

None. Vitest, React Testing Library and fixture-backed Playwright infrastructure already exist. Each production slice should add or revise its tests before completing implementation.

## Security Domain

| Threat ID | STRIDE | Risk | Mitigation to Plan |
|-----------|--------|------|--------------------|
| T-25-01 | D | Long/adversarial text predicates repeatedly scanning large projected row sets could reduce UI responsiveness. | Cap the local row-text predicate at 256 characters and run filtering through the existing deferred selector path; add selector coverage. |
| T-25-02 | T/I | Treating filter text as regex or HTML could introduce unsafe interpretation or injection. | Use lowercase `String.prototype.includes` over projection text only; do not render query through HTML or send it outbound. |
| T-25-03 | T | Loading v1 inclusion filters as v2 hidden values would invert user-visible filtering. | Version durable preferences and test safe migration/reset of old non-Method filter semantics. |
| T-25-04 | I | Browser verification could capture real AHP log content. | Run E2E and save any evidence only against repository fixture/synthetic rows under `screenshots/phase25/`. |

## Planning Implications

1. Build the filtering predicate and normalized hidden-value contract first; UI and persistence depend on it.
2. Persistence migration and interactive facet controls can proceed in parallel once that contract exists because their modified files do not overlap.
3. Finish with browser evidence and user-facing documentation so the deliberate distinction between `Search` and `Filter rows` is visible and regression-tested.

## Sources Read

- `packages/ui/src/state/filters.ts`, `selectors.ts`, `store.ts`, `persistence.ts`
- `packages/ui/src/persistence/persist-effect.ts`
- `packages/ui/src/components/filters/FacetPopover.tsx`, `FilterBar.tsx`, `ActiveFilterChips.tsx`, `SearchInput.tsx`, `useSearch.ts`
- `packages/ui/src/components/timeline/TimelineRegion.tsx`, `TimelineList.tsx`
- `packages/core/src/row-projection.ts`
- `packages/server/src/search-routes.ts`, `packages/ui/src/transport/search-client.ts`
- `.planning/phases/12-search-rather-than-filter/*-SUMMARY.md`, `e2e/phase12.spec.ts`
- `.planning/phases/22-improve-large-log-loading-and-high-throughput-live-tail-perf/22-06-SUMMARY.md`
- `.planning/RETROSPECTIVE.md`
