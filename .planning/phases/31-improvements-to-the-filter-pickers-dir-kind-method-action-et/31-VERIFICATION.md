---
phase: 31-improvements-to-the-filter-pickers-dir-kind-method-action-et
verified: 2026-06-12T01:50:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
gaps: []
---

# Phase 31: Filter Picker Improvements Verification Report

**Phase Goal:** Make facet pickers feel like conventional, polished dropdowns with one contextual complete-set action, deterministic ordering, contained controls, and corrected Group-row geometry.
**Status:** passed

## Goal Achievement

| Truth | Status | Evidence |
| --- | --- | --- |
| Categorical pickers show exactly one complete-set contextual action and no visible Close | VERIFIED | `FacetPopover.tsx`; focused component and Phase 25/31 browser tests |
| The complete-set action remains correct under local query filtering and the 100-row cap | VERIFIED | `FilterBar.test.tsx`; `e2e/phase31.spec.ts` |
| All seven categorical facets sort by formatted visible label with deterministic raw-value ties | VERIFIED | `FilterBar.tsx`; all-facet, tie, and count-stability regressions |
| Searchable input and selected Group row stay locally contained | VERIFIED | Local `boxSizing: border-box`; component and browser containment assertions |
| Narrow menus remain visibly painted inside the viewport | VERIFIED | Feature-detected CSS anchors, fallback tests, `toBeInViewport()`, and inspected narrow screenshot |
| Facet and Group pickers are mutually exclusive | VERIFIED | Shared `openPopover` owner and direct-switch regression |
| Dark, Light, and Hacker picker surfaces remain readable | VERIFIED | Inspected `screenshots/phase31/01` through `03` |
| Group: Session selected background remains inside its popover | VERIFIED | Browser containment assertion and inspected `05-dark-group-session.png` |
| Saved evidence is synthetic-only and path-private | VERIFIED | Repository fixture plus explicit synthetic rows; path-leak check before every Phase 31 capture |

## Automated Evidence

- Focused component tests: 60/60 passed.
- Phase 25/31 Chromium E2E: 3/3 passed.
- UI production build: passed.
- Full repository tests: 107 files, 1,368 tests passed.
- Full repository typecheck: all packages passed.
- Phase 31 scoped Biome check: passed with two pre-existing FilterBar unused-code warnings.
- Final independent code review: no findings.

## Visual Evidence Review

All five Phase 31 screenshots were inspected. They contain only fixture/synthetic content and no absolute paths. No clipping, overlap, footer/input overflow, count overflow, selected-background bleed, or unreadable theme treatment was found. The Dark desktop evidence shows the default unchecked `ping` state and exactly one `Select all` command.

## Lint Note

The literal root `pnpm lint` command remains non-green for unrelated workspace/repository debt: an untracked nested `.claude/worktrees/atomic-tinkering-abelson/biome.json` conflicts with the root config, and an explicit tracked-file Biome pass reports 42 pre-existing formatting errors outside Phase 31. Phase 31-owned files introduce no Biome errors.

## Verdict

Phase 31 achieves its requested behavior and UI evidence contract with no implementation, review, privacy, or test gaps.

---
_Verified: 2026-06-12T01:50:00Z_
_Verifier: GitHub Copilot plus independent code-reviewer and gsd-verifier agents_
