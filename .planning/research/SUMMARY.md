# Research Summary: v1.1 Reducer-Backed State Snapshots

**Researched:** 2026-05-08

## Conclusion

The user's proposed model is correct and useful: because AHP state changes through pure reducers over snapshots and action envelopes, AHP Log Viewer can reconstruct "state at this point" from a JSONL traffic log and make protocol behavior much easier to understand.

The important caveat is trust. The viewer must communicate whether state is complete, partial, or unknown based on whether the log contains a valid baseline snapshot and contiguous server action history.

## Recommended Approach

1. Copy canonical AHP TypeScript protocol files into a generated private package, following the VS Code sync-script pattern.
2. Build deterministic server-side replay over normalized events.
3. Handle snapshots, server action envelopes, reconnect replay, and client dispatch intent separately.
4. Add a lazy state-at-index API with confidence and diagnostics.
5. Add a themed state inspector plus pinned before/after comparison.

## Requirements Drivers

- Accurate reducer parity with `../agent-host-protocol`.
- Deterministic replay tied to event timestamps.
- Local-only execution and no raw-log exfiltration.
- Fast selected-index lookup on large logs.
- Clear UX around partial reconstruction.
