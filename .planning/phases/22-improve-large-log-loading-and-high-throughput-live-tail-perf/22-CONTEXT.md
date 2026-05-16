# Phase 22: Improve large-log loading and high-throughput live tail performance - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the experience of opening very large JSONL logs and watching logs that receive heavy append bursts. The phase should make initial loading become visibly useful sooner, preserve interaction responsiveness while ingest continues, and keep live tailing usable when incoming event volume spikes. It may change ingest, projection, transport, store-update, and loading-status behavior as needed, but it should preserve the viewer's local-only posture and existing log-inspection capabilities.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project constraints and prior performance posture
- `.planning/PROJECT.md` - Defines the local-first product posture, large/growing log responsiveness requirement, and prior decision to keep row payloads compact.
- `.planning/STATE.md` - Captures existing performance-related decisions: compact SSE rows, single baseline store commit, deferred filtering/search work, lazy state lookup, and existing live-tail affordances.

No external specs or ADRs were referenced during discussion. `.planning/REQUIREMENTS.md` was not present in the repository when this context was gathered, so research and planning should rely on the roadmap, project state, this context, and archived milestone requirements where relevant.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/host-node/src/tail-reader.ts`: Already reads files incrementally in 256 KiB chunks, tracks offsets, coalesces overlapping change reads, and signals rotation/errors.
- `packages/parser/src/jsonl.ts`: Streaming line splitting and tolerant per-line parsing already exist; initial-load changes should reuse these parser semantics.
- `packages/server/src/sse-routes.ts`: The stream protocol already has snapshot begin/chunk/end frames and yields between large snapshot chunks.
- `packages/ui/src/transport/sse-client.ts`: Current baseline rows buffer until `snapshot-end`, while live append and patch frames update the store separately.
- `packages/ui/src/state/store.ts`: The UI already supports live-paused pending buffers, pending counts, follow-latest state, and rotation/log-switch resets.

### Established Patterns
- Initial log consumption is incremental on the host/server side, but the UI intentionally delays baseline visibility until a single `setRows()` call at `snapshot-end`.
- Live append visibility and retroactive patch updates are distinct concepts in the transport contract; that separation can support rows-first behavior if research validates it.
- State replay and detail expansion are already lazy surfaces; Phase 22 should avoid inflating timeline row payloads to solve startup responsiveness.

### Integration Points
- `packages/host-node/src/host-adapter.ts` starts initial file reading asynchronously before entering watch mode.
- `packages/server/src/app-state.ts` ingests parsed lines into `EventStore`, builds projected rows, updates search state, emits append frames, and computes retroactive patch frames.
- `packages/server/src/sse-routes.ts` determines how snapshot progress is exposed to the browser stream.
- `packages/ui/src/transport/sse-client.ts` and `packages/ui/src/state/store.ts` determine when users see rows, connection state, append batches, backlog cues, and patches.

### Performance Surfaces Worth Researching
- `packages/server/src/app-state.ts` scans previously projected rows while handling each append to find pair/status patch updates. Research should test whether this becomes a dominant cost on tens-of-thousands-of-events initial loads and high-volume append bursts.
- The current browser snapshot client uses repeated array concatenation while buffering chunks, then performs one large store commit. Research should compare that cost against progressive rendering approaches.

</code_context>

<specifics>
## Specific Ideas

- The practical upper bound discussed is roughly the existing rotated-file limit: about 75 MB per log file.
- The user is open to providing a browser performance profile if research or fixture benchmarks do not isolate the bottleneck clearly enough.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within Phase 22 scope.

</deferred>

---

*Phase: 22-improve-large-log-loading-and-high-throughput-live-tail-perf*
*Context gathered: 2026-05-16*