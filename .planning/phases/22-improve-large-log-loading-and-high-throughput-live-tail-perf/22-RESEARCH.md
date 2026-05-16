# Phase 22: Improve large-log loading and high-throughput live tail performance - Research

**Researched:** 2026-05-16  
**Domain:** Progressive JSONL baseline loading, high-throughput live tail fanout, and responsive virtualized browser state  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### First useful view
- **D-01:** Large logs should show useful content as quickly as practical instead of leaving the timeline blank until a full baseline finishes loading.
- **D-02:** The UI must remain responsive while initial content is still loading.
- **D-03:** Show a loading progress indicator with a percentage estimate when that estimate is feasible from the available data.
- **D-04:** Already-visible rows should support normal inspection during the remaining load, including row selection and opening details.
- **D-05:** Once the user is looking at loaded rows, the viewport should remain stable rather than being pulled forward by newly arriving initial-load rows.

### Burst tail behavior
- **D-06:** During heavy live append bursts, protect interaction responsiveness ahead of showing each event at the earliest possible instant.
- **D-07:** If the user is following the latest row, keep live-follow active but smooth updates enough to avoid jitter.
- **D-08:** If visible rows are briefly behind the file because work is buffered or batched, show a compact backlog cue rather than hiding that lag.
- **D-09:** Rows may become visible before derived pairing/status metadata has fully settled, if that helps maintain a responsive live viewer.

### the agent's Discretion
- Decide whether search and filters should work on partially loaded rows with explicit incomplete-result messaging, remain unavailable until the baseline finishes, or use another measured compromise.
- Decide what progress estimate is trustworthy. A percentage is preferred when feasible, but inaccurate percentages should not be fabricated.
- Decide the exact batching, scheduling, and metadata-settling strategy that best satisfies the decisions above.

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within Phase 22 scope.
</user_constraints>

## Summary

Phase 22 should not start by replacing file reading. The current host path already uses `createReadStream()` ranges with a 256 KiB high-water mark, async stat calls, coalesced overlapping change reads, and rotation/reset handling; Node's current file-system docs continue to recommend streaming when whole-file buffering would raise memory cost. [VERIFIED: packages/host-node/src/tail-reader.ts] [CITED: https://nodejs.org/api/fs.html#fscreatereadstreampath-options] [CITED: https://nodejs.org/api/fs.html#fsreadfilepath-options]

The first server bottleneck to remove is the `AppState` retroactive patch rediscovery loop. Each `EventStore.append()` synchronously notifies subscribers one event at a time, `Correlator` updates exact pairing/status indexes for that append, and then `AppState` scans every previously projected row to discover which rows changed. That shape is O(existing rows) per append even when only one prior request changed, so the aggregate cost can become triangular on large initial loads and live bursts. [VERIFIED: packages/core/src/event-store.ts, packages/core/src/correlator.ts, packages/server/src/app-state.ts]

The browser contract also needs to change. The SSE route already emits `snapshot-begin`, row chunks, and `snapshot-end`, but the client concatenates chunks into a hidden array and commits them only at the end; the current transport test deliberately asserts that rows remain invisible mid-snapshot. Separately, Zustand append/flush actions copy all visible rows and rescan all sessions, while patch application copies the visible rows plus pending buffer and searches the pending buffer per update. Phase 22 should replace the single-baseline-commit model with progressive, bounded snapshot commits and explicit progress/backlog state, then batch live append/patch application on interaction-friendly boundaries. [VERIFIED: packages/server/src/sse-routes.ts, packages/ui/src/transport/sse-client.ts, packages/ui/src/transport/sse-client.test.ts, packages/ui/src/state/store.ts]

**Primary recommendation:** Plan a measured three-part change: targeted server patch indexes instead of historical rescans, progressive snapshot frames with trustworthy progress/backlog metadata, and batched UI store application that preserves stable viewport ownership while rows and delayed metadata settle. [VERIFIED: codebase analysis plus Phase 22 CONTEXT.md]

## Project Constraints (from copilot-instructions.md)

- Keep AHP Inspector local-first: no telemetry, CDN assets, or outbound viewing dependencies. [VERIFIED: .github/copilot-instructions.md]
- Preserve a host-adapter boundary between file discovery/watching/reading and the portable browser UI. [VERIFIED: .github/copilot-instructions.md]
- Treat real JSONL logs as canonical and preserve the existing portable parser/event model/store/correlator/projection boundaries. [VERIFIED: .github/copilot-instructions.md]
- Use `../agent-host-protocol` for protocol concepts and schemas instead of inventing definitions. [VERIFIED: .github/copilot-instructions.md]
- Keep row payloads compact and lazy detail/state surfaces intact rather than pushing replay state into SSE rows. [VERIFIED: .github/copilot-instructions.md] [VERIFIED: .planning/PROJECT.md]
- Make incremental parsing, virtualization, and JSON-RPC-safe correlation foundational. [VERIFIED: .github/copilot-instructions.md]
- Verification screenshots, if Phase 22 later adds browser evidence, must use repository fixture JSONL files and be saved under `screenshots/<phase>/`. [VERIFIED: .github/copilot-instructions.md]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Incremental initial file read and tail re-read after change | Database / Storage adapter | API / Backend | The host adapter owns byte offsets, range streams, chokidar events, and rotation detection; server ingest consumes emitted chunks. [VERIFIED: packages/host-node/src/tail-reader.ts, packages/host-node/src/host-adapter.ts] |
| JSONL parse, event normalization, correlation, search/replay indexes | API / Backend | Database / Storage adapter | Parsed event semantics and derived metadata already live server-side so the browser receives portable projected rows rather than raw ingest mechanics. [VERIFIED: packages/server/src/app-state.ts, packages/core/src/correlator.ts] |
| Progressive snapshot progress and live backlog transport | API / Backend | Browser / Client | The server knows snapshot row/byte progress and SSE queue backlog; the browser renders that state. [VERIFIED: packages/server/src/sse-routes.ts, packages/server/src/app-state.ts] |
| Row visibility, loading status, backlog cue, and interaction responsiveness | Browser / Client | API / Backend | The UI owns when streamed chunks become visible, selection/detail behavior, and viewport anchoring. [VERIFIED: packages/ui/src/transport/sse-client.ts, packages/ui/src/state/store.ts, packages/ui/src/components/timeline/TimelineList.tsx] |
| Smooth live-follow versus stable user-owned viewport | Browser / Client | — | `TimelineList` already tracks bottom-follow separately from selection scroll, so Phase 22 should extend that local policy rather than move viewport rules to the server. [VERIFIED: packages/ui/src/components/timeline/TimelineList.tsx] |

## Standard Stack

### Core
| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| Node.js runtime | 22.22.1 available locally | CLI/server runtime and `node:perf_hooks` diagnostics | Repo requires `node >=22`; local runtime satisfies it. [VERIFIED: package.json] [VERIFIED: terminal `node --version`] |
| Node `fs` streams | Built-in to Node 22 | Existing range reads for initial load and tail growth | Current `TailReader` already streams byte ranges; Node docs support `start`, `end`, and `highWaterMark` range reads. [VERIFIED: packages/host-node/src/tail-reader.ts] [CITED: https://nodejs.org/api/fs.html#fscreatereadstreampath-options] |
| Node `perf_hooks` | Built-in to Node 22 | Server benchmark marks/measures, event-loop delay, optional ELU snapshots | Official APIs cover marks/measures, `monitorEventLoopDelay()`, and `performance.eventLoopUtilization()` on supported Node versions. [CITED: https://nodejs.org/api/perf_hooks.html] |
| Hono | Existing `^4.12.18`; registry latest 4.12.19 on 2026-05-16 | Existing local HTTP/SSE routing | Phase 22 should extend the existing route contract rather than add a transport framework. [VERIFIED: packages/server/package.json] [VERIFIED: npm registry] |
| React | Existing 19.2.6; registry latest 19.2.6 on 2026-05-16 | Timeline/UI rendering | Existing app is React-based; React docs support Transition-marked non-urgent updates when they help preserve interactivity. [VERIFIED: packages/ui/package.json] [VERIFIED: npm registry] [CITED: https://react.dev/reference/react/startTransition] |
| Zustand | Existing 5.0.13; registry latest 5.0.13 on 2026-05-16 | Browser row/progress/backlog state | Keep the current state container and reduce mutation cost within it. [VERIFIED: packages/ui/package.json] [VERIFIED: npm registry] |
| TanStack React Virtual | Existing 3.13.24; registry latest 3.13.24 on 2026-05-16 | Virtualized timeline rendering | Existing fixed-height timeline already uses it; preserve virtualization and adjust update cadence/anchor policy. [VERIFIED: packages/ui/package.json] [VERIFIED: npm registry] |

### Supporting
| Library / API | Version | Purpose | When to Use |
|---------------|---------|---------|-------------|
| chokidar | Existing `^5.0.0`; registry latest 5.0.0 on 2026-05-16 | File change/rotation event source | Keep for tail watching; Phase 22 is about ingest/update pressure after events arrive. [VERIFIED: packages/host-node/package.json] [VERIFIED: npm registry] |
| `requestAnimationFrame()` | Browser baseline API | Coalesce browser-visible commits and follow-tail scroll adjustments around paint | Use for UI commit/drain scheduling where a render-frame boundary is desired; rAF is one-shot and invoked before the next repaint. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame] |
| Existing Vitest/Playwright stack | Vitest script in root; Playwright config present | Unit, integration, perf guards, and optional fixture-based browser verification | Add focused Phase 22 regressions to current test infrastructure instead of introducing a new benchmark runner. [VERIFIED: package.json, playwright.config.ts, vitest.config.ts]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending current SSE frames | WebSocket transport | No evidence says duplex transport is needed; replacing SSE adds protocol/client complexity without addressing the confirmed scan/copy costs. [VERIFIED: packages/server/src/sse-routes.ts, packages/ui/src/transport/sse-client.ts]
| Current range-stream TailReader | Whole-file read or bespoke mmap/native loader | Current reader is already incremental and Node docs warn `readFile()` buffers whole files; optimize downstream before replacing this layer. [VERIFIED: packages/host-node/src/tail-reader.ts] [CITED: https://nodejs.org/api/fs.html#fsreadfilepath-options]
| Current React/Zustand/TanStack UI | New state/rendering stack | Confirmed pressure comes from update granularity and array/session rescans, not missing libraries. [VERIFIED: packages/ui/src/state/store.ts, packages/ui/src/components/timeline/TimelineList.tsx]

**Installation:**
```bash
# No new package installation recommended for Phase 22 research.
# Keep using the existing Node, Hono, React, Zustand, TanStack Virtual, and chokidar stack.
```
[VERIFIED: package manifests and npm registry queries]

## Architecture Patterns

### System Architecture Diagram

```text
JSONL file on disk
  |
  v
TailReader range stream + chokidar growth/rotation
  |  byte chunks, offsets, reset/error notices
  v
AppState parse -> normalize -> EventStore append
  |                         |
  |                         +--> Correlator reports changed row indexes
  |                         +--> Search/replay indexes remain server-side
  v
Progressive projected rows + compact patch metadata
  |
  v
SSE snapshot/live queue
  |  snapshot begin/chunk/progress/end, append batches, patch batches, backlog state
  v
Browser SSE client drain scheduler
  |
  +--> Zustand rows/progress/backlog state
  |       |
  |       +--> Inspectable visible rows + lazy details/state fetches
  |       +--> Compact backlog cue while behind
  v
TanStack Virtual timeline
  |
  +--> Stable viewport when the user moved away from tail
  +--> Smooth follow-latest when the user is parked at tail
```

The existing code already implements every box except explicit changed-index reporting, progressive browser commits, and surfaced progress/backlog state. [VERIFIED: packages/host-node/src/tail-reader.ts, packages/server/src/app-state.ts, packages/server/src/sse-routes.ts, packages/ui/src/transport/sse-client.ts, packages/ui/src/state/store.ts]

### Recommended Project Structure

```text
packages/
├── core/src/          # Correlation/change-locality primitives and event-store tests
├── host-node/src/     # Existing byte-range reader and tail watcher
├── server/src/        # AppState ingest, SSE progress/backlog contract, perf tests
└── ui/src/            # Progressive stream drain, Zustand state, viewport/backlog UI tests
test/                  # Cross-package SSE and fixture-based vertical-slice coverage
e2e/                   # Optional browser proof for large fixture/progressive loading behavior
```
[VERIFIED: workspace layout]

### Pattern 1: Changed-index patch propagation
**What:** Have correlation/flush work return or expose the exact historical row indexes whose status, pair, or latency changed, then patch only those projected rows. [VERIFIED: packages/core/src/correlator.ts, packages/server/src/app-state.ts]

**When to use:** Every append and timeout flush. This directly replaces whole-history rediscovery in `AppState` while preserving existing row and SSE patch semantics. [VERIFIED: packages/server/src/app-state.ts]

**Example:**
```typescript
// Pattern derived from current Correlator mutation sites in correlator.ts.
// AppState should receive changed indexes rather than rescan [0, range.from).
const appendedRows = projectAppend(range);
const patchIndexes = correlator.takeChangedIndexes();
const updates = projectPatchUpdates(patchIndexes);
emitAppendThenPatch(appendedRows, updates);
```
[VERIFIED: packages/core/src/correlator.ts, packages/server/src/app-state.ts]

### Pattern 2: Rows-first snapshot with explicit load state
**What:** Keep SSE snapshot chunking, but let the browser commit chunks incrementally and retain a first-class loading state until `snapshot-end`. Progress should be byte-based only when the server can provide a trustworthy denominator; otherwise show indeterminate loading plus loaded-row counts. [VERIFIED: packages/server/src/sse-routes.ts, packages/server/src/app-state.ts, packages/ui/src/transport/sse-client.ts] [VERIFIED: Phase 22 CONTEXT.md]

**When to use:** Initial large-log open. Visible rows must remain selectable/detail-fetchable while later chunks continue to arrive, per D-01 through D-05. [VERIFIED: Phase 22 CONTEXT.md]

**Example:**
```typescript
// Proposed SSE payload shape; keep rows compact and add load metadata beside them.
type SnapshotProgress = {
  loadedRows: number;
  loadedBytes?: number;
  totalBytes?: number;
  percent?: number;
};
```
[VERIFIED: design derived from existing LogMeta.sizeBytes and locked D-03]

### Pattern 3: UI drain scheduling that preserves ownership of scroll
**What:** Buffer incoming snapshot/live/patch frames briefly, drain bounded batches around render boundaries, and treat viewport motion as a user-owned/browser-local policy. `TimelineList` already differentiates follow-tail from selection-driven scrolling, so the new stream drain should not force-scroll when follow-tail has been disabled. [VERIFIED: packages/ui/src/components/timeline/TimelineList.tsx] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame]

**When to use:** Snapshot chunks, live bursts, and delayed metadata patches. Use urgent updates for explicit user actions; use scheduled or transition-marked non-urgent state publication only where it does not control text input state. [CITED: https://react.dev/reference/react/startTransition] [CITED: https://react.dev/reference/react/useTransition]

**Example:**
```typescript
let drainScheduled = false;

function scheduleDrain(): void {
  if (drainScheduled) return;
  drainScheduled = true;
  requestAnimationFrame(() => {
    drainScheduled = false;
    drainVisibleRowsWithinBudget();
  });
}
```
[CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame]

### Anti-Patterns to Avoid
- **Rescanning all projected history after every append:** the current loop is local code evidence for an O(history) append path; Phase 22 should move to changed-index propagation. [VERIFIED: packages/server/src/app-state.ts]
- **Keeping the timeline blank until `snapshot-end`:** current tests encode the old contract, but it contradicts D-01 and D-04. [VERIFIED: packages/ui/src/transport/sse-client.test.ts] [VERIFIED: Phase 22 CONTEXT.md]
- **Replacing TailReader before profiling downstream work:** current reader is already incremental and stateful; the confirmed pressure is projection/transport/store publication. [VERIFIED: packages/host-node/src/tail-reader.ts, packages/server/src/app-state.ts, packages/ui/src/state/store.ts]
- **Fabricating percentage progress from row count alone:** line sizes vary; D-03 permits percentages only when the estimate is feasible. [VERIFIED: Phase 22 CONTEXT.md]
- **Using React Transitions as a generic timer:** React calls Transition actions immediately and only marks synchronous state updates inside that scope; after async boundaries an additional transition wrapper is required. [CITED: https://react.dev/reference/react/startTransition]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File ingestion | Whole-file JSONL loader or new native reader | Existing `TailReader` + Node stream range reads | Current implementation already preserves offsets, rotation, and chunked delivery; Node docs support streaming for memory-sensitive file reads. [VERIFIED: packages/host-node/src/tail-reader.ts] [CITED: https://nodejs.org/api/fs.html#fsreadfilepath-options] |
| Render scale | Custom scroll virtualization | Existing TanStack Virtual timeline | Virtualization is already integrated and tested; Phase 22 needs better state cadence, not a second virtualizer. [VERIFIED: packages/ui/src/components/timeline/TimelineList.tsx, packages/ui/src/components/timeline/TimelineList.virt.test.tsx] |
| Pair/status discovery | Re-scan rows to infer what changed | Changed-index emission from correlator/flush work | Correlator mutation sites know the changed request/response/displaced indexes at the time they change. [VERIFIED: packages/core/src/correlator.ts] |
| Server performance visibility | Ad hoc `Date.now()` logging in production | Focused test/diagnostic use of `node:perf_hooks` | Node exposes marks/measures and event-loop delay metrics designed for this job. [CITED: https://nodejs.org/api/perf_hooks.html] |
| UI smoothness | Unbounded immediate store writes per SSE frame | Existing store plus bounded snapshot/live drain scheduler | Current store/API can be retained while reducing full-array copies and publication frequency. [VERIFIED: packages/ui/src/state/store.ts, packages/ui/src/transport/sse-client.ts] |

**Key insight:** Phase 22 is primarily an update-locality and publication-cadence problem, not a missing-parser, missing-transport, or missing-rendering-library problem. [VERIFIED: codebase analysis]

## Common Pitfalls

### Pitfall 1: Fixing the wrong bottleneck first
**What goes wrong:** Work starts in `TailReader` chunk sizes or watcher settings while `AppState` still performs whole-history patch scans and the UI still hides chunks until completion. [VERIFIED: packages/host-node/src/tail-reader.ts, packages/server/src/app-state.ts, packages/ui/src/transport/sse-client.ts]  
**Why it happens:** Initial load feels file-I/O-shaped, but the confirmed code hotspots are derived metadata rediscovery and browser publication strategy. [VERIFIED: codebase analysis]  
**How to avoid:** Benchmark server ingest/projection, SSE transport, and browser hydrate/render separately before changing byte-read mechanics. [CITED: https://nodejs.org/api/perf_hooks.html]  
**Warning signs:** Better read chunk throughput does not materially improve time-to-first-visible-row or live burst responsiveness. [VERIFIED: diagnostic consequence of current architecture]

### Pitfall 2: Progressive rows break persistence and snapshot lifecycle assumptions
**What goes wrong:** Existing persistence hydration detects the current “snapshot finished” transition via rows going from `0` to `N`; progressive rows can make that happen before loading is actually complete. [VERIFIED: packages/ui/src/persistence/persist-effect.ts via grep context in workspace]  
**Why it happens:** Earlier phases intentionally used one baseline store commit at `snapshot-end`. [VERIFIED: packages/ui/src/transport/sse-client.ts, packages/ui/src/transport/sse-client.test.ts]  
**How to avoid:** Add an explicit baseline load lifecycle state and migrate persistence hydration/tests to the lifecycle marker, not `rows.length > 0`. [VERIFIED: codebase analysis]  
**Warning signs:** Stored filters, grouping, or selection restore too early and then behave inconsistently as more rows load. [VERIFIED: packages/ui/src/persistence/persist-effect.ts behavior inferred from search/map output]

### Pitfall 3: Stable viewport and follow-latest fight each other
**What goes wrong:** Progressive snapshot chunks or live bursts keep calling bottom-scroll while a user is selecting/inspecting earlier rows, violating D-05. [VERIFIED: Phase 22 CONTEXT.md]  
**Why it happens:** Existing `TimelineList` auto-scrolls on item-count changes only when its local follow-tail ref is true; new load-state logic can accidentally bypass that boundary. [VERIFIED: packages/ui/src/components/timeline/TimelineList.tsx]  
**How to avoid:** Keep follow/stability policy in the browser list layer and gate drain-triggered scroll adjustments on existing follow-tail state. [VERIFIED: packages/ui/src/components/timeline/TimelineList.tsx]  
**Warning signs:** Clicking or keyboard-jumping to a row during baseline load snaps the user back to the bottom. [VERIFIED: expected regression mode derived from current scroll code]

### Pitfall 4: Backlog queues become hidden memory growth
**What goes wrong:** SSE live payloads or browser drain queues build invisibly during bursts, then create a larger stall when flushed. [VERIFIED: packages/server/src/sse-routes.ts queue and packages/ui/src/state/store.ts pending buffer]  
**Why it happens:** Current queueing exists but backlog visibility is only UI-pause-oriented; D-08 requires making temporary behind-state visible even when batching is performance-driven. [VERIFIED: packages/server/src/sse-routes.ts, packages/ui/src/state/store.ts] [VERIFIED: Phase 22 CONTEXT.md]  
**How to avoid:** Track queue depth or buffered row count, publish a compact backlog cue, and benchmark flush latency under append bursts. [VERIFIED: design derived from D-08 and current queues]  
**Warning signs:** The viewer appears frozen despite stream connection remaining healthy. [VERIFIED: diagnostic consequence of unbounded deferred work]

### Pitfall 5: Progress percentages lie
**What goes wrong:** The UI displays a precise-looking percentage that is only row-count-based or becomes invalid when the file grows during initial loading. [VERIFIED: Phase 22 CONTEXT.md]  
**Why it happens:** Existing snapshot start exposes total rows at snapshot time, while host byte progress and live file growth are separate concerns. [VERIFIED: packages/server/src/sse-routes.ts, packages/host-node/src/tail-reader.ts]  
**How to avoid:** Prefer byte progress against a captured baseline size when available; otherwise show indeterminate loading with loaded row/byte counters and avoid a percentage. [VERIFIED: design derived from existing `sizeBytes` and D-03]

## Code Examples

Verified patterns and planner-level implementation sketches:

### Server measurement around ingest/projection phases
```typescript
import { monitorEventLoopDelay, performance } from "node:perf_hooks";

const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();
performance.mark("phase22-ingest-start");
// Drive fixture ingest or burst append scenario.
performance.mark("phase22-ingest-end");
performance.measure("phase22-ingest", "phase22-ingest-start", "phase22-ingest-end");
loopDelay.disable();
```
[CITED: https://nodejs.org/api/perf_hooks.html]

### Existing range-read posture worth preserving
```typescript
const stream = createReadStream(path, {
  start,
  end: end - 1,
  highWaterMark: CHUNK_BYTES,
});
```
[VERIFIED: packages/host-node/src/tail-reader.ts] [CITED: https://nodejs.org/api/fs.html#fscreatereadstreampath-options]

### Browser non-urgent publication boundary
```typescript
import { startTransition } from "react";

requestAnimationFrame(() => {
  const batch = takeVisibleBatch();
  startTransition(() => {
    useAppStore.getState().appendRows(batch.rows, batch.from);
  });
});
```
[CITED: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame] [CITED: https://react.dev/reference/react/startTransition]

Use this only after verifying it helps this store/subscriber shape; React Transitions do not replace bounded batching, and they must not control search text input state. [CITED: https://react.dev/reference/react/startTransition] [CITED: https://react.dev/reference/react/useTransition]

## State of the Art

| Old Approach | Current Recommended Approach | When Changed | Impact |
|--------------|------------------------------|--------------|--------|
| Hide all baseline rows until `snapshot-end` | Stream rows progressively with explicit loading/progress lifecycle | Phase 22 requirement, not implemented yet | Satisfies D-01 and D-04 while requiring lifecycle/persistence tests to change. [VERIFIED: Phase 22 CONTEXT.md, packages/ui/src/transport/sse-client.ts] |
| Discover historical patch candidates by scanning all earlier projected rows | Propagate exact changed indexes from correlation/flush mutations | Phase 22 recommendation from code audit | Removes the most concerning append-time algorithmic growth in current server code. [VERIFIED: packages/core/src/correlator.ts, packages/server/src/app-state.ts] |
| Treat visible lag only as manual live-pause buffer | Surface compact performance backlog state during batching | Phase 22 requirement, not implemented yet | Aligns burst buffering with D-08 instead of hiding it. [VERIFIED: Phase 22 CONTEXT.md, packages/ui/src/state/store.ts] |
| Single large browser setRows baseline commit | Bounded progressive commits plus row-array/session-count copy reduction | Phase 22 recommendation from code audit | Reduces huge one-shot commits and repeated whole-store work during later live bursts. [VERIFIED: packages/ui/src/transport/sse-client.ts, packages/ui/src/state/store.ts] |

**Deprecated/outdated for this phase:**
- “Single baseline store commit avoids transient flicker” remains true as historical rationale, but it is no longer compatible with Phase 22 D-01/D-04 and should be replaced with explicit progressive-load lifecycle tests. [VERIFIED: packages/ui/src/transport/sse-client.ts, packages/ui/src/transport/sse-client.test.ts, Phase 22 CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | No `[ASSUMED]` claims used. Recommendations are grounded in the phase context, current code, npm registry queries, or cited official documentation. | Whole document | — |

## Open Questions (RESOLVED)

1. **RESOLVED: Search and filters remain usable over already-loaded rows during partial baseline loading.**  
  Phase 22 keeps the existing client-facing search/filter surfaces available while progressive rows arrive, and the persistent loading/progress status makes the partial-data context explicit. It does not add a separate server-search availability protocol or hide the existing controls until `snapshot-end`. This is the planner discretion choice implemented by Plan 22-05 Task 3 and keeps D-01, D-02, and D-04 aligned: useful rows stay inspectable without pretending the baseline is complete. [VERIFIED: Phase 22 CONTEXT.md, Plan 22-05]

2. **RESOLVED: Percentage progress uses captured initial baseline bytes only, with later growth expressed as backlog.**  
  `TailReader`'s captured `sizeAtStart` is the denominator carried through the host/server lifecycle in Plan 22-03. The UI renders `percent` only when that denominator exists and remains explicitly baseline-scoped; when it is unavailable, progress stays indeterminate/count-based. Bytes or rows appended after baseline start are represented through separate live stream backlog state and cueing in Plans 22-03 through 22-05, satisfying D-03 and D-08 without fabricating a percentage. [VERIFIED: packages/host-node/src/tail-reader.ts, Phase 22 CONTEXT.md, Plans 22-03 through 22-05]

3. **RESOLVED: Phase 22 changes browser publication cadence and required lifecycle state, not the store's entire representation model.**  
  Plans 22-04 and 22-05 commit to bounded scheduled stream drains, progressive snapshot commit actions, explicit load/backlog state, and the UI composition needed to expose those states. They preserve existing manual pause buffers and existing row/search/filter surfaces rather than expanding into a broader store rewrite. Plan 22-06 handles the two lifecycle regressions introduced by progressive visibility: persistence hydration and viewport ownership. This scope matches the measured bottlenecks and avoids introducing unplanned state architecture work. [VERIFIED: packages/ui/src/state/store.ts, Phase 22 CONTEXT.md, Plans 22-04 through 22-06]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Server/CLI/perf diagnostics | Yes | 22.22.1 | Repo requires Node >=22, so execution should stop on older runtimes. [VERIFIED: terminal, package.json] |
| pnpm | Existing workspace scripts | Yes | 9.15.0 | Use repository package manager declaration. [VERIFIED: terminal, package.json] |
| npm CLI | Registry version verification only | Yes | 10.9.4 | Not part of implementation runtime. [VERIFIED: terminal] |
| Existing test stack | Validation architecture | Yes | Vitest configured; Playwright config present | Use existing tests; add focused Phase 22 perf/behavior coverage. [VERIFIED: package.json, vitest.config.ts, playwright.config.ts] |

**Missing dependencies with no fallback:**
- None found for research or expected implementation path. [VERIFIED: terminal/package audit]

**Missing dependencies with fallback:**
- None identified. [VERIFIED: terminal/package audit]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 declared at root; Playwright 1.59.1 declared for e2e. [VERIFIED: package.json] |
| Config file | `vitest.config.ts`, `packages/ui/vitest.config.ts`, `playwright.config.ts`. [VERIFIED: workspace files] |
| Quick run command | `pnpm exec vitest run packages/server/src/app-state.test.ts packages/ui/src/transport/sse-client.test.ts packages/ui/src/state/store.test.ts` [VERIFIED: package script/tooling layout] |
| Full suite command | `pnpm test` plus targeted `pnpm e2e` when browser lifecycle behavior is added. [VERIFIED: package.json] |

### Phase Behaviors -> Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Server append/pair patch generation avoids historical full scans and keeps patch semantics | unit/perf | `pnpm exec vitest run packages/server/src/app-state.test.ts packages/core/src/correlator.test.ts` | Partial; Phase 22 benchmark/assertion gap. [VERIFIED: file inventory] |
| Progressive snapshot chunks become visible before `snapshot-end` and rows remain inspectable | unit/integration | `pnpm exec vitest run packages/ui/src/transport/sse-client.test.ts test/sse-integration.test.ts` | Existing files assert old hidden-baseline behavior and must be updated. [VERIFIED: packages/ui/src/transport/sse-client.test.ts, test/sse-integration.test.ts] |
| Loading progress/backlog frames are trustworthy and reset correctly | unit/integration | `pnpm exec vitest run packages/server/src/sse-routes.test.ts test/sse-integration.test.ts` | Sse route coverage exists, Phase 22 progress/backlog cases do not. [VERIFIED: file inventory and grep] |
| Store append/patch/flush work remains bounded during bursts | unit/perf | `pnpm exec vitest run packages/ui/src/state/store.test.ts packages/ui/src/state/selectors.perf.test.ts` | Existing store/perf tests exist; burst mutation perf coverage is missing. [VERIFIED: file inventory, packages/ui/src/state/selectors.perf.test.ts] |
| Viewport stays stable off-tail and smooth when tail-follow is active | component/e2e | `pnpm exec vitest run packages/ui/src/components/timeline/TimelineRegion.test.ts packages/ui/src/components/timeline/TimelineList.virt.test.ts` | Existing follow/pill/virtualization coverage exists; progressive-load viewport cases are missing. [VERIFIED: file inventory, packages/ui/src/components/timeline/TimelineList.tsx] |

### Sampling Rate
- **Per task commit:** Run the directly touched package tests plus any newly added Phase 22 focused perf test. [VERIFIED: recommended test architecture from existing granular suites]
- **Per wave merge:** Run `pnpm test`. [VERIFIED: package.json]
- **Phase gate:** Run `pnpm test`; run fixture-based e2e only if Phase 22 changes browser-visible loading/backlog behavior beyond unit coverage. [VERIFIED: package.json, .github/copilot-instructions.md screenshot/fixture rule]

### Wave 0 Gaps
- [ ] Add a server ingest/projection benchmark fixture or generated test that distinguishes O(n) changed-index behavior from the current O(n^2)-shaped patch rediscovery risk. [VERIFIED: packages/server/src/app-state.ts]
- [ ] Revise `sse-client.test.ts` from “rows MUST NOT appear mid-snapshot” to the new progressive baseline contract. [VERIFIED: packages/ui/src/transport/sse-client.test.ts, Phase 22 CONTEXT.md]
- [ ] Add progress/backlog frame contract coverage in SSE route/integration tests. [VERIFIED: packages/server/src/sse-routes.ts, test/sse-integration.test.ts]
- [ ] Add browser/store burst-drain tests that cover pending counts, stable viewport/follow-tail behavior, and delayed patches. [VERIFIED: packages/ui/src/state/store.ts, packages/ui/src/components/timeline/TimelineList.tsx]

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No new auth surface | Keep current local server/session posture unchanged. [VERIFIED: phase scope and current architecture] |
| V3 Session Management | Yes, existing active-log stream lifecycle | Preserve current session reset/log-reset/bye behavior while extending progress frames. [VERIFIED: packages/server/src/sse-routes.ts, packages/ui/src/transport/sse-client.ts] |
| V4 Access Control | No new access-control surface | Do not broaden current local-only route exposure as part of performance work. [VERIFIED: .github/copilot-instructions.md] |
| V5 Input Validation | Yes | Continue tolerant JSONL parse/normalize handling and typed SSE payload parsing; reject or ignore malformed frames as current client/server patterns do. [VERIFIED: packages/parser/src/jsonl.ts, packages/server/src/app-state.ts, packages/ui/src/transport/sse-client.ts] |
| V6 Cryptography | No | Phase 22 does not introduce crypto; never invent a crypto scheme for progress or local stream IDs. [VERIFIED: phase scope] |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unbounded backlog memory under attacker-controlled or accidental burst input | Denial of Service | Batch with visible backlog accounting, bound diagnostics/perf collectors, and avoid hidden unbounded copies. [VERIFIED: current queues/buffers in server and UI; D-06/D-08] |
| Malformed or partial JSONL lines during high-throughput tail | Denial of Service / Tampering | Keep tolerant splitter/parser semantics and existing parse-error event flow; do not assume every chunk ends on a line boundary. [VERIFIED: packages/parser/src/jsonl.ts, packages/server/src/app-state.ts] |
| Path/log disclosure through progress UI or diagnostics | Information Disclosure | Reuse basename-only metadata and local-only posture; do not emit raw file paths in new progress/backlog frames. [VERIFIED: packages/server/src/app-state.ts, .github/copilot-instructions.md] |
| Real sensitive session data captured in verification screenshots | Information Disclosure | Use committed fixture JSONL only for screenshots/e2e evidence. [VERIFIED: .github/copilot-instructions.md] |

## Sources

### Primary (HIGH confidence)
- Current source review: `packages/server/src/app-state.ts`, `packages/core/src/correlator.ts`, `packages/core/src/event-store.ts`, `packages/server/src/sse-routes.ts`, `packages/host-node/src/tail-reader.ts`, `packages/ui/src/transport/sse-client.ts`, `packages/ui/src/state/store.ts`, and timeline/persistence tests. [VERIFIED: read_file/grep_search]
- Phase scope: `.planning/phases/22-improve-large-log-loading-and-high-throughput-live-tail-perf/22-CONTEXT.md`. [VERIFIED: read_file]
- Project constraints: `.github/copilot-instructions.md`, `.planning/PROJECT.md`, `.planning/config.json`. [VERIFIED: read_file]
- Package registry version checks for `hono`, `@hono/node-server`, `chokidar`, `@tanstack/react-virtual`, `zustand`, and `react`, run 2026-05-16. [VERIFIED: npm registry]
- Node file-system docs: https://nodejs.org/api/fs.html#fscreatereadstreampath-options and https://nodejs.org/api/fs.html#fsreadfilepath-options. [CITED: official Node docs fetched 2026-05-16]
- Node performance docs: https://nodejs.org/api/perf_hooks.html. [CITED: official Node docs fetched 2026-05-16]
- React Transition docs: https://react.dev/reference/react/startTransition and https://react.dev/reference/react/useTransition. [CITED: official React docs fetched 2026-05-16]

### Secondary (MEDIUM confidence)
- MDN `requestAnimationFrame()` reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame. [CITED: MDN reference fetched 2026-05-16]

### Tertiary (LOW confidence)
- None. [VERIFIED: research log]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - implementation should stay on the current repo stack, and versions were checked from manifests/registry. [VERIFIED: package manifests, npm registry]
- Architecture: HIGH - the key bottlenecks and integration points are visible directly in current server/UI code. [VERIFIED: source review]
- Pitfalls: HIGH - most pitfalls are existing code-contract mismatches created by progressive loading or explicit current loops/queues. [VERIFIED: source review plus Phase 22 CONTEXT.md]

**Research date:** 2026-05-16  
**Valid until:** 2026-06-15 for the codebase conclusions; re-check npm latest versions if dependency work is added later. [VERIFIED: research convention applied to current registry checks]
