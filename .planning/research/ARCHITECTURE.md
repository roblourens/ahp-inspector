# Architecture Research: v1.1 Reducer-Backed State Snapshots

**Researched:** 2026-05-08

## Summary

The correct architecture is server-side replay as another derived index next to `EventStore`, `Correlator`, row projection, and `SearchIndex`.

The parser should remain tolerant JSONL normalization. The UI should request selected-index state lazily through HTTP, not receive full state in SSE timeline frames. `AppState` should own replay lifecycle so log switch, live append, pause/resume, and rotation reset stay coherent with existing indexes.

## Replay Sources

Reducer replay must treat protocol messages differently:

1. `initialize`, `subscribe`, and `reconnect` response snapshots replace known resource state at that event.
2. Server `method: "action"` notifications apply one `ActionEnvelope`.
3. `reconnect` replay responses apply every embedded `ActionEnvelope` in order.
4. Client `dispatchAction` requests/notifications are intent only and must not mutate canonical reconstructed state until accepted/echoed by server action envelopes.

## Determinism

Upstream reducers call `Date.now()` for derived timestamps. Replay must wrap reducer calls in a synchronous replay clock that returns the source event timestamp so repeated reads of the same log produce the same state.

## Proposed Data Flow

```text
JSONL line
  -> parseLine / normalize
  -> EventStore append
  -> Correlator/SearchIndex/Timeline rows
  -> StateReplayIndex append
  -> lazy /api/state-at?idx=N endpoint
  -> UI state inspector / pinned comparison
```

## Server API Shape

Add endpoints similar to detail/search:

- `GET /api/state-at?idx=N&logKey=...`
- Optional `resource` query for a specific root/session/terminal resource.

Response should include:

- `idx`, `logKey`, source event metadata.
- `resources`: available reconstructed resource IDs and kinds.
- `selectedResource`.
- `state`: reconstructed state or null.
- `confidence`: `complete`, `partial`, or `unknown`.
- `diagnostics`: ignored events, missing snapshot, unknown action, gap notes.
- `changedPaths` when cheaply available.

## Build Order

1. Sync canonical protocol files and add protocol package.
2. Build pure replay engine with fixture tests.
3. Integrate replay index into `AppState` and HTTP routes.
4. Add themed UI inspector and pinned comparison flow.
5. Add integration/E2E coverage and large-log performance checks.
