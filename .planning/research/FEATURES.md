# Feature Landscape: v1.1 Reducer-Backed State Snapshots

**Researched:** 2026-05-08

## Summary

Reducer-backed state snapshots are a strong fit for AHP Log Viewer. AHP is explicitly built around immutable state plus pure reducers, and the log viewer already has the ordered JSON-RPC traffic needed to replay state changes.

The useful product framing is: "At this event, what would an AHP client believe the agent host state was?" This should be presented with confidence metadata because logs can start after a subscription, miss snapshots, or contain only client intent.

## Table Stakes

| Feature | Notes |
|---------|-------|
| State at selected event | Button/action from a timeline row or detail panel to compute state through that row |
| Root/session/terminal resource support | Use root, session, and terminal reducers according to action/resource scope |
| Pretty and raw state views | Reuse existing Pretty/Raw JSON detail presentation |
| Confidence label | Distinguish complete state, partial state, and unknown/missing baseline |
| State source explanation | Show which snapshot/action initialized or changed the displayed state |
| Recent/pinned state points | Let users keep more than one selected point for "before/after" reasoning |

## Differentiators

- Compact state summary cards for sessions, active turn, tool calls, pending input, config, terminals, and errors.
- Pair timeline events with state mutations so users can see both the raw event and state effect.
- Side-by-side comparison of two pinned state points, at minimum with raw/pretty diff metadata and changed top-level paths.
- Replay diagnostics for ignored events, unknown actions, missing baselines, and rejected action envelopes.

## Deferred

- Full semantic diff UI for every protocol field.
- Time-travel scrubber that continuously updates state while scrolling.
- Editing/replaying protocol traffic.
- Cross-log state comparison.
