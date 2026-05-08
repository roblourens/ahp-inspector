# Phase 08: Server state-at-index API and cache integration - Research

**Researched:** 2026-05-08  
**Domain:** Server/AppState replay integration, route design, replay cache lifecycle, synthetic integration testing  
**Confidence:** High

## Scope

Phase 8 is server/AppState/API/cache integration only. It should not add UI components, screenshots, Playwright browser UAT, pinned comparison, or user guide changes. Phase 9 owns the inspector UI; Phase 10 owns comparison and browser/docs verification.

Phase 8 requirements:

| ID | Requirement | Research conclusion |
|---|---|---|
| CONF-01 | Every reconstructed state result reports confidence as complete, partial, or unknown. | Pass through core `ReplayResourceState.confidence`; synthesize `unknown` when no selected/available resource exists. |
| CONF-02 | State results explain missing baselines, sequence gaps, unknown actions, ignored client intent, and parse errors. | Expose core replay diagnostics unchanged at global and selected-resource levels. |
| CONF-03 | Log switch, live tail, pause/resume, and rotation reset replay caches consistently. | Keep replay cache per `AppState`, preserve exact-index cache across append, clear on rotation reset/dispose, and treat UI pause as client-only buffering. |
| VERIFY-02 | Integration tests cover synthetic JSONL with subscribe/reconnect snapshots and action envelopes. | Add server route/AppState tests using synthetic lines and existing fake host patterns; avoid real log fixtures. |

## Existing Architecture

- `AppState` owns ingestion and derived indexes. It constructs `EventStore`, `Correlator`, `SearchIndex`, rows, listeners, and metadata in `packages/server/src/app-state.ts`.
- `EventStore` stores canonical `AhpEvent`s and exposes `events`, `append`, `subscribe`, and `reset` from `packages/core/src/event-store.ts`.
- Rotation/reset is handled inside `AppState` by clearing store, correlator, search index, rows, and listeners in a single reset block.
- `LogSessionManager` replaces the active `AppState` on log switch and disposes the old instance.
- HTTP routes are thin Hono adapters registered from `packages/server/src/log-server.ts`; existing examples are `detail-routes.ts`, `search-routes.ts`, and `session-routes.ts`.
- SSE payloads currently contain only row/meta/patch/control frames. State must stay behind a lazy endpoint so selected-index fetches do not inflate timeline payloads.
- Phase 7 already exposes the pure `replayToIndex(events, targetIndex)` engine from `@ahp-viewer/core`; Phase 8 should not duplicate reducer logic.

## Recommended Design

Add a server-local `StateReplayIndex` beside existing server projections:

```ts
class StateReplayIndex {
  constructor(store: EventStore, maxEntries = 25);
  reset(): void;
  stateAtIndex(targetIndex: number): { result: ReplayResult; cache: StateReplayCacheInfo };
}
```

Recommended rules:

- Cache exact `targetIndex` replay results with a bounded LRU of 25 entries.
- Do not cache invalid or out-of-range requests.
- Keep cached historical indexes across live append, because `EventStore` is append-only between resets.
- Clear cache on rotation reset and dispose.
- Create a new cache per `AppState`, so log switches naturally isolate results.

Extend `AppState` with a `stateAtIndex(targetIndex)` method rather than letting routes reach into private store internals. This keeps routes transport-only and preserves the current architecture where `AppState` is the single server state surface.

Add `/api/state-at` as a lazy endpoint. Query parameters:

| Parameter | Required | Validation | Error |
|---|---:|---|---|
| `idx` | yes | exact base-10 integer string, `>= 0` | `400 { code: "bad-request" }` |
| `logKey` | no | if present, must equal active log key | `409 { code: "log-mismatch" }` |
| `resourceKind` | no | one of `root`, `session`, `terminal`; must be paired with `resourceUri` | `400 { code: "bad-request" }` |
| `resourceUri` | no | non-empty string; must be paired with `resourceKind` | `400 { code: "bad-request" }` |

Out-of-range `idx >= totalEvents` should return `404 { code: "not-found", totalEvents }`, matching `/api/log/event/:idx` route conventions.

Response shape should be metadata-first:

```ts
type StateAtResponse =
  | {
      logKey: string;
      targetIndex: number;
      totalEvents: number;
      confidence: "complete" | "partial" | "unknown";
      diagnostics: ReplayDiagnostic[];
      resources: Array<{
        kind: "root" | "session" | "terminal" | "unknown";
        uri: string;
        confidence: "complete" | "partial" | "unknown";
        baselineEventIdx: number;
        lastAppliedEventIdx: number;
        baselineFromSeq: number | null;
        lastServerSeq: number | null;
        diagnosticCount: number;
      }>;
      selectedResource: null | {
        kind: "root" | "session" | "terminal" | "unknown";
        uri: string;
        confidence: "complete" | "partial" | "unknown";
        baselineEventIdx: number;
        lastAppliedEventIdx: number;
        baselineFromSeq: number | null;
        lastServerSeq: number | null;
        diagnostics: ReplayDiagnostic[];
        state: unknown;
      };
      intents: ReplayClientIntent[];
      cache: { hit: boolean; size: number; maxEntries: number };
    }
  | { code: "no-active-log"; message: string }
  | { code: "bad-request"; message: string }
  | { code: "not-found"; message: string; totalEvents?: number }
  | { code: "log-mismatch"; message: string };
```

Default route behavior should return resource metadata only. Include full `state` only when both `resourceKind` and `resourceUri` are provided. This avoids returning every session/terminal state by default and keeps Phase 9 free to request one selected resource.

Confidence aggregation:

1. If a selected resource exists, top-level `confidence` equals selected resource confidence.
2. If no selected resource and available resources exist, top-level `confidence` is `partial` if any resource is partial, otherwise `complete`.
3. If no resources are available, top-level `confidence` is `unknown`.
4. Top-level diagnostics are always included.

## Plan Breakdown

### 08-01: StateReplayIndex lifecycle and AppState method

Create `packages/server/src/state-replay-index.ts`, extend `AppState` and `createAppState` to own it, and add tests for exact-index cache hit/miss, bounded LRU behavior, append stability, and reset clearing.

Likely files:

- `packages/server/src/app-state.ts`
- `packages/server/src/state-replay-index.ts`
- `packages/server/src/app-state.test.ts`

### 08-02: `/api/state-at` route

Create `packages/server/src/state-routes.ts`, mount it in `log-server.ts`, and add route tests for parameter validation, no-active-log, logKey mismatch, metadata-only default, selected resource state, diagnostics, intents, confidence, and cache metadata.

Likely files:

- `packages/server/src/log-server.ts`
- `packages/server/src/state-routes.ts`
- `packages/server/src/state-routes.test.ts`
- route test mocks that implement `AppState.stateAtIndex`

### 08-03: Synthetic JSONL integration and lifecycle coverage

Add synthetic integration coverage for initialize/subscribe snapshots, server action envelopes, reconnect replay/snapshot behavior, diagnostics, log switch isolation, live append, rotation reset, and the pause/resume equivalent that server state-at uses current server store regardless of UI buffering.

Likely files:

- `packages/server/src/app-state.test.ts`
- `packages/server/src/state-routes.test.ts`
- optional `test/state-at-integration.test.ts`

## Validation Architecture

| Property | Value |
|---|---|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test -- packages/server/src/state-replay-index.test.ts packages/server/src/state-routes.test.ts packages/server/src/app-state.test.ts` |
| Full suite command | `pnpm test && pnpm typecheck && pnpm lint` |

Requirement-to-test map:

| Req ID | Behavior | Test Type | Automated Command |
|---|---|---|---|
| CONF-01 | State-at responses report complete/partial/unknown confidence. | unit + route | `pnpm test -- packages/server/src/state-routes.test.ts` |
| CONF-02 | Diagnostics for missing baseline, gaps, unknown actions, ignored intent, and parse errors are visible. | route + integration | `pnpm test -- packages/server/src/state-routes.test.ts packages/server/src/app-state.test.ts` |
| CONF-03 | Cache scopes and resets across log switch, append, pause/resume equivalent, and rotation. | AppState integration | `pnpm test -- packages/server/src/app-state.test.ts` |
| VERIFY-02 | Synthetic JSONL with subscribe/reconnect snapshots and action envelopes reconstructs through server API. | integration | `pnpm test -- packages/server/src/state-routes.test.ts packages/server/src/app-state.test.ts` |

Phase gate:

```bash
pnpm test -- packages/server/src/state-replay-index.test.ts packages/server/src/state-routes.test.ts packages/server/src/app-state.test.ts
pnpm test
pnpm typecheck
pnpm lint
```

## Security and Performance Notes

- Do not expose filesystem paths. Return `logKey`, resource URIs, event indexes, and diagnostics only.
- Validate query strings strictly; do not accept partial numeric strings like `1abc`.
- Bound replay cache size to prevent random-index memory growth.
- Do not add state to `EventRow`, `SsePayload`, row projection, or SSE snapshot chunks.
- Do not catch and suppress replay diagnostics; malformed protocol input should remain visible as replay diagnostics.
- Do not treat UI pause/resume as server pause. Existing pause buffers visible rows on the client while server ingest continues.

## Open Questions Resolved by Planning Defaults

1. `/api/state-at` default is metadata-only; full `state` requires `resourceKind` and `resourceUri`.
2. Out-of-range state index uses `404`, matching existing event detail route behavior.
3. Cache metadata is included in response for validation and diagnostics; UI can ignore it.
4. Cache size defaults to 25 exact-index entries.

## Sources

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/07-deterministic-replay-engine/07-VERIFICATION.md`
- `packages/core/src/replay.ts`
- `packages/core/src/replay.test.ts`
- `packages/core/src/event-store.ts`
- `packages/server/src/app-state.ts`
- `packages/server/src/detail-routes.ts`
- `packages/server/src/search-routes.ts`
- `packages/server/src/session-manager.ts`
- `packages/server/src/log-server.ts`
- `test/sse-integration.test.ts`
