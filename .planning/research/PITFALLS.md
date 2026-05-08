# Domain Pitfalls: v1.1 Reducer-Backed State Snapshots

**Researched:** 2026-05-08

## Key Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Incomplete logs produce misleading state | Attach confidence metadata and visible diagnostics to every snapshot |
| Missing initial subscribe/reconnect snapshot | Mark resource state as `unknown` until a baseline snapshot appears |
| Client dispatch intent mutates state incorrectly | Only server action envelopes and response snapshots change canonical state |
| Wrong reducer for resource scope | Route root/session/terminal actions by action type and resource URI |
| `Date.now()` in reducers breaks determinism | Wrap reducer application with event-time replay clock |
| Unknown/new action types | Use upstream `softAssertNever` behavior, collect diagnostics, and continue |
| Large-log replay is slow | Maintain checkpoints/cache in server index and query lazily by selected idx |
| Log switch/rotation leaks stale state | Reset replay index with EventStore/SearchIndex/correlation on log reset |
| Direction inference errors | Prefer explicit JSONL direction when present; surface confidence warnings when inferred |
| Sensitive log content in state | Preserve local-only posture, no telemetry, no external renderers |

## UX Guardrails

- Never label partial reconstruction as "truth" without qualification.
- Show the event/range used to compute state.
- Distinguish "no state known yet" from an empty valid state.
- Make ignored client intents visible so users understand why a row did not mutate state.

## Phase Placement

- Protocol sync and reducer parity risks belong in the foundation phase.
- Snapshot/action interpretation and determinism belong in the replay engine phase.
- Confidence, diagnostics, and stale-cache prevention belong in server integration.
- User trust and state comparison clarity belong in the UI polish phase.
