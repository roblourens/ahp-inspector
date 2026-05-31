---
phase: 25-row-search-filter-consistent-dropdown-defaults-and-select-cl
verified: 2026-05-29T23:53:46Z
status: gaps_found
score: 8/10 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The completed Phase 25 filter surface has safe-fixture visual evidence approved for a clear, lightweight Search versus row-filter interaction."
    status: failed
    reason: "The blocking human checkpoint failed: the user rejected the permanently side-by-side Search and Filter rows input boxes as ugly and requested a toggle-button style affordance."
    artifacts:
      - path: "packages/ui/src/components/filters/RowFilterInput.tsx"
        issue: "The row filter is a permanently mounted 280px companion input rather than a lighter reveal/toggle interaction."
      - path: "packages/ui/src/components/filters/FilterBar.tsx"
        issue: "SearchInput and RowFilterInput are always mounted next to one another in the primary toolbar."
      - path: "screenshots/phase25/01-row-filter-and-facets.png"
        issue: "Fixture-only desktop evidence was reviewed and not approved."
      - path: "screenshots/phase25/02-row-filter-and-facets-narrow.png"
        issue: "Fixture-only narrow evidence was reviewed and not approved."
    missing:
      - "Replace the always-visible second input with a lighter toolbar design, such as a toggle/button-revealed row-filter affordance."
      - "Preserve the implemented Search/filter independence, checked-visible facets, default-hidden ping behavior, persistence, and fixture-only screenshot rule."
      - "Capture new desktop and narrow fixture-only evidence and obtain explicit visual approval."
  - truth: "Preferences written under the old inclusion-style filter interpretation retain compatible hidden Method selections while avoiding reversed categorical selections."
    status: failed
    reason: "The v1 migration always spreads APP_DEFAULT_FILTERS and preserves only time bounds; it discards any legacy hidden Method choices beyond the default ping exclusion, despite Method already using exclusion semantics before this migration."
    artifacts:
      - path: "packages/ui/src/state/persistence.ts"
        issue: "migrateV1Filters ignores filters.method and resets it to APP_DEFAULT_FILTERS.method."
      - path: "packages/ui/src/state/persistence.test.ts"
        issue: "The migration test uses method: [\"ping\"] only, so it passes without covering loss of another pre-existing hidden method."
    missing:
      - "Safely decode and carry valid legacy Method exclusion values when migrating v1 preferences to v2."
      - "Add regression coverage for a legacy hidden Method value in addition to ping."
---

# Phase 25: Row Search Filter And Visibility Menus Verification Report

**Phase Goal:** Let users narrow visible timeline rows with an explicit projected-row text filter while preserving Search as full-event highlight/navigation, and make categorical filter menus truthful visibility checklists with uniform all/none controls and the existing default-hidden `ping` behavior.
**Verified:** 2026-05-29T23:53:46Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A literal projected-row text filter narrows visible rows independently of full-payload Search. | VERIFIED | `filters.ts` bounds `rowText` to 256 characters and matches only published projection fields; `selectors.ts` computes visible rows independently of `searchMatches`; selector/timeline tests cover coexistence. |
| 2 | Categorical filter state has one hidden-value invariant with application-default hidden `ping`. | VERIFIED | `APP_DEFAULT_FILTERS.method` is `["ping"]`; `applyFacets` excludes values in each categorical array; selector tests cover hidden Direction, Kind and Method behavior. |
| 3 | Current-schema per-log preferences restore row text and hidden values after baseline completion and reset new logs to application defaults. | VERIFIED | `PerLogPrefs.v` is `2`; `persist-effect.ts` saves full filters and hydrates only at `loadProgress.phase === "complete"`; persistence/store tests cover restore and reset. |
| 4 | Legacy preferences preserve already-compatible hidden Method choices while preventing old inclusion-style filters from reversing visibility. | FAILED | `migrateV1Filters` returns `APP_DEFAULT_FILTERS` plus time bounds and never reads legacy `filters.method`; its test exercises only the default `["ping"]` case. |
| 5 | Users can enter, clear, and see feedback for row filtering without clearing Search. | VERIFIED | `RowFilterInput` writes `patchFilter("rowText", ...)`; `ActiveFilterChips` renders `Rows contain:`; component/store tests prove clear actions retain Search state. |
| 6 | Categorical menus expose checked-as-visible defaults, including unchecked `ping`. | VERIFIED | `FilterBar` converts visible selections to hidden arrays for all seven categorical facets; component and browser tests cover checked defaults and unchecked `ping`. |
| 7 | Categorical menus expose functional `Select all` and `Uncheck all`, and Turn remains usable with all Channels visible. | VERIFIED | `FacetPopover` invokes full-option/all-empty selection actions; `FilterBar.test.tsx` verifies resulting hidden state and enabled Turn interaction. |
| 8 | Fixture-backed browser evidence and documentation describe the implemented Search/filter and visibility semantics. | VERIFIED | `e2e/phase25.spec.ts` creates only synthetic fixture data, exercises both controls and menu commands, and generates the two `screenshots/phase25/` images; `USER_GUIDE.md` and `README.md` state the distinct semantics. |
| 9 | Desktop and narrow evidence is privacy-safe and shows readable menu commands without clipping. | VERIFIED | Both committed screenshots show synthetic `phase25-browser-safe.jsonl` content and readable `Select all` / `Uncheck all`; the E2E asserts menu viewport containment and absence of displayed absolute paths. |
| 10 | The compact filter-surface composition is explicitly accepted as clear and usable. | FAILED | Blocking Plan 25-05 review result: "The side-by-side input boxes are ugly. I would prefer something like a toggle button." The current screenshots and always-mounted `RowFilterInput` show the rejected composition. |

**Score:** 8/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/ui/src/state/filters.ts` | Bounded projected-row predicate and hidden-value defaults | VERIFIED | Substantive and consumed by selectors/store. |
| `packages/ui/src/state/selectors.ts` | Visible-row selection separate from Search navigation | VERIFIED | Consumed by `FilterBar`, `TimelineRegion`, and `AppShell`; paired Method handling is present. |
| `packages/ui/src/state/persistence.ts` | Versioned durable filter boundary and safe v1 migration | PARTIAL | v2 round-trip is implemented; v1 migration drops compatible non-default hidden Method values. |
| `packages/ui/src/persistence/persist-effect.ts` | Baseline-gated hydration and saving | VERIFIED | Writes v2 filters and hydrates at completed baseline only. |
| `packages/ui/src/components/filters/RowFilterInput.tsx` | Independent row-filter control | FAILED ACCEPTANCE | Functional, but its permanently visible second-input presentation is explicitly rejected. |
| `packages/ui/src/components/filters/FilterBar.tsx` | Mounted controls and checked-visible facet adapters | FAILED ACCEPTANCE | Functional wiring passes; always-adjacent Search and row-filter presentation is the rejected layout. |
| `packages/ui/src/components/filters/FacetPopover.tsx` | Explicit bulk visibility actions | VERIFIED | `Select all` and `Uncheck all` operate on complete options. |
| `packages/ui/src/components/filters/ActiveFilterChips.tsx` | Truthful row/hidden feedback | VERIFIED | Shows `Rows contain:` and `Hidden {label}:` without a Search chip. |
| `e2e/phase25.spec.ts` | Fixture-only browser proof and screenshot generation | VERIFIED | Sources fixture content from `PHASE5_BASE_JSONL` plus a synthetic `ping` event. |
| `screenshots/phase25/01-row-filter-and-facets.png` | Desktop safe-fixture evidence | FAILED ACCEPTANCE | Exists and is fixture-safe, but was reviewed and rejected for toolbar composition. |
| `screenshots/phase25/02-row-filter-and-facets-narrow.png` | Narrow safe-fixture evidence | FAILED ACCEPTANCE | Exists and is fixture-safe, but was reviewed and rejected for toolbar composition. |
| `USER_GUIDE.md`, `README.md` | Documented semantics | VERIFIED | Both distinguish Search navigation from projected-row filtering; the guide states checked-visible and default-hidden `ping` behavior. |

`gsd-sdk query verify.artifacts` reported every declared Plan 25 artifact present and non-stub. Artifact presence does not satisfy the failed human acceptance gate or the semantic migration defect above.

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `state/selectors.ts` | `state/filters.ts` | Deferred filters invoke `applyFacets` | VERIFIED | GSD key-link check passed and source trace confirms it. |
| `timeline/TimelineRegion.tsx` | `state/selectors.ts` | Filtered rows and visible Search matches feed separate timeline behaviors | VERIFIED | GSD key-link check passed; rendered rows and navigation use distinct selectors. |
| `persistence/persist-effect.ts` | `state/persistence.ts` | Per-log load/save at completed baseline | VERIFIED | GSD key-link check passed; semantic v1 Method preservation still fails inside the decoder. |
| `filters/RowFilterInput.tsx` | `filters/FilterBar.tsx` | `patchFilter("rowText", value)` | VERIFIED | GSD key-link check passed. |
| `filters/FacetPopover.tsx` | `filters/FilterBar.tsx` | Checked selections convert to hidden arrays | VERIFIED | GSD key-link check passed. |
| `e2e/phase25.spec.ts` | fixture source and both screenshots | Synthetic JSONL workflow and screenshot writes | VERIFIED | All five Plan 25-04/05 evidence links passed the GSD link checker. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RowFilterInput.tsx` / `FilterBar.tsx` | `filters.rowText` | User input -> Zustand `patchFilter` -> `useFilteredRows` -> `TimelineList` | Yes, computed from actual projected `EventRow` values | VERIFIED |
| `FacetPopover.tsx` / `FilterBar.tsx` | categorical hidden arrays | Facet counts from store rows -> visible checkboxes -> hidden-value state -> `applyFacets` | Yes, values derive from loaded timeline rows | VERIFIED |
| `persist-effect.ts` | per-log `filters` | Completed-baseline log key -> localStorage v2 prefs -> store hydration | Yes for v2; lossy for legacy custom Method hiding | PARTIAL |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
| --- | --- | --- | --- |
| Focused Phase 25 behavior suites | Test runner invoked on selector, timeline, persistence, store, filter-bar and Phase 25 E2E selections | `109` tests reported passed, `0` failed | PASS |
| UI type safety | `pnpm --filter @ahp-inspector/ui typecheck` | `tsc --noEmit` exited successfully | PASS |
| Declared artifacts and wiring | `gsd-sdk query verify.artifacts` and `verify.key-links` for plans `25-01` through `25-05` | All declared artifacts and all `11` links reported present/wired | PASS |
| Visual acceptance of current composition | Blocking fixture-only screenshot review | User rejected side-by-side text inputs and requested toggle-style interaction | FAIL |

The committed Playwright workflow and screenshots were inspected for source safety and coverage. They were not regenerated during this verification so the evidence artifacts remained untouched.

### Requirements Coverage

The requested canonical requirements ledger `.planning/REQUIREMENTS.md` does not exist in the workspace. Requirement descriptions below are therefore cross-referenced against Phase 25's inline requirement contract in `.planning/ROADMAP.md` and the plan frontmatter; formal ledger/orphan checking cannot be completed until that missing file is restored or its absence is intentionalized.

| Requirement | Source Plans | Description From Roadmap | Status | Evidence |
| --- | --- | --- | --- | --- |
| FILTER-25-01 | 25-01, 25-03, 25-04 | Projected-row string filter independent of Search | SATISFIED | Literal projection predicate, separate selectors/UI wiring and automated browser/component coverage exist. |
| FILTER-25-02 | 25-01, 25-02, 25-03, 25-04 | Checked-visible categorical defaults with `ping` hidden by default | SATISFIED | Hidden-value state, checked-visible adapters, unchecked `ping` and tests exist. |
| FILTER-25-03 | 25-03, 25-04 | `Select all` / `Uncheck all` menu actions | SATISFIED | Bulk commands are wired and component/browser-tested. |
| FILTER-25-04 | 25-02, 25-03, 25-04, 25-05 | Per-log durability, fixture-backed verification, and documented semantics | BLOCKED | v2 durability/docs/fixture safety exist, but legacy Method preferences are lost and the mandatory fixture visual-review checkpoint rejected the toolbar layout. |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| `packages/ui/src/state/persistence.ts` | Legacy decoder discards compatible `filters.method` state | BLOCKER | A saved legacy hidden Method selection beyond `ping` is silently lost on v2 load. |
| `packages/ui/src/state/persistence.test.ts` | Migration fixture covers only default `method: ["ping"]` | WARNING | The passing test does not exercise the failing compatible-data preservation case. |
| Touched UI paths | Placeholder/TODO/empty-handler scan | INFO | No goal-blocking placeholder implementation was identified; empty/null returns observed are ordinary guard/default paths. |

### Human Verification Required

No unresolved human decision is being marked pending: Plan 25-05 already received a blocking human result. After redesign, repeat fixture-only desktop/narrow review and require explicit approval before declaring the phase complete.

### Gaps Summary

Phase 25 has strong functional implementation evidence for local row filtering, Search independence, truthful visibility checkboxes, bulk actions, current-schema persistence, fixture-only browser proof and documentation. It is not complete: the shipped toolbar composition was expressly rejected in its blocking visual checkpoint, and legacy persisted hidden Method choices are not preserved through the v1-to-v2 migration required by Plan 25-02.

Neither gap is explicitly assigned to a later roadmap phase, so neither can be deferred. The missing `.planning/REQUIREMENTS.md` file additionally prevents canonical requirements-ledger cross-reference and should be resolved during follow-up bookkeeping without obscuring the two implementation/acceptance blockers.

### Recommended Gap-Closure Plans

1. **Revise the compact row-filter affordance and repeat visual approval.** Replace the always-adjacent second input with a lighter toggle/button-revealed `Filter rows` interaction, retain the independent filtering contract and truthful active feedback, update component/E2E coverage, regenerate both fixture-only screenshots, and return them for explicit review.
2. **Preserve legacy hidden Method preferences during schema migration.** Decode valid schema-v1 `filters.method` exclusion values while continuing to reset inclusion-era categorical arrays, add non-default Method migration regression coverage, and rerun persistence/typecheck verification.

---

_Verified: 2026-05-29T23:53:46Z_
_Verifier: the agent (gsd-verifier)_
