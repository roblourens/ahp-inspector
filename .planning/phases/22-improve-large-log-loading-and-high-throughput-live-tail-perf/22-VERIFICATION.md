---
phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
verified: 2026-05-16T19:26:14Z
status: human_needed
score: 17/17 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open a fixture-backed large JSONL log and inspect rows before baseline loading finishes"
    expected: "Rows become visible before completion, details can be opened, and honest percent or row-count loading status remains visible without replacing the timeline once rows exist."
    why_human: "Automated source/test evidence verifies the state flow, but the visible progressive-loading interaction and copy presentation need browser confirmation."
  - test: "Append a fixture-backed burst while following the tail and while scrolled away from the tail"
    expected: "Following-tail motion remains smooth when parked at bottom; scrolled-away inspection remains stable; compact stream backlog status appears only while queued transport work exists."
    why_human: "Responsiveness, perceived scroll stability, and transient backlog presentation are real-time interaction qualities."
  - test: "Confirm compact backlog and loading cues remain visually distinct from the manual paused-live-tail New Events control"
    expected: "The backlog pill is passive status, the New Events pill remains the click-to-resume affordance, and neither cue causes distracting layout movement."
    why_human: "DOM tests verify composition and passive semantics, but the final visual distinction and layout feel require a human look."
---

# Phase 22: Improve large-log loading and high-throughput live tail performance Verification Report

**Phase Goal:** Make large JSONL logs useful sooner and keep live-tail inspection responsive under append bursts through targeted patch locality, truthful progressive-load progress, bounded browser publication, and visible compact backlog state.
**Verified:** 2026-05-16T19:26:14Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

Phase 22 has no roadmap success-criteria array and no repository `.planning/REQUIREMENTS.md`; verification therefore uses the roadmap goal plus the 17 explicit PLAN frontmatter truths as the observable contract. No requirement IDs were fabricated.

The implementation contract is verified in code and targeted tests. Human verification remains mandatory because this phase includes visible progress/backlog presentation and real-time perceived responsiveness under append bursts.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Correlation work exposes exact historical row indexes whose pair/status metadata changed. | VERIFIED | `Correlator.#changedIndexes` and `drainChangedIndexes()` record/drain mutation-local indexes in `packages/core/src/correlator.ts`; correlator tests cover late responses and drain semantics. |
| 2 | Late responses, displaced rows, timeout flushes, and reset paths report changed rows without callers inspecting all prior rows. | VERIFIED | Mutation-site additions in `#onRequest`, `#onResponse`, `#pair`, `flush()`, and `reset()` plus focused tests for displaced, flush, repeated drain, and reset behavior. |
| 3 | AppState preserves append/patch semantics without scanning every earlier projected row after each append. | VERIFIED | `packages/server/src/app-state.ts` drains correlator indexes and filters pre-existing rows before `buildPatchUpdates()`; the historical `0..range.from` rediscovery loop is absent. |
| 4 | Timeout flush patches update only rows reported by the correlator changed-index contract. | VERIFIED | `runFlush()` calls `correlator.flush()` then `buildPatchUpdates(correlator.drainChangedIndexes())`; targeted AppState tests passed. |
| 5 | Large append sequences retain compact row payloads and avoid replay/state inflation while metadata settles after row visibility. | VERIFIED | AppState/SSE tests assert rows and patches contain no replay `diagnostics`, `intents`, or `cache` payloads; append/patch remain distinct. |
| 6 | Server transport distinguishes trustworthy initial-read byte progress from later live-tail backlog work. | VERIFIED | `WatchSink` initial-read lifecycle callbacks feed AppState `load-progress`; SSE backlog is a separate `stream-backlog` payload. |
| 7 | Snapshot/progress/live frames are preserved while an initial snapshot is streamed. | VERIFIED | SSE route subscribes before snapshot delivery, queues concurrent payloads, reports backlog, and drains after `snapshot-end`; integration test covers queued snapshot-era progress and append frames. |
| 8 | Percentage progress is emitted only when backed by a captured initial byte denominator. | VERIFIED | TailReader sources totals from `sizeAtStart`; AppState emits `percent` only when `totalBytes > 0`; tests cover 0, 50, and 100 percent byte-grounded progress. |
| 9 | Snapshot rows become visible before `snapshot-end`. | VERIFIED | SSE client enqueues `snapshot-chunk` frames and drains them through `appendSnapshotRows()` before snapshot completion; transport tests passed. |
| 10 | Live append and patch bursts drain in bounded scheduled browser batches. | VERIFIED | SSE client uses `MAX_DRAIN_FRAMES = 50`, scheduled via `requestAnimationFrame` or microtask fallback, with generation invalidation on reset/close. |
| 11 | UI store tracks explicit baseline load and stream backlog state separately from manual paused-tail counts. | VERIFIED | `LoadProgress`, `StreamBacklog`, `appendSnapshotRows`, `setLoadProgress`, and `setStreamBacklog` are separate from `pendingBuffer` and `pendingNewCount`. |
| 12 | Users receive trustworthy percentage loading when available and honest indeterminate/count loading otherwise. | VERIFIED | `LoadingState` and inline timeline status render percent only when provided; otherwise they render loaded-row count copy. |
| 13 | Already-loaded rows remain visible and inspectable while loading status remains present. | VERIFIED | `TimelineRegion` renders full `LoadingState` only for zero rows, then keeps `TimelineList` mounted with inline loading status once rows exist. |
| 14 | Buffered live-tail lag is visible through a compact backlog cue distinct from manual pause/resume UI. | VERIFIED | `StreamBacklogPill` is a passive status component wired separately from clickable `NewEventsPill`; timeline tests passed. |
| 15 | Per-log preference hydration waits for explicit baseline completion rather than first progressive row. | VERIFIED | `persist-effect.ts` hydrates only when `loadProgress.phase === "complete"`, including late-mounted effects, and flushes pending saves on cleanup. |
| 16 | A user inspecting loaded rows is not pulled forward by later baseline chunks. | VERIFIED | `TimelineList` disables follow-tail when selection navigation moves off-screen and only bottom-scrolls while `followTailRef.current`; virtualization regression tests passed. |
| 17 | Tail-follow remains smooth only while the user is actually following the latest row. | VERIFIED | `TimelineList` recomputes follow state from distance to bottom and schedules bottom scroll through `requestAnimationFrame`; at-tail/off-tail test coverage passed. |

**Score:** 17/17 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/core/src/correlator.ts` | Changed-index drain contract | VERIFIED | Substantive mutation-local changed-set logic; consumed by AppState. |
| `packages/core/src/correlator.test.ts` | Pair/displacement/flush/reset coverage | VERIFIED | Focused verifier run passed. |
| `packages/server/src/app-state.ts` | Targeted patch projection and truthful progress payloads | VERIFIED | Changed-index patches, load-progress snapshot replay, compact payload shape. |
| `packages/server/src/app-state.test.ts` | Progress, compact payload, patch-locality regression coverage | VERIFIED | Focused verifier run passed. |
| `packages/shared/src/host-protocol.ts` | Initial read lifecycle contract | VERIFIED | Typed start/progress/complete callbacks present. |
| `packages/host-node/src/tail-reader.ts` | Captured-byte lifecycle and read cursor safety | VERIFIED | Uses `sizeAtStart`, delivered-byte `nextOffset`, and completion gating. |
| `packages/host-node/src/tail-reader.test.ts` | Initial read lifecycle tests | VERIFIED | Focused verifier run passed. |
| `packages/server/src/sse-routes.ts` | Snapshot-era queue and backlog transport | VERIFIED | Subscribe-before-snapshot queueing plus backlog start/clear frames. |
| `test/sse-integration.test.ts` | Stream preservation and compact payload integration coverage | VERIFIED | Focused verifier run passed. |
| `packages/ui/src/state/store.ts` | Load/backlog store state and progressive row actions | VERIFIED | Wired to SSE client and timeline selectors. |
| `packages/ui/src/transport/sse-client.ts` | Bounded scheduled streamed-frame publication | VERIFIED | Progressive chunks, 50-frame drain budget, reset/close invalidation. |
| `packages/ui/src/components/states/LoadingState.tsx` | Truthful zero-row loading presentation | VERIFIED | Percent only when provided; count fallback. |
| `packages/ui/src/components/shell/StreamBacklogPill.tsx` | Passive compact transport lag cue | VERIFIED | Presentational status only; no manual-pause coupling. |
| `packages/ui/src/components/timeline/TimelineRegion.tsx` | Rows-plus-status composition | VERIFIED | Inline progress/backlog while `TimelineList` remains mounted. |
| `packages/ui/src/persistence/persist-effect.ts` | Completion-driven preference hydration | VERIFIED | Explicit lifecycle gate, late-subscribe replay compatibility, cleanup flush. |
| `packages/ui/src/components/timeline/TimelineList.tsx` | Viewport ownership and follow-tail scheduling | VERIFIED | Browser-local follow-tail ref and rAF bottom-scroll gate. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `correlator.ts` | `app-state.ts` | `drainChangedIndexes()` | WIRED | AppState consumes exact changed indexes after append and flush. |
| `tail-reader.ts` | `app-state.ts` | `onInitialReadStart/Progress/Complete` WatchSink callbacks | WIRED | Byte lifecycle crosses host boundary into load-progress state. |
| `app-state.ts` | `sse-routes.ts` | Typed `load-progress` and `stream-backlog` payloads | WIRED | Snapshot replay and queue backlog transport confirmed. |
| `sse-routes.ts` | `sse-client.ts` | SSE `snapshot-*`, `load-progress`, and `stream-backlog` events | WIRED | Client listeners enqueue each frame type. |
| `sse-client.ts` | `store.ts` | Scheduled drains call row/progress/backlog actions | WIRED | `appendSnapshotRows`, `appendRows`, `applyPatch`, `setLoadProgress`, `setStreamBacklog`. |
| `TimelineRegion.tsx` | `store.ts` | Selectors for `loadProgress` and `streamBacklog` | WIRED | Status UI reads real store state. |
| `persist-effect.ts` | `store.ts` | Explicit baseline completion lifecycle | WIRED | Hydration waits on `loadProgress.phase === "complete"`. |
| `TimelineList.tsx` | Browser frame scheduling | `followTailRef` plus `requestAnimationFrame` | WIRED | Scroll-to-bottom occurs only while follow mode is active. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `LoadingState.tsx` | `progress` | `TimelineRegion` store selector <- SSE `load-progress` <- AppState initial-read lifecycle <- TailReader byte progress | Yes | FLOWING |
| `StreamBacklogPill.tsx` | `count` | `TimelineRegion.streamBacklog` <- SSE `stream-backlog` <- server snapshot-era queue depth | Yes | FLOWING |
| `TimelineRegion.tsx` | `rows`, `loadProgress`, `streamBacklog` | Zustand store <- scheduled SSE client drain | Yes | FLOWING |
| `persist-effect.ts` | `loadProgress.phase`, `rows.length`, `logKey` | Zustand store <- snapshot/load lifecycle replay from SSE | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command / Evidence | Result | Status |
| --- | --- | --- | --- |
| Locality/progress/browser-drain/persistence regression cluster | Verifier `runTests`: correlator, AppState, SSE client, persistence effect | 57 passed, 0 failed | PASS |
| Tail lifecycle/status UI/SSE integration/viewport cluster | Verifier `runTests`: tail reader, loading state, backlog pill, timeline region, virtualized timeline, SSE integration | 41 passed, 0 failed | PASS |
| Broader repository validation supplied by orchestrator | `pnpm test`; `pnpm typecheck`; `pnpm e2e` | 100 files / 1209 tests passed; all 9 workspace typechecks passed; 5/5 Playwright tests passed | PASS |

Focused Biome checks were reported passing for the review-follow-up files. Full `pnpm lint` is intentionally not recorded as clean: the orchestrator observed it stop on unrelated pre-existing repo lint/format findings outside Phase 22 touched scope. Codebase drift was skipped with `no-structure-md`; schema drift reported `drift_detected:false`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| Traceability unavailable | Roadmap + repository state | Roadmap requirement field is `TBD`; `.planning/REQUIREMENTS.md` is absent. | LIMITATION | Verification traced the goal through PLAN `must_haves` instead of fabricating requirement IDs or descriptions. |

No orphaned requirement IDs can be enumerated because the repository does not contain `.planning/REQUIREMENTS.md` and Phase 22 plan `requirements:` arrays are empty.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `packages/server/src/app-state.ts` | 314 | Chunk-wide `newlineSize = text.includes("\\r\\n") ? 2 : 1` remains from the Phase 22 review's WR-02 observation. | WARNING | Not a blocker for Phase 22 progress/backlog goal because progress percentages use TailReader byte totals, but exact per-event byte offsets may still drift on mixed or chunk-split newline input. |

No blocker-class TODO/FIXME/placeholder or hollow dynamic-data patterns were found in the Phase 22 must-have artifacts. The earlier review's read-cursor data-loss finding is visibly fixed in `tail-reader.ts` via delivered-byte `nextOffset`, and the append-row replay-field assertion now checks real `appendPayload.rows` in SSE integration coverage.

### Human Verification Required

#### 1. Progressive Large-Log Inspection

**Test:** Open a large fixture-backed JSONL log and click an already-visible row before the baseline finishes loading.
**Expected:** Rows appear before completion, detail inspection opens normally, and progress text remains honest without replacing the timeline once rows exist.
**Why human:** Browser-visible flow and perceived usefulness need direct confirmation.

#### 2. Burst Tail Responsiveness and Viewport Ownership

**Test:** Append a fixture-backed burst while following the tail, then repeat while scrolled away from the bottom and inspecting a row.
**Expected:** At-bottom follow stays smooth; off-tail viewport remains stable; temporary stream backlog status appears while queued work exists and clears afterward.
**Why human:** Real-time responsiveness and scroll feel are interaction properties beyond source/test inspection.

#### 3. Backlog Cue Visual Distinction

**Test:** Compare the transport backlog pill with the manual paused-tail New Events pill during fixture-backed scenarios.
**Expected:** Backlog is passive compact status; New Events remains the click-to-resume control; the two cues are visually distinct and do not jostle layout.
**Why human:** DOM semantics are tested, but visual clarity and layout stability require a human look.

### Gaps Summary

No implementation-blocking gaps were found against the 17 PLAN must-haves. The codebase achieves the Phase 22 goal at the implementation level: changed-index patch locality replaces history scans, initial byte progress is denominator-honest, snapshot-era live work is queued and surfaced, the browser publishes rows progressively through bounded drains, and lifecycle/viewport behavior is guarded.

Status remains `human_needed` because verifier policy requires escalation for visible UI quality and real-time responsiveness claims. Security enforcement is enabled and no Phase 22 SECURITY artifact exists; that is a workflow next-step routing item, not evidence against this implementation goal.

---

_Verified: 2026-05-16T19:26:14Z_
_Verifier: the agent (gsd-verifier)_
