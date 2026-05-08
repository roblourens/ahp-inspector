---
phase: 02-vertical-slice-cli-server-timeline
plan: 03
subsystem: ui
tags: [react, vitest, design-tokens, timeline]

requires:
  - phase: 02-00
    provides: "Row projection types: Direction, DirGlyph, KindTag, ActionFamily, LatencyBand, Status"
  - phase: 02-02
    provides: "Design tokens (--dir-*, --kind-*, --action-*, --latency-*, --color-*) and no-hex-in-components guard"
provides:
  - "Six leaf timeline cell components consuming only design-token CSS variables"
  - "DirectionGlyph (→ ← ·) with --dir-* color"
  - "KindTag uppercase pill with color-mixed --kind-* background"
  - "ActionDot 6px circle keyed to --action-* family"
  - "StatusCell text/pill renderer for ok/error/pending/orphan/unmatched/n-a"
  - "LatencyCell with ms/s formatting and band-colored 4px bar"
  - "PayloadPreview with text-overflow:ellipsis"
affects: [02-04, 03, 04]

tech-stack:
  added: []
  patterns:
    - "Leaf-cell components: stateless, prop-driven, single-responsibility per UI-SPEC §5"
    - "Design-token-only styling: every color/spacing references var(--*); guarded by no-hex-in-components.test.ts"
    - "data-testid + data-* attributes drive role-free unit assertions"

key-files:
  created:
    - packages/ui/src/components/timeline/cells/DirectionGlyph.tsx
    - packages/ui/src/components/timeline/cells/DirectionGlyph.test.tsx
    - packages/ui/src/components/timeline/cells/KindTag.tsx
    - packages/ui/src/components/timeline/cells/KindTag.test.tsx
    - packages/ui/src/components/timeline/cells/ActionDot.tsx
    - packages/ui/src/components/timeline/cells/ActionDot.test.tsx
    - packages/ui/src/components/timeline/cells/StatusCell.tsx
    - packages/ui/src/components/timeline/cells/StatusCell.test.tsx
    - packages/ui/src/components/timeline/cells/LatencyCell.tsx
    - packages/ui/src/components/timeline/cells/LatencyCell.test.tsx
    - packages/ui/src/components/timeline/cells/PayloadPreview.tsx
    - packages/ui/src/components/timeline/cells/PayloadPreview.test.tsx
  modified: []

key-decisions:
  - "Plan 02-03: widen DirectionGlyph prop to Direction | 'unknown' locally — shared Direction is c2s|s2c only, but UI-SPEC §5.1 calls for an 'unknown' fallback glyph; widening the cell prop avoids changing the shared type."
  - "Plan 02-03: import KindTag, ActionFamily, LatencyBand, Status from @ahp-viewer/core (re-exported barrel) and Direction from @ahp-viewer/shared (not in core barrel)."

patterns-established:
  - "Cell component template: data-testid + data-{kind} attribute, inline style consuming var(--*) tokens, JSX returns a single span/div."
  - "TDD per cell: test file written first asserting visible textContent + data-* attributes, then implementation."

requirements-completed: [TIME-02, TIME-03]

duration: 13min
completed: 2026-05-07
---

# Phase 02 Plan 03: Timeline Cells Summary

**Six hand-rolled leaf cell components (DirectionGlyph, KindTag, ActionDot, StatusCell, LatencyCell, PayloadPreview) ready for EventRow composition in Plan 02-04 — token-only styling, 26 unit tests green.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-07T14:55:34Z
- **Completed:** 2026-05-07T15:08:34Z
- **Tasks:** 2 (each TDD: RED + GREEN)
- **Files created:** 12

## Accomplishments

- All six timeline cells implemented per UI-SPEC §5 (one component per file, paired Vitest)
- 26 cell tests pass; full UI suite + workspace typecheck + UI build all green
- Zero hex-color literals introduced (no-hex guard from Plan 02-02 still passes)
- Plan 02-04 can now import these cells directly into EventRow with no further refactoring

## Task Commits

1. **Task 1 RED — DirectionGlyph/KindTag/ActionDot tests** — `cb02bc7` (test)
2. **Task 1 GREEN — DirectionGlyph/KindTag/ActionDot impl** — `70a9341` (feat)
3. **Task 2 RED — StatusCell/LatencyCell/PayloadPreview tests** — `861bb42` (test)
4. **Task 2 GREEN — StatusCell/LatencyCell/PayloadPreview impl** — `ec96315` (feat)

Plan metadata commit follows.

## Files Created/Modified

- `packages/ui/src/components/timeline/cells/DirectionGlyph.tsx` — direction arrow renderer with `--dir-*` colors
- `packages/ui/src/components/timeline/cells/DirectionGlyph.test.tsx` — c2s/s2c/unknown cases
- `packages/ui/src/components/timeline/cells/KindTag.tsx` — uppercase pill with color-mixed `--kind-*` background, tooltip per UI-SPEC
- `packages/ui/src/components/timeline/cells/KindTag.test.tsx` — six kinds × text + title assertions
- `packages/ui/src/components/timeline/cells/ActionDot.tsx` — 6px circle keyed to `--action-{family}`; null when family is null
- `packages/ui/src/components/timeline/cells/ActionDot.test.tsx` — null case + five families
- `packages/ui/src/components/timeline/cells/StatusCell.tsx` — six-status renderer (text/pill split for warning states)
- `packages/ui/src/components/timeline/cells/StatusCell.test.tsx` — 2xx / ERR / … / ORPHAN / TIMEOUT / —
- `packages/ui/src/components/timeline/cells/LatencyCell.tsx` — ms/s formatter + band-colored 4px bar; tabular numerals
- `packages/ui/src/components/timeline/cells/LatencyCell.test.tsx` — `12ms` / `1.5s` / `—` (no bar)
- `packages/ui/src/components/timeline/cells/PayloadPreview.tsx` — muted ellipsis-truncated preview span
- `packages/ui/src/components/timeline/cells/PayloadPreview.test.tsx` — verbatim text + ellipsis style

## Decisions Made

- Imported `KindTag`, `ActionFamily`, `LatencyBand`, `Status` from `@ahp-viewer/core` (the public barrel), and `Direction` from `@ahp-viewer/shared` (since core does not re-export it).
- Widened `DirectionGlyph` prop locally to `Direction | "unknown"` to honor UI-SPEC §5.1's unknown-glyph requirement without altering the shared `Direction` union.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Direction type mismatch with plan's stated interface**
- **Found during:** Task 1 (DirectionGlyph implementation)
- **Issue:** The plan asserted that `@ahp-viewer/core` exports `Direction = "c2s" | "s2c" | "unknown"`. In reality, `Direction` is defined in `@ahp-viewer/shared` as `"c2s" | "s2c"` only, and is not re-exported from core. Coding the cell as the plan literally specified would not type-check.
- **Fix:** Import `Direction` from `@ahp-viewer/shared`, then locally widen the cell prop to `DirectionInput = Direction | "unknown"` so the third (unknown) case the plan and UI-SPEC §5.1 require remains addressable. Documented inline.
- **Files modified:** `packages/ui/src/components/timeline/cells/DirectionGlyph.tsx`
- **Verification:** `pnpm typecheck` passes; `DirectionGlyph.test.tsx` exercises all three cases.
- **Committed in:** `70a9341` (Task 1 GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Cosmetic — preserves the plan's intended behavior while matching the actual shared type. No scope creep.

## Issues Encountered

- `vitest run` from the repo root applied the root vitest config which only includes `**/*.test.ts` (not `.tsx`). Ran tests via `pnpm -F @ahp-viewer/ui` (which uses the UI package's vitest config including `.tsx`). Not a fix — just an invocation note for future runs.

## User Setup Required

None — no external services configured.

## Next Phase Readiness

- Plan 02-04 (EventRow + ParseErrorRow + TimelineList + TimelineRegion) can import all six cells directly from `packages/ui/src/components/timeline/cells/` with stable signatures.
- All cells are pure (no state, no effects), so virtualization in 02-04 can render thousands of rows without coupling.
- No blockers.

## Verification

- `pnpm -F @ahp-viewer/ui vitest run src/components/timeline/cells` → 6 files, 26 tests passed
- `pnpm -F @ahp-viewer/ui build` → built in 269ms, no errors
- `pnpm typecheck` → 7 workspaces clean
- `grep -rEn '#[0-9a-fA-F]{3,8}' packages/ui/src/components/timeline/cells/` → 0 hits

## Self-Check: PASSED

- All 12 created files present on disk
- All 4 task commits present in `git log`: cb02bc7, 70a9341, 861bb42, ec96315

---
*Phase: 02-vertical-slice-cli-server-timeline*
*Completed: 2026-05-07*
