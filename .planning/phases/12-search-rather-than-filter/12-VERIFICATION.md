---
phase: 12-search-rather-than-filter
verdict: PASS
verified: 2026-05-09
requirements: []
blocking_gaps: []
---

# Phase 12 Verification

> Backfilled retroactively during the v1.1 milestone audit. Phase 12 was a UX-shaped scope insertion that did not add new entries to REQUIREMENTS.md; verification traces against the three plan SUMMARY.md must-haves and the dedicated Playwright spec.

**Verdict: PASS.** Phase 12 satisfies its goal: search results highlight matches and navigate the timeline rather than filtering it. Faceted filters and the search query are separated in state, persistence, and UI affordances.

## Goal Coverage

| Plan must-have | Verdict | Evidence |
|---|---:|---|
| Search results are volatile metadata, decoupled from faceted row filtering. | PASS | `packages/ui/src/state/store.ts` exposes `clearSearchResults` separate from filter state. `store.test.ts` and `selectors.test.ts` cover the separation. |
| Visible search matches are intersected with rows that pass the active faceted filters. | PASS | `selectors.ts::useVisibleSearchMatches` performs the intersection; `selectors.test.ts` exercises it. |
| Search status, match count, and previous/next navigation controls render in the filter bar. | PASS | `components/filters/FilterBar.tsx` + `FilterBar.test.tsx` cover status, count, and navigation. |
| Timeline rows are marked (highlighted) for matches; keyboard navigation jumps between them. | PASS | `EventRow.tsx`, `TimelineRegion.tsx`, `TimelineList.tsx`; tests `TimelineRegion.test.tsx`, `TimelineList.virt.test.tsx`, `EventRow.columns.test.tsx`. |
| Facet chips no longer represent or clear search queries. | PASS | `ActiveFilterChips.tsx` and `FilterBar.test.tsx` confirm chips are filter-only. |
| Search query is persisted but volatile match metadata is sanitized on hydrate. | PASS | `state/persistence.ts`, `persistence.test.ts`, and `persist-effect.test.ts` cover sanitize-and-rehydrate. |
| End-to-end behavior is exercised in a browser. | PASS | `e2e/phase12.spec.ts` is a Playwright regression for highlight/navigation under active filters. Screenshot `screenshots/phase12/01-search-keeps-context.png` archived. |

## Validation

```bash
pnpm test                   # PASS — full suite green at completion of 12-03
pnpm typecheck              # PASS
pnpm lint                   # PASS
pnpm e2e -- e2e/phase12.spec.ts   # PASS
pnpm -F @ahp-inspector/ui build   # PASS
```

Audit-time re-validation: `pnpm test` reports 1095 tests passing across 88 vitest files at 697bb76.

## Plan Coverage

| Plan | Subject | SUMMARY.md |
|---|---|---|
| 12-01 | State separation: volatile search metadata vs faceted filters | ✅ |
| 12-02 | Filter-bar navigation UI + timeline row marking | ✅ |
| 12-03 | Persistence sanitization, Playwright spec, docs | ✅ |

## Requirements Coverage

Phase 12 was a UX/architecture refactor and did not register new REQ-IDs in `.planning/REQUIREMENTS.md`. It does not regress any v1 or v1.1 requirement; existing search and filter requirements (originally satisfied in v1) continue to pass under the new model.

## Gaps

None blocking. No CONTEXT.md or UAT.md was produced for this phase — it entered the milestone late as a focused UX correction. Automated coverage (unit + Playwright + persistence sanitize tests) compensates.

## Notes

- Backfilled during v1.1 milestone audit; the original phase execution missed creating a rolled-up VERIFICATION.md.
- Persistence sanitize behavior is tested in both the store and the persist-effect layers, covering hydrate-time and write-time paths.
- Local-only privacy posture is unchanged — search match metadata never leaves the browser tab.
