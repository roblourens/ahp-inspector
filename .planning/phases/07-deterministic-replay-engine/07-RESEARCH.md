# Phase 7: Deterministic Replay Engine - Research

**Researched:** 2026-05-08  
**Domain:** AHP protocol reducer replay over canonical JSONL events  
**Confidence:** HIGH for codebase/protocol surfaces; MEDIUM for rejected-envelope semantics

## Summary

Phase 7 should implement a pure replay engine in `@ahp-inspector/core` that consumes canonical `AhpEvent[]` / `EventStore` data and reconstructs AHP resource state by applying generated `@ahp-inspector/protocol` reducers. `@ahp-inspector/core` is the right boundary because it already owns pure event storage, row projection, correlation-facing models, and domain logic, while server cache/API lifecycle is Phase 8 and UI is Phase 9.

Replay should process events from index `0..targetIndex` in log order, update replay resources keyed by target URI, and expose diagnostics for incomplete or suspicious inputs. Baselines come from `initialize.result.snapshots[]`, `subscribe.result.snapshot`, and reconnect snapshot results. Mutations come only from server action envelopes (`method: "action"` / `AhpEvent.kind === "action"`) and reconnect replay embedded `actions[]`. Client `dispatchAction` notifications are diagnostic intent only and must not mutate canonical reconstructed state.

Reducer determinism requires temporarily patching `Date.now()` to the current event timestamp (`AhpEvent.ts`) while applying one reducer action/envelope, then restoring it in `finally`. Generated session reducer branches call `Date.now()` for `summary.modifiedAt`, and Phase 6 parity tests already mock `Date.now()` to `9999` for deterministic fixture coverage.

## Existing Codebase Surfaces

- Add replay implementation in `packages/core/src/replay.ts` and tests in `packages/core/src/replay.test.ts`.
- Export replay symbols from `packages/core/src/index.ts`.
- Add `@ahp-inspector/protocol: "workspace:*"` to `packages/core/package.json`.
- Do not place replay in `packages/server`; server integration and caching belong to Phase 8.
- Do not add routes or UI; `/api/state-at` is Phase 8 and inspector UI is Phase 9.

Key existing surfaces:

- `packages/shared/src/event.ts` defines `AhpEvent` with `seq`, `ts`, `dir`, `kind`, `method`, `actionType`, `sessionId`, `toolCallId`, `serverSeq`, `raw`, and parse status.
- `packages/core/src/event-store.ts` stores full `AhpEvent` objects and provides `at(idx)`.
- `packages/server/src/app-state.ts` currently assigns `AhpEvent.ts = Date.now()` on ingest and exposes `eventAt(idx)`.
- `packages/parser/src/normalizer.ts` classifies s2c `method: "action"` as `kind: "action"` and c2s `dispatchAction` as `kind: "client-notification"`.
- `packages/protocol/src/reducers.ts` exports `rootReducer`, `sessionReducer`, `terminalReducer`, and `isClientDispatchable`.
- `packages/protocol/src/action-origin.generated.ts` exports `RootAction`, `SessionAction`, `TerminalAction`, plus client/server variants.

## Canonical Protocol Shapes

Snapshot-bearing messages:

- `initialize` result contains `serverSeq` and `snapshots: Snapshot[]`.
- `subscribe` result contains `snapshot: Snapshot`.
- `reconnect` result is either `{ type: "replay"; actions: ActionEnvelope[]; missing: URI[] }` or `{ type: "snapshot"; snapshots: Snapshot[] }`.
- `Snapshot` has `{ resource, state, fromSeq }`, where `state` is `RootState | SessionState | TerminalState`.
- `createSession`, `createTerminal`, `dispose*`, `listSessions`, and `fetchTurns` are not replay baselines for Phase 7.

Server action envelope:

```ts
interface ActionEnvelope {
  readonly action: StateAction;
  readonly serverSeq: number;
  readonly origin: ActionOrigin | undefined;
  readonly rejectionReason?: string;
}
```

Resource/reducer selection:

| Resource kind | Reducer | Detection | Target resource |
|---|---|---|---|
| root | `rootReducer` | `action.type` starts with `root/` | canonical root URI, normally `agenthost:/root` |
| session | `sessionReducer` | `action.type` starts with `session/` | `action.session` |
| terminal | `terminalReducer` | `action.type` starts with `terminal/` | `action.terminal` |

For snapshots, infer resource kind in this order:

1. `snapshot.resource === "agenthost:/root"` -> root.
2. State-shape guard: root has `agents`; session has `summary`, `lifecycle`, and `turns`; terminal has `content`, `claim`, and `title`.
3. If ambiguous, store an `unknown-snapshot` diagnostic and do not apply later reducer actions until a known baseline exists.

## Proposed Replay Model

Recommended exported API shape:

```ts
export type ReplayResourceKind = "root" | "session" | "terminal" | "unknown";
export type ReplayConfidence = "complete" | "partial" | "unknown";

export interface ReplayResourceKey {
  kind: ReplayResourceKind;
  uri: string;
}

export interface ReplayResourceState {
  key: ReplayResourceKey;
  state: RootState | SessionState | TerminalState | unknown;
  baselineEventIdx: number;
  lastAppliedEventIdx: number;
  baselineFromSeq: number | null;
  lastServerSeq: number | null;
  confidence: ReplayConfidence;
  diagnostics: ReplayDiagnostic[];
}

export interface ReplayDiagnostic {
  code:
    | "missing-baseline"
    | "parse-error"
    | "unknown-snapshot"
    | "unknown-action"
    | "malformed-envelope"
    | "server-seq-gap"
    | "server-seq-out-of-order"
    | "ignored-client-intent"
    | "reconnect-missing-resource"
    | "date-now-restore-failed";
  severity: "info" | "warning" | "error";
  eventIdx: number;
  message: string;
  details?: unknown;
}

export interface ReplayResult {
  targetIndex: number;
  resources: ReplayResourceState[];
  intents: ReplayClientIntent[];
  diagnostics: ReplayDiagnostic[];
}

export function replayToIndex(events: readonly AhpEvent[], targetIndex: number): ReplayResult;
```

Processing algorithm:

1. Iterate events `0..targetIndex` inclusive.
2. Convert `parse-error` events into diagnostics and continue.
3. Maintain replay-local JSON-RPC request context keyed with `correlationKeyForRequest` / `correlationKeyForResponse` so responses can be interpreted as `initialize`, `subscribe`, or `reconnect`.
4. On request events, record method/params.
5. On success responses:
   - `initialize` -> install `raw.result.snapshots[]`.
   - `subscribe` -> install `raw.result.snapshot`.
   - `reconnect` -> handle `raw.result.type`.
6. On `kind: "action"` events, read `event.raw.params` as `ActionEnvelope` and apply if valid.
7. On c2s `method: "dispatchAction"` events, record `ReplayClientIntent` only.
8. Reconnect replay response:
   - `type === "replay"` -> apply `actions[]` in array order at the reconnect response event timestamp.
   - `type === "snapshot"` -> install `snapshots[]` as fresh baselines.
   - record `missing[]` as diagnostics.
9. For each reducer call:
   - infer target resource.
   - require a matching baseline; do not synthesize empty state.
   - patch `Date.now()` to `event.ts`.
   - call the correct generated reducer and capture reducer log output as diagnostics.
   - restore `Date.now()` in `finally`.
10. Return resources, intents, and diagnostics; no routes or cache lifecycle yet.

Baseline/confidence policy:

- `complete`: resource has a snapshot baseline and all applied server sequences after baseline are contiguous/in-order.
- `partial`: resource has a baseline but replay saw parse errors, sequence gaps, unknown actions, malformed envelopes, reconnect missing resources, or out-of-order sequences.
- `unknown`: no baseline exists for the requested resource by target index.

Do not synthesize empty `RootState`, `SessionState`, or `TerminalState` as a baseline. Generated reducers assume meaningful existing state and some reducer branches no-op or read required fields.

## Determinism Strategy

Use a synchronous helper:

```ts
function withEventTime<T>(eventTs: number, fn: () => T): T {
  const original = Date.now;
  Date.now = () => eventTs;
  try {
    return fn();
  } finally {
    Date.now = original;
  }
}
```

Guidance:

- Patch only around a single reducer call or reconnect embedded action application.
- Never `await` while `Date.now` is patched.
- Always restore in `finally`.
- Add tests proving replaying the same log/index yields identical state/diagnostics.
- Add tests proving session `modifiedAt` equals event timestamp, not wall-clock time.
- For reconnect embedded actions, use the reconnect response event’s `ts` for all embedded reducer applications because embedded envelopes have `serverSeq` but no timestamp.

## Client Intent / Reconnect Strategy

`dispatchAction` is a client-to-server notification with params `{ clientSeq, action }`.

Replay behavior:

- Detect `event.dir === "c2s"` and `event.method === "dispatchAction"`.
- Extract `clientSeq` and `action.type`.
- Infer target resource the same way as server actions.
- Append `ReplayClientIntent` and an `ignored-client-intent` diagnostic.
- Do not call any reducer.
- If a later server action envelope has `origin.clientSeq` matching the intent, that server envelope mutates state as canonical accepted/replayed state.

Recommended intent shape:

```ts
export interface ReplayClientIntent {
  eventIdx: number;
  ts: number;
  clientSeq: number | null;
  actionType: string | null;
  resource: ReplayResourceKey | null;
  acceptedByServerSeq?: number;
  ignored: true;
}
```

Rejected envelopes:

- `ActionEnvelope` has optional `rejectionReason`.
- Recommended safe policy: if an envelope has `rejectionReason`, record a diagnostic and do not mutate state.
- This remains the one medium-confidence semantic assumption; plans should call it out and tests should make the chosen behavior explicit.

Reconnect replay:

- Pair reconnect response to its request.
- If `result.type === "replay"`, validate `Array.isArray(result.actions)` and apply each envelope in array order.
- If `result.type === "snapshot"`, install `result.snapshots[]`.
- Add diagnostics for malformed action entries without aborting.
- Add `reconnect-missing-resource` diagnostics for `missing[]`.

## Test Strategy

Add tests under `packages/core/src/replay.test.ts`. Root scripts already cover `pnpm test`, `pnpm typecheck`, and `pnpm lint`; focused command should be:

```bash
pnpm test -- packages/core/src/replay.test.ts
```

Test fixtures can be in-test synthetic `AhpEvent` arrays to avoid adding real logs.

Coverage to include:

1. Root snapshot + root actions:
   - `initialize` request/response with `snapshots: [{ resource: "agenthost:/root", state: RootState, fromSeq: 0 }]`.
   - Later `root/agentsChanged`, `root/activeSessionsChanged`, `root/terminalsChanged`.
2. Session snapshot + session actions:
   - `subscribe` response with canonical `SessionState`.
   - `session/ready`, `session/turnStarted`, `session/responsePart`, `session/delta`, `session/turnComplete`.
   - Assert `summary.modifiedAt` equals event timestamp for branches using `Date.now()`.
3. Terminal snapshot + terminal actions:
   - `TerminalState` snapshot plus terminal actions.
   - Assert terminal reducer selection.
4. Client intent ignored:
   - c2s `dispatchAction`.
   - State unchanged until later s2c server action with matching origin.
5. Reconnect replay:
   - `reconnect` response `{ type: "replay", actions: [...] }`.
   - Snapshot variant `{ type: "snapshot", snapshots: [...] }`.
6. Diagnostics:
   - Missing baseline.
   - Parse error event.
   - Unknown action / reducer log.
   - Malformed action envelope.
   - Server sequence gap, duplicate, and out-of-order.
   - Target index bounds.
   - `Date.now` restoration.

Existing v1.0 fixtures are useful for smoke guidance but are not canonical Phase 7 fixtures. Add new minimal synthetic events rather than depending on older shapes like `ahp:/sessions`.

## Risks and Plan Guidance

- **Response events lack method:** pair responses to prior requests using `correlationKeyForRequest` / `correlationKeyForResponse`; do not depend on `AhpEvent.method` for responses.
- **Missing snapshots:** do not apply reducers without a baseline; emit diagnostics and continue collecting later snapshots.
- **Malformed raw payloads:** treat `event.raw` as `unknown`; use type guards and never throw for malformed envelopes/snapshots.
- **Unknown actions:** generated reducers call `softAssertNever` and return unchanged state; pass a log callback, convert messages to diagnostics, and degrade confidence.
- **Date.now global mutation:** replay must be synchronous, patch with `try/finally`, and test restoration.
- **ServerSeq gaps/order:** apply log order, diagnose gaps/out-of-order, and skip duplicate/out-of-order envelopes to avoid double mutation.
- **Phase creep:** Phase 7 should produce a pure replay API and tests only. Server cache lifecycle/API is Phase 8 and UI is Phase 9.

## Suggested 3-Plan Breakdown

### 07-01: Model replay resources, snapshots, action-envelope application, and diagnostics

Scope:

- Add `packages/core/src/replay.ts`.
- Add replay result/resource/diagnostic/client-intent types.
- Add helper type guards and target inference.
- Add `@ahp-inspector/protocol` dependency to `packages/core/package.json`.
- Export replay symbols from `packages/core/src/index.ts`.
- Implement baseline install from `initialize` and `subscribe` responses using replay-local request pairing.
- Implement server `method: "action"` envelope application.
- Initial diagnostics: missing baseline, malformed envelope, parse error, unknown snapshot/action.

Acceptance:

- Root/session/terminal snapshots create resources.
- Root/session/terminal server envelopes select correct reducers.
- Missing baseline does not mutate and emits diagnostics.

### 07-02: Implement deterministic reducer execution with event-time `Date.now()` behavior

Scope:

- Add `withEventTime(event.ts, fn)` reducer wrapper.
- Ensure every action/reconnect embedded envelope uses event timestamp.
- Capture reducer `softAssertNever` logs as diagnostics.
- Add stability and timestamp tests.
- Add serverSeq diagnostics: gap, duplicate, out-of-order.

Acceptance:

- Replaying same log/index is stable.
- No wall-clock timestamp leaks into reducer-derived state.
- `Date.now` is restored after every replay path.

### 07-03: Handle reconnect action replay and ignored client intent

Scope:

- Complete response pairing for `initialize`, `subscribe`, and `reconnect`.
- Add reconnect replay handling for `replay`, `snapshot`, and `missing`.
- Add client intent capture for c2s `dispatchAction`.
- Optionally link intent to later server envelope by `origin.clientSeq`.
- Add canonical in-test fixtures for root/session/terminal/reconnect/client-intent cases.

Acceptance:

- REPLAY-01 through REPLAY-06 are covered by focused tests.
- Client intent is visible but non-mutating.
- Reconnect embedded actions apply in order.

## Open Questions (RESOLVED)

1. **RESOLVED: `ActionEnvelope.rejectionReason` prevents reducer mutation.**
   - Field exists on `ActionEnvelope`, but mutation semantics were not verified in generated docs.
   - Phase 7 plans choose the safe policy: rejected envelopes emit a diagnostic and do not mutate reconstructed state unless future upstream docs/tests prove otherwise.

2. **RESOLVED: canonical root URI is `agenthost:/root`; legacy/ambiguous snapshots are skipped.**
   - Generated comments cite `agenthost:/root`; old fixtures use older shapes.
   - Phase 7 plans use canonical synthetic fixtures and treat unknown or legacy ambiguous snapshot resources as diagnostics rather than canonical root baselines.

## Sources

- `.planning/ROADMAP.md` — Phase 7/8/9 scope and success criteria.
- `.planning/REQUIREMENTS.md` — REPLAY-01 through REPLAY-06.
- `.planning/phases/06-protocol-reducer-sync-foundation/*` — generated protocol readiness.
- `packages/shared/src/event.ts` — canonical `AhpEvent`.
- `packages/parser/src/normalizer.ts` — event classification and lifted action/serverSeq.
- `packages/core/src/event-store.ts` — event storage and raw access.
- `packages/server/src/app-state.ts` — ingest timestamps, `eventAt`, current gap logic.
- `packages/protocol/src/actions.ts` — `ActionEnvelope`, action types, target fields.
- `packages/protocol/src/action-origin.generated.ts` — root/session/terminal action unions.
- `packages/protocol/src/reducers.ts` — reducer APIs, `Date.now()` usage, unknown-action behavior.
- `packages/protocol/src/state.ts` — `RootState`, `SessionState`, `TerminalState`, `Snapshot`.
- `packages/protocol/src/commands.ts` — initialize/subscribe/reconnect/dispatchAction shapes.
- `packages/protocol/src/messages.ts` — command/notification maps.
- `packages/protocol/src/reducers.test.ts` — Date.now mock parity precedent.
- `test/fixtures/*.jsonl` — existing fixture coverage and gaps.

## RESEARCH COMPLETE
