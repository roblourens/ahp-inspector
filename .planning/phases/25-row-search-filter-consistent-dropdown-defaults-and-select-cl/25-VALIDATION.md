---
phase: 25
slug: row-search-filter-consistent-dropdown-defaults-and-select-cl
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-29
---

# Phase 25 - Validation Strategy

> Per-phase validation contract for row-string filtering and categorical visibility menus.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest via workspace configuration; Playwright for browser workflow verification |
| **Config file** | `vitest.config.ts`, `packages/ui/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run packages/ui/src/state/selectors.test.ts packages/ui/src/components/filters/FilterBar.test.tsx packages/ui/src/state/persistence.test.ts packages/ui/src/persistence/persist-effect.test.ts` |
| **Full suite command** | `pnpm test && pnpm --filter @ahp-inspector/ui build && pnpm exec playwright test e2e/phase25.spec.ts` |
| **Estimated runtime** | Existing focused UI tests are sub-minute; phase browser proof is one fixture-backed spec. |

## Sampling Rate

- **After every task commit:** Run the automated command listed on that task.
- **After every plan wave:** Run all focused UI tests introduced or modified in completed plans.
- **Before `/gsd-verify-work`:** Run `pnpm test`, UI typecheck/build, and `e2e/phase25.spec.ts` against synthetic fixture data.
- **Max feedback latency:** Keep individual task checks to focused Vitest files; reserve browser build/e2e for the final wave.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | FILTER-25-01, FILTER-25-02 | T-25-01, T-25-02 | Bounded literal row-text predicate and uniform hidden-value filtering | unit | `pnpm exec vitest run packages/ui/src/state/selectors.test.ts` | Yes | pending |
| 25-01-02 | 01 | 1 | FILTER-25-01 | T-25-01 | Deferred projection filtering stays responsive and separate from Search matches | unit | `pnpm exec vitest run packages/ui/src/state/selectors.test.ts packages/ui/src/components/timeline/TimelineRegion.test.tsx` | Yes | pending |
| 25-02-01 | 02 | 2 | FILTER-25-04 | T-25-03 | V1 preferences cannot reverse new hidden semantics | unit | `pnpm exec vitest run packages/ui/src/state/persistence.test.ts packages/ui/src/persistence/persist-effect.test.ts` | Yes | pending |
| 25-02-02 | 02 | 2 | FILTER-25-04 | T-25-03 | Defaults, log switching and restored row filter remain deterministic | unit | `pnpm exec vitest run packages/ui/src/state/store.test.ts packages/ui/src/persistence/persist-effect.test.ts` | Yes | pending |
| 25-03-01 | 03 | 2 | FILTER-25-02, FILTER-25-03 | T-25-02 | Explicit controls write literal hidden values only | component | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` | Yes | pending |
| 25-03-02 | 03 | 2 | FILTER-25-01 | T-25-02 | Row-text filter is visible, dismissible and does not replace Search | component | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx packages/ui/src/components/shell/AppShell.test.tsx` | Yes | pending |
| 25-04-01 | 04 | 3 | FILTER-25-01..04 | T-25-04 | Fixture-only desktop and narrow browser evidence proves workflow behavior and compact layout clarity | e2e | `pnpm --filter @ahp-inspector/ui build && pnpm exec playwright test e2e/phase25.spec.ts` | No, task creates | pending |
| 25-04-02 | 04 | 3 | FILTER-25-04 | - | Docs state Search versus Filter rows and visibility-control semantics | docs + gate | `pnpm test && pnpm --filter @ahp-inspector/ui typecheck` | Yes | pending |
| 25-05-01 | 05 | 4 | FILTER-25-04 | T-25-04 | Human inspects desktop and narrow safe-fixture evidence only after automated browser proof exists | checkpoint | `test -f screenshots/phase25/01-row-filter-and-facets.png && test -f screenshots/phase25/02-row-filter-and-facets-narrow.png` | No, Plan 04 creates | pending |

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. New E2E coverage is deliberately produced in Plan 04 after component behavior exists; Plans 01-03 each use existing unit/component harnesses from the start.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Compact filter bar controls remain comfortably usable at desktop and responsive widths | FILTER-25-01..03 | Automated assertions prove behavior; final human check catches density/label clipping regressions. | After fixture-backed Playwright evidence is captured, open its saved desktop/narrow screenshots under `screenshots/phase25/` and confirm Search, Filter rows and popover commands do not overlap or truncate incoherently. |

## Validation Sign-Off

- [x] All tasks are assigned an automated verification command.
- [x] Sampling continuity: no three consecutive code tasks omit automated proof.
- [x] Wave 0 has no missing infrastructure dependencies.
- [x] No watch-mode flags are used.
- [x] Fixture-only screenshot rule is encoded in the final plan.

**Approval:** pending execution and screenshot review
