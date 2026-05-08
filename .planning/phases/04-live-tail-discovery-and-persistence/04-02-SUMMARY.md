---
phase: 04-live-tail-discovery-and-persistence
plan: 02
subsystem: live-tail
tags: [tail-reader, ingest-04, rotation, watch-error, host-node, app-state]
requires: [04-00]
provides:
  - "TailReader.readInitial(sink: WatchSink): Promise<void> — non-throwing initial read, surfaces stat errors via onError(fatal=true)"
  - "TailReader.startWatch(sink: WatchSink): () => void — chokidar-backed watch with shrink/rename/error channels"
  - "WatchSink interface: onChunk(bytes, byteOffset), onReset({newSize, reason}), onError(err, fatal)"
  - "chunkSinkToWatchSink(fn) shim adapter for legacy single-arg ChunkSink callers"
  - "LineSplitter.reset() — drops partial-line buffer + BOM flag for post-rotation reuse"
  - "AppState emits SsePayload kind:'rotation' on host onReset and kind:'watch-error' on host onError"
affects:
  - "packages/host-node/src/tail-reader.ts (full rewrite of readInitial/startWatch on WatchSink)"
  - "packages/host-node/src/host-adapter.ts (watchLog accepts WatchSink|ChunkSink)"
  - "packages/server/src/app-state.ts (ingest closure now WatchSink object with onReset/onError emits)"
  - "packages/parser/src/jsonl.ts (LineSplitter.reset added)"
  - "packages/shared/src/host-protocol.ts (HostAdapter.watchLog union signature)"
  - "test/sse-integration.test.ts (fakeHost updated to accept both sink shapes)"
tech-stack:
  added: []
  patterns:
    - "WatchSink callback object replaces console.warn / silent error swallowing — every fs failure now produces a structured frame"
    - "Async dispose() awaits chokidar.close() — eliminates dangling-watcher leaks during AppState swap"
    - "Read coalescing (#readInFlight) preserved across the refactor; no concurrent reads on burst writes"
    - "Rotation reset is parser-side only (splitter.reset + byteOffset=0); store/rows untouched — UI clears on receiving rotation frame"
    - "seq counter intentionally NOT reset on rotation (T-04-02-04 accepted) — rows of rotated file retain monotonic seq, invisible to users"
key-files:
  created:
    - packages/host-node/src/tail-reader.test.ts
  modified:
    - packages/host-node/src/tail-reader.ts
    - packages/host-node/src/host-adapter.ts
    - packages/parser/src/jsonl.ts
    - packages/server/src/app-state.ts
    - packages/server/src/app-state.test.ts
    - packages/shared/src/host-protocol.ts
    - test/sse-integration.test.ts
decisions:
  - "Legacy single-arg ChunkSink kept compiling via chunkSinkToWatchSink shim. The HostAdapter.watchLog signature is a union of (function | object) so future host implementations can pick either — minimum surface change for callers."
  - "Rotation reset only mutates parser-side state (LineSplitter buffer, byteOffset). EventStore/rows are NOT cleared — the SsePayload `rotation` frame is the contract for UIs to drop/replace their row buffer (Phase 4 plan 04-05). This keeps detail-fetch caches valid for events that arrived before rotation."
  - "Watch errors map to two opaque codes: fatal → 'watch-fatal', non-fatal → 'read-error'. err.message is the only string forwarded; the UI maps codes to fixed copy in 04-05 so end-users never see raw OS strings."
  - "console.warn is fully removed from tail-reader.ts (was the only call site in the host-node package). Errors that previously logged silently now produce a watch-error frame."
metrics:
  tasks_completed: 3
  tests_added: 9   # 6 tail-reader + 3 app-state
  duration: ~10 min
  completed: 2026-04-08
---

# Phase 04 Plan 02: Tail Reader Hardening Summary

Hardens `TailReader` and the AppState ingest closure for the three live-tail edge cases that previously failed silently (file shrink/truncate, rename/replace via inode swap, and read/watch errors). Each surfaces as a structured `WatchSink` callback that AppState converts into the new `rotation` / `watch-error` SsePayload frames introduced in 04-00. The append/patch happy-path is byte-for-byte unchanged (D-09).

## What Shipped

- **Task 1 — TailReader rewrite (`packages/host-node/src/tail-reader.ts`).** `readInitial(sink)` and `startWatch(sink)` now consume a `WatchSink` object: `onChunk(bytes, byteOffset)` for growth, `onReset({newSize, reason})` for shrink/rename, and `onError(err, fatal)` for stat / read-stream / chokidar errors. Shrink (`nextSize < lastOffset`) emits `reason:"shrink"`; chokidar `unlink` followed by `add` emits `reason:"rename"`. `dispose()` is async and awaits `chokidar.close()`. The legacy single-arg `ChunkSink` is preserved via the new `chunkSinkToWatchSink` shim. `LineSplitter.reset()` (in `packages/parser/src/jsonl.ts`) drops the partial-line buffer and the BOM-consumed flag.
- **Task 2 — TailReader test suite (`packages/host-node/src/tail-reader.test.ts`).** Six tests against real chokidar in `tmpdir`: initial read into onChunk, append flowing through with correct byteOffset, truncate → onReset({reason:"shrink"}), unlink+add → onReset({reason:"rename"}) followed by re-read of the new content, stat-failure → onError(fatal=true), and dispose() rejecting subsequent startWatch.
- **Task 3 — Host adapter shim + AppState wiring.** `NodeHostAdapter.watchLog(handle, sinkOrChunk)` detects function vs object form and drives TailReader with a WatchSink in either case. `HostAdapter.watchLog` signature in `packages/shared/src/host-protocol.ts` widened to a union (no breaking change). `AppState` ingest closure is now a WatchSink whose `onReset` calls `splitter.reset()`, sets `byteOffset = 0`, and emits `{kind:"rotation", newSize, reason}`; `onError` emits `{kind:"watch-error", code: fatal ? "watch-fatal" : "read-error", message: err.message}`. Three new tests in `app-state.test.ts` cover rotation propagation, watch-error code mapping, and the partial-line drop after rotation. `test/sse-integration.test.ts` fakeHost was updated to accept the union shape (Rule 3 — blocking dependency).

## Verification

- `pnpm exec vitest run packages/host-node/src/tail-reader.test.ts` — 6/6 pass (2.5 s).
- `pnpm exec vitest run packages/server/src/app-state.test.ts` — 8/8 pass (5 original + 3 new, 22 ms).
- `pnpm test` — 34 files / 438 tests green (2.71 s).
- `pnpm typecheck` — clean across all 7 packages.
- `pnpm lint` — clean (178 files, no fixes).

## Acceptance Criteria

| Criterion | Result |
|---|---|
| `onReset({newSize, reason})` emitted from TailReader | ✓ (tests 3, 4) |
| `onError(err, fatal)` replaces console.warn (≥3 sites) | ✓ — initial stat, change-stat, read-stream, rotation-stat, chokidar error |
| `watcher.on("unlink"/"add")` rotation handling | ✓ |
| `async dispose(): Promise<void>` awaits close | ✓ (test 6) |
| No `console.warn` in tail-reader.ts | ✓ (only inside doc comment) |
| `LineSplitter.reset()` exists | ✓ |
| `splitter.reset()` called on rotation in AppState | ✓ (tested) |
| `chunkSinkToWatchSink` used in host-adapter | ✓ |
| 6 it() blocks in tail-reader.test.ts | ✓ |
| Workspace tests green | ✓ (438/438) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Updated `test/sse-integration.test.ts` fakeHost to accept WatchSink object.**
- **Found during:** Task 3 verification (`pnpm test`).
- **Issue:** The integration test's fake `HostAdapter.watchLog` stored `onChunk` as a bare function and called `sink(bytes)` from `push()`. After AppState started passing a WatchSink object, the call became `sink is not a function`.
- **Fix:** Mirrored the pattern used in `app-state.test.ts` — detect function vs object, wrap function form into a WatchSink, store as object, and call `sink.onChunk(bytes, offset)` from `push()`.
- **Files modified:** `test/sse-integration.test.ts`.
- **Commit:** 5eeb79b (folded into Task 3 commit).

**2. [Rule 3 — Blocking] `packages/shared/src/host-protocol.ts` updated alongside Task 1's tail-reader rewrite.**
- **Found during:** Task 1 verification (`pnpm -F @ahp-viewer/host-node typecheck`).
- **Issue:** Plan structures shared/host-protocol.ts changes as Task 3 work, but the new `WatchSink` parameter on `NodeHostAdapter.watchLog` could not satisfy the existing `HostAdapter.watchLog: (handle, onChunk) => Disposable` signature. Typecheck failed at the Task 1 boundary.
- **Fix:** Widened `HostAdapter.watchLog` signature to the union (function | WatchSink-shape) in the same change set as the host-adapter shim. Listed under Task 3 commit since it's the Task 3 plan deliverable; the typecheck issue is an artifact of plan task ordering.
- **Files modified:** `packages/shared/src/host-protocol.ts`.

### Plan-Authored Greps That Were Informational

A handful of the plan's `grep -E` acceptance regexes assume single-line emit calls (e.g. `kind: "watch-error", code: fatal`). The implementation follows the plan's own multi-line code block from the Step B example, so those greps return 0 even though the behavior is correct and unit-tested. No fix needed — tests cover the contract.

## Stub / Threat Notes

- **No stubs introduced.** All emitted SsePayload kinds (`rotation`, `watch-error`) are wired end-to-end from TailReader → AppState → subscribers. UI consumption lands in plan 04-05.
- **Threat register status (T-04-02-01..05):** all `mitigate` items implemented:
  - T-04-02-01 (DoS): read coalescing + LineSplitter overflow guard + rotation reset preserved.
  - T-04-02-02 (info disclosure): `watch-error.message` is `err.message` only; UI in 04-05 will map codes to fixed copy.
  - T-04-02-03 (tampering): `splitter.reset()` flushes partial-line buffer on rotation so a malformed line cannot smuggle across the boundary.
  - T-04-02-04 (repudiation): `seq` non-reset on rotation accepted; UI clears rows on rotation frame.
  - T-04-02-05 (DoS): `dispose()` awaits chokidar.close.

## Self-Check: PASSED

- `packages/host-node/src/tail-reader.ts` — FOUND
- `packages/host-node/src/tail-reader.test.ts` — FOUND
- `packages/host-node/src/host-adapter.ts` — FOUND (modified)
- `packages/parser/src/jsonl.ts` — FOUND (modified)
- `packages/server/src/app-state.ts` — FOUND (modified)
- `packages/server/src/app-state.test.ts` — FOUND (modified)
- `packages/shared/src/host-protocol.ts` — FOUND (modified)
- `test/sse-integration.test.ts` — FOUND (modified)
- Commit `05c94dd` — FOUND (Task 1: TailReader + LineSplitter.reset)
- Commit `ffc4a42` — FOUND (Task 2: TailReader tests)
- Commit `5eeb79b` — FOUND (Task 3: host-adapter + AppState)
