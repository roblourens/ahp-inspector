---
phase: 30-please-make-sure-that-we-will-discover-the-latest-logs-maybe
plan: 01
subsystem: host-node
tags: [discovery, filesystem, fairness, privacy, cli]

requires:
  - phase: 13-npx-publishing-and-auto-open-latest-log
    provides: CLI newest-valid AHP log selection
provides:
  - Independent bounded scanning for every configured log root
  - Fair picker retention across populated roots
  - Globally newest-valid CLI auto-open selection
affects: [log-picker, cli-auto-open, host-adapter]

tech-stack:
  added: []
  patterns: [streamed async opendir traversal, per-root bounded work, quota-and-fill retention]

key-files:
  created: [packages/host-node/src/bounded-log-discovery.ts, packages/host-node/src/bounded-log-discovery.test.ts]
  modified: [packages/host-node/src/discovery.ts, packages/host-node/src/discovery.test.ts, packages/host-node/src/find-latest-ahp-log.ts, packages/host-node/src/find-latest-ahp-log.test.ts]

key-decisions:
  - "Bound filesystem gathering independently per configured root, then let each consumer rank the complete gathered set."
  - "Retain one picker candidate per populated root before equal quota and global fill."
  - "Keep opaque ID resolution owned by the latest discovery invocation and build context labels only from safe relative path components."

patterns-established:
  - "Per-root scan state: time, stat, and immediate-entry counters reset for every configured root."
  - "Consumer ranking after bounded gathering: traversal order never acts as a candidate or probe cap."

requirements-completed: [DISC-30-01, DISC-30-02, DISC-30-03, DISC-30-04]

duration: 11min
completed: 2026-06-07
---

# Phase 30 Plan 01: Fair Latest-Log Discovery Summary

**Streamed per-root filesystem scanning now feeds a fair picker and globally newest-valid CLI auto-open without exposing local paths.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-07T20:04:22Z
- **Completed:** 2026-06-07T20:15:37Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Replaced shared global traversal budgets with an internal async `opendir` scanner that gives every root independent bounded work.
- Made picker retention fair across every populated root while preserving confidence ordering, a 200-result baseline, opaque IDs, and safe context labels.
- Removed the CLI's ten-probe cutoff and duplicate walker so auto-open probes the complete bounded gathered set newest-first.
- Added hermetic regressions for root starvation, post-recency launch selection, more than 800 gathered matches, more than 200 populated roots, quota/fill behavior, concurrent discovery, privacy, and preserved CLI depth.
- Deduplicated repeated and overlapping roots during fair retention so picker IDs remain unique without starving nested roots.

## Task Commits

Each task was committed atomically using TDD:

1. **Task 1: Build the shared bounded per-root path scan** - `0303b24` (RED), `880998e` (GREEN)
2. **Task 2: Make picker discovery fair across populated roots** - `c3eefbc` (RED), `b3b530f` (GREEN)
3. **Task 3: Make CLI auto-open probe the globally ranked gathered set** - `d198b98` (RED), `9249d87` (GREEN)
4. **Review hardening** - `96ccffd` (RED), `ca9d0ad` (GREEN)
5. **Overlap hardening** - `d6fe229`, `816781d` (RED), `807c472`, `0a0f80c` (GREEN)

## Files Created/Modified

- `packages/host-node/src/bounded-log-discovery.ts` - Shared internal per-root bounded scanner.
- `packages/host-node/src/bounded-log-discovery.test.ts` - Scanner bounds, recency, truncation, and ranking-safety regressions.
- `packages/host-node/src/discovery.ts` - Fair picker projection, quota/fill retention, safe labels, and exact opaque IDs.
- `packages/host-node/src/discovery.test.ts` - Picker fairness, privacy, concurrency, ranking, and cap regressions.
- `packages/host-node/src/find-latest-ahp-log.ts` - Global newest-first probing over fairly gathered candidates.
- `packages/host-node/src/find-latest-ahp-log.test.ts` - CLI starvation, probe-cap, global ranking, and depth regressions.

## Decisions Made

- Kept the scanner internal to `host-node`; consumers provide filename predicates and retain ownership of scoring or parser-backed shape checks.
- Marked discovery truncated whenever any explicit bound omits examined work, including launch-count and depth limits.
- Used a discovery invocation generation so overlapping calls cannot merge stale opaque IDs into the latest result mapping.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hardened context-label privacy and overlapping opaque-ID resolution**
- **Found during:** Phase-level code review
- **Issue:** Existing context-label construction exposed absolute path components, and concurrent discoveries could leave stale IDs resolvable.
- **Fix:** Constructed labels from validated relative path components and made the latest discovery invocation the sole ID-map owner.
- **Files modified:** `packages/host-node/src/discovery.ts`, `packages/host-node/src/discovery.test.ts`
- **Verification:** Focused privacy/concurrency regressions, 332 boundary/security tests, and clean second review.
- **Committed in:** `96ccffd`, `ca9d0ad`

**2. [Rule 1 - Bug] Preserved CLI traversal depth and reported bounded omissions**
- **Found during:** Phase-level code review
- **Issue:** Shared scanning initially reduced CLI depth by one and did not report launch/depth omissions as truncation.
- **Fix:** Restored the prior CLI search depth and marked launch-count/depth omissions truncated.
- **Files modified:** `packages/host-node/src/bounded-log-discovery.ts`, `packages/host-node/src/find-latest-ahp-log.ts`, related tests
- **Verification:** Focused depth/truncation regressions and clean second review.
- **Committed in:** `96ccffd`, `ca9d0ad`

**3. [Rule 2 - Missing Critical] Strengthened planned fairness and boundedness coverage**
- **Found during:** Phase-level code review
- **Issue:** Initial tests did not explicitly cover deterministic per-root stat/time reset, quota/fill allocation, or gathering beyond the historical 800-candidate cap.
- **Fix:** Added focused hermetic regressions for all three cases.
- **Files modified:** All three Phase 30 test files
- **Verification:** 28 focused Phase 30 tests pass.
- **Committed in:** `96ccffd`

**4. [Rule 1 - Bug] Reconciled overlapping-root deduplication with fair representation**
- **Found during:** Configured GSD code-review gate
- **Issue:** Repeated roots could emit duplicate IDs; a first dedupe approach could then let a broad root erase a nested root's reserved candidate.
- **Fix:** Deduplicated during seed/quota/fill retention, allowing one row to satisfy duplicate roots while reserving each nested root's distinct top candidate.
- **Files modified:** `packages/host-node/src/discovery.ts`, `packages/host-node/src/discovery.test.ts`
- **Verification:** Repeated-root and broad/nested-overlap regressions plus final clean GSD review.
- **Committed in:** `d6fe229`, `807c472`, `816781d`, `0a0f80c`

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing critical coverage). **Impact on plan:** All fixes reinforce the planned correctness, privacy, and compatibility guarantees without expanding the product surface.

## Issues Encountered

- TypeScript's overloaded `stat` return type widened to bigint stats during Task 1; using Node's named numeric `Stats` type resolved the exact type safely.
- Exact optional property typing required passing a concrete clock function to the scanner.

## User Setup Required

None - no external service configuration required.

## Verification

- 30 focused Phase 30 tests passed.
- 332 boundary and security tests passed.
- `@ahp-inspector/host-node` typecheck passed.
- Second code review returned no findings.
- Editor diagnostics are clean across all six changed source/test files.

## Next Phase Readiness

- Latest-log discovery is ready for real-world OSS log verification and phase completion.
- No known blockers or follow-up fixes remain.

---
*Phase: 30-please-make-sure-that-we-will-discover-the-latest-logs-maybe*
*Completed: 2026-06-07*