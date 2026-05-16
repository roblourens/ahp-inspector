---
phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf
reviewed: 2026-05-16T19:08:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - packages/core/src/correlator.ts
  - packages/core/src/correlator.test.ts
  - packages/shared/src/host-protocol.ts
  - packages/host-node/src/tail-reader.ts
  - packages/host-node/src/tail-reader.test.ts
  - packages/server/src/app-state.ts
  - packages/server/src/app-state.test.ts
  - packages/server/src/sse-routes.ts
  - packages/server/src/detail-routes.test.ts
  - packages/server/src/search-routes.test.ts
  - packages/server/src/state-routes.test.ts
  - test/sse-integration.test.ts
  - packages/ui/src/state/store.ts
  - packages/ui/src/state/store.test.ts
  - packages/ui/src/transport/sse-client.ts
  - packages/ui/src/transport/sse-client.test.ts
  - packages/ui/src/components/states/LoadingState.tsx
  - packages/ui/src/components/states/states.test.tsx
  - packages/ui/src/components/shell/StreamBacklogPill.tsx
  - packages/ui/src/components/shell/StreamBacklogPill.test.tsx
  - packages/ui/src/components/timeline/TimelineRegion.tsx
  - packages/ui/src/components/timeline/TimelineRegion.test.tsx
  - packages/ui/src/persistence/persist-effect.ts
  - packages/ui/src/persistence/persist-effect.test.ts
  - packages/ui/src/components/timeline/TimelineList.tsx
  - packages/ui/src/components/timeline/TimelineList.virt.test.tsx
findings:
  critical: 1
  warning: 4
  info: 0
  total: 5
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-05-16T19:08:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

The reviewed phase improves progressive loading and live streaming, but several failure-path behaviors are still incorrect. The most serious issue is in tail reading: stream errors advance the file cursor past bytes that were not safely delivered, so later change events silently skip log content. I also found three user-visible correctness gaps in ingestion/persistence and one SSE integration assertion that cannot catch the regression it claims to cover.

## Critical Issues

### CR-01: [BLOCKER] Read failures advance the tail cursor past undelivered bytes

**File:** `packages/host-node/src/tail-reader.ts:80-85, 144-145, 172-173`
**Issue:** `#readRange()` returns `false` when a file stream errors, but callers still assign `#lastOffset` to the requested end offset. This happens during the initial read, append reads, and rotation reads. If the stream emits only part of the requested range before failing, the emitted prefix has reached AppState while the unread suffix is skipped forever on the next chokidar change because the reader now believes the whole range was consumed. This is log data loss, and the new high-throughput path makes transient stream failures much more consequential.
**Fix:** Return the cursor actually delivered by `#readRange()` and advance `#lastOffset` only to that cursor. Emit initial-read completion only when the returned cursor reached the requested end.

```ts
type ReadRangeResult = { completed: boolean; nextOffset: number };

const result = await this.#readRange(start, nextSize, sink);
this.#lastOffset = result.nextOffset;
if (!result.completed) return;
```

## Warnings

### WR-01: [WARNING] Initial reads never flush a valid final JSONL record without a trailing newline

**File:** `packages/server/src/app-state.ts:305-310, 317`
**Issue:** `LineSplitter.push()` intentionally buffers a partial trailing line, and the parser exposes `flush()` specifically to emit the final buffered line at an input boundary. `onInitialReadComplete()` only publishes load progress; it never drains `splitter.flush()`. A file ending with a valid JSON object but no final newline therefore appears to be missing its last event after initial load. It only materializes if later bytes happen to arrive, which makes static log viewing incorrect.
**Fix:** Extract the per-line ingest body used by `onChunk` into a helper and invoke it for `splitter.flush()` when the initial read completes, updating the byte accounting through the same path.

```ts
onInitialReadComplete(info) {
  ingestLines(splitter.flush(), 0);
  initialReadLoadedBytes = info.loadedBytes;
  initialReadTotalBytes = info.totalBytes;
  emitLoadProgress("complete");
}
```

### WR-02: [WARNING] Byte offsets drift for mixed or chunk-split CRLF/LF input

**File:** `packages/server/src/app-state.ts:314, 338`
**Issue:** The offset calculation picks one `newlineSize` for the entire decoded chunk with `text.includes("\r\n")`. A chunk containing both `\r\n` and `\n` lines adds two bytes for every newline, and a CRLF split across adjacent chunks is treated as a one-byte newline. Every following event in that ingest stream receives the wrong `byteOffset`, which undermines detail/index metadata that is supposed to stay byte-accurate across large logs.
**Fix:** Preserve newline width per emitted line, or have the splitter return line text plus delimiter byte length. Then increment `byteOffset` with the delimiter for that exact line instead of a chunk-wide guess.

```ts
for (const { line, newlineBytes } of splitter.pushWithDelimiters(text)) {
  const byteLength = Buffer.byteLength(line, "utf8");
  ingestLine(line, byteOffset, byteLength);
  byteOffset += byteLength + newlineBytes;
}
```

### WR-03: [WARNING] Unmounting the persistence effect discards pending preference writes

**File:** `packages/ui/src/persistence/persist-effect.ts:173-176`
**Issue:** Preference changes are intentionally debounced, and log switches flush the pending debounce synchronously. The effect cleanup path only clears the timer. If the React tree unmounts or the page transitions within 250 ms of a filter/search/grouping change, that final per-log preference edit is thrown away even though the effect had already accepted it for persistence.
**Fix:** On cleanup, flush the pending key before clearing the timer/unsubscribing, using the same `flushSave()` path already used for log-key switches.

```ts
return () => {
  if (ref.debounceTimer && ref.pendingSaveLogKey) {
    flushSave(ref.pendingSaveLogKey);
  }
  unsub();
};
```

### WR-04: [WARNING] SSE integration test checks a nonexistent append field, so replay-state leaks can pass

**File:** `test/sse-integration.test.ts:362-363`
**Issue:** Append frames are shaped as `{ rows, from }`, but the final large-log assertion casts the payload to `{ row: unknown }` and verifies `appendPayload.row`. That value is `undefined`, so `expectNoReplayFieldsInRows([appendPayload.row])` only inspects an empty object produced by object-spreading `undefined`; it never inspects the actual streamed rows. A regression that embeds replay state in append rows will still pass this test.
**Fix:** Parse the real append frame shape and assert over `rows` directly.

```ts
const appendPayload = JSON.parse(append.data) as { rows: readonly unknown[]; from: number };
expectNoReplayFieldsInRows(appendPayload.rows);
```

---

_Reviewed: 2026-05-16T19:08:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
