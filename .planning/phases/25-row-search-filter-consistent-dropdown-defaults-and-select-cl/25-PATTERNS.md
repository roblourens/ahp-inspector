# Phase 25 Pattern Map

**Mapped:** 2026-05-29
**Purpose:** Give executors concrete analogs for the new row filter and consistent facet visibility behavior.

## Ownership And Flow

| Concern | Owner | Current Contract | Phase 25 Extension |
|---------|-------|------------------|--------------------|
| Filter predicate | `packages/ui/src/state/filters.ts` | `applyFacets(row, filters)` uses Method exclusions but inclusion semantics elsewhere. | Normalize categorical arrays as hidden values and add bounded `rowText` predicate. |
| Visible row projection | `packages/ui/src/state/selectors.ts` | `useFilteredRows()` uses deferred facet state; `useVisibleSearchMatches()` intersects Search with facets. | Row text enters only faceted/filter visibility; Search result logic remains separate. |
| Filter UI | `packages/ui/src/components/filters/FilterBar.tsx`, `FacetPopover.tsx` | Method adapts hidden methods into checked options; other facets pass arrays directly. | Apply the checked-visible adapter uniformly, add `Filter rows`, expose Select all/Uncheck all. |
| Filter chips | `packages/ui/src/components/filters/ActiveFilterChips.tsx` | Method says `Hidden method`; other arrays render selected values. | All categorical chips identify hidden values; row-text filter is dismissible. |
| Preferences | `packages/ui/src/state/persistence.ts`, `packages/ui/src/persistence/persist-effect.ts` | `PerLogPrefs.v = 1`, Search query durable, Search results volatile; hydrate after baseline complete. | `v = 2` protects changed categorical semantics and persists `filters.rowText`. |
| Browser proof | `e2e/phase12.spec.ts` | Synthetic fixture proves Search retains context while facets narrow. | Fixture-backed Phase 25 test proves Search remains contextual and Filter rows narrows. |

## Contracts To Reuse

### EventRow display projection

From `packages/core/src/row-projection.ts`:

```ts
export interface EventRow {
  readonly idx: number;
  readonly tsFmt: string;
  readonly dir: Direction;
  readonly kind: EventKind;
  readonly method: string | null;
  readonly actionType: string | null;
  readonly sessionId: string | null;
  readonly sessionShort: string | null;
  readonly turnId: string | null;
  readonly turnShort: string | null;
  readonly keyId: string | null;
  readonly status: Status;
  readonly payloadPreview: string;
  readonly summary?: string;
  readonly parseErrorReason: string | null;
  readonly pairIdx?: number | null;
}
```

Use these published projection fields for the local `Filter rows` predicate. Do not fetch raw detail or consume the bounded raw Search result set for row hiding.

### Existing search separation

From `packages/ui/src/state/selectors.ts`:

```ts
export function useFilteredRows(): number[] { /* filters only */ }
export function useVisibleSearchMatches(): number[] { /* search matches intersect filters */ }
```

Preserve the separation: adding `filters.rowText` to `useFilteredRows()` is a filter extension; changing `searchMatches` to hide rows would undo Phase 12.

### Existing Method checked-visible adapter

From `packages/ui/src/components/filters/FilterBar.tsx`:

```ts
function methodSelectionFromHidden(options, hiddenMethods): string[] {
  return options.map((option) => option.value).filter((value) => !hiddenMethods.includes(value));
}
```

Generalize this shape for every categorical facet. Hidden values should carry through when they are not in the currently discovered option list, as the existing Method update function already does.

### Persistence lifecycle

From `packages/ui/src/persistence/persist-effect.ts`:

```ts
if (currKey && curr.loadProgress.phase === "complete" && ref.hydratedFor !== currKey) {
  hydrate(currKey, curr.rows.length);
}
```

Do not hydrate earlier or alter the Phase 22 baseline lifecycle. Add schema migration in the loaded preferences path; retain completed-baseline timing and log-switch resets.

## Pending Worktree Compatibility

The executor must read current source before editing. Uncommitted work already changes:

- `FilterBar.tsx`: `Channel` label and focused search result count (`x of y`).
- `ActiveFilterChips.tsx`: `Channel` label.
- `TimelineList.tsx` and its virtualization test: `Channel` column and scroll-to-bottom control.

Phase 25 must preserve all those behaviors and avoid touching timeline list files unless verification uncovers a Phase 25-specific interaction regression.

## Test Analogs

| New behavior | Closest existing test |
|--------------|-----------------------|
| Hidden facet row behavior | `packages/ui/src/state/selectors.test.ts` Method exclusion and paired-response cases |
| Popover checkbox presentation | `packages/ui/src/components/filters/FilterBar.test.tsx` Method checkbox cases |
| Durable filter state migration | `packages/ui/src/state/persistence.test.ts`, `packages/ui/src/persistence/persist-effect.test.ts` |
| Search remains non-filtering | `e2e/phase12.spec.ts` |
| Timeline uses filtered indexes | `packages/ui/src/components/timeline/TimelineRegion.test.tsx` |
