---
phase: 10-pinned-comparison-and-milestone-verification
type: research
requirements: [COMPARE-01, COMPARE-02, COMPARE-03, VERIFY-03, VERIFY-04]
researched: 2026-05-08
confidence: high
---

# Phase 10: Pinned comparison and milestone verification - Research

## Summary

Phase 10 should extend the Phase 9 state inspector rather than add a separate page. Users already select an event, fetch state metadata, choose a root/session/terminal resource, and view confidence/diagnostics/copy actions in the detail rail. The lowest-risk comparison path is to let users pin selected reconstructed resource states from that inspector, then show a compact two-point comparison panel in the same detail context.

The comparison should be intentionally basic: compare only changed top-level paths/keys and preserve explicit confidence labels. A full semantic or nested diff is out of scope. The milestone verification plan should add Playwright coverage and a synthetic large-log/state replay fixture that validates the full reducer-backed flow without inflating SSE timeline payloads.

## Relevant Existing Surfaces

- `packages/ui/src/components/detail/StateInspectorPanel.tsx` owns state-at-this-point fetch, selected resource fetch, state tabs, confidence, diagnostics, and state copy actions.
- `packages/ui/src/components/detail/StateResourceSelector.tsx` exposes selectable root/session/terminal resources and guards unknown resource kinds.
- `packages/ui/src/components/detail/StateSummaryView.tsx`, `PrettyJsonView.tsx`, and `RawJsonView.tsx` provide safe state rendering.
- `packages/ui/src/components/detail/StateConfidenceBadge.tsx` and `StateDiagnosticsPanel.tsx` already communicate confidence and replay diagnostics.
- `packages/ui/src/transport/state-client.ts` is the browser-only `/api/state-at` transport boundary. UI must continue avoiding server/Hono/Node imports.
- `e2e/phase5.spec.ts` is the current Playwright pattern: spawn CLI with a temp fixture, wait for dynamic port, drive the browser, save screenshots, and assert no path leakage.
- `test/sse-integration.test.ts` already contains Phase 8 SSE non-inflation patterns and should be extended or mirrored for large-log state-at verification.

## Recommended Architecture

### Pin model

Pinned points should represent selected full resource state, not metadata-only rows:

```ts
interface PinnedStatePoint {
  readonly id: string;
  readonly logKey: string;
  readonly targetIndex: number;
  readonly eventLabel: string;
  readonly eventTimestamp: number;
  readonly resourceKind: "root" | "session" | "terminal";
  readonly resourceUri: string;
  readonly confidence: "complete" | "partial" | "unknown";
  readonly diagnosticCount: number;
  readonly baselineEventIdx: number;
  readonly lastAppliedEventIdx: number;
  readonly baselineFromSeq: number | null;
  readonly lastServerSeq: number | null;
  readonly state: unknown;
}
```

Use a transient UI store/hook for pins rather than localStorage persistence. Pins must reset on log switch/log key change to avoid comparing states from different logs by accident. If persistence is considered later, it should be explicit export/import work, not Phase 10.

### UI placement

Add a "Pin state point" action when `selectedResource` exists in `StateInspectorPanel`. Render a pinned-state strip/panel below the selected state view or beside diagnostics. Keep it within the existing detail rail/drawer so users can select a later event, open state, and pin a second point without context switching.

Recommended components:

- `StatePinButton.tsx` or inline action in `StateInspectorPanel`.
- `PinnedStatePanel.tsx` for the pinned point list, remove/clear controls, and comparison output.
- `state-compare.ts` pure helpers for pin identity and top-level comparison.
- Optional `state-pin-store.ts` if the pin list must be shared between detail panel rerenders and event selection changes.

### Comparison

Compare only two pinned points at a time. If more than two are allowed, the first implementation can cap at two and replace the older pin, or allow a small list and compare the first two selected pins. To keep scope and UX simple, prefer exactly two active pins with explicit "Clear pins" and "Remove" actions.

Top-level changed paths should be computed safely:

- For object-vs-object: union top-level keys and mark keys whose JSON-stable serialized values differ.
- For array-vs-array: compare length and top-level indices only if needed, but prefer summary "array length changed" and avoid rendering large per-index diffs.
- For primitive/null: compare the value and report `(root)` changed.
- Cap displayed changed paths (for example 25) and show an overflow count.
- Do not implement nested semantic diff, changed path trees, or protocol-aware diff in Phase 10.

### Confidence and privacy

Both pinned points and the comparison output must show confidence. If either point is partial/unknown, render comparison as "informational" and warn it may be incomplete. This prevents partial state from being mistaken for authoritative truth.

All comparison is local in browser memory. Do not add outbound requests beyond existing local `/api/state-at`, telemetry, AI explanation, export, pin persistence, or external services.

## Validation Architecture

### Unit/component tests

- Pin button is not shown until selected resource state exists.
- Pin captures event idx/logKey/resource kind/resource URI/confidence/diagnostics/replay metadata/state.
- Pins reset when logKey changes.
- Duplicate pin for same event/resource replaces or updates deterministically.
- Comparison helper returns top-level changed keys for object states and handles arrays/primitives/null.
- Partial/unknown pins render caution/confidence labels in the comparison panel.
- Boundary test continues to ensure UI imports do not cross into server/Hono/Node.

### Integration and E2E

Use Playwright with a temp synthetic snapshot JSONL:

1. Spawn CLI with `--port 0 --no-open`.
2. Open viewer, select a snapshot row, open "State at this point".
3. Select a resource, pin it.
4. Select a later action row, open state, select the same resource, pin it.
5. Confirm comparison panel lists both event metadata values and changed top-level paths.
6. Confirm confidence/diagnostics are visible.
7. Confirm no absolute path leakage.
8. Save screenshots for user guide updates.

### Large-log/SSE verification

Create a synthetic large JSONL fixture or test helper with many timeline events plus replayable snapshots/actions. Validate:

- Calling `/api/state-at` near a later index remains bounded and returns selected state.
- Timeline SSE snapshot/append frames still exclude `resources`, `diagnostics`, `intents`, `cache`, and `state`.
- Large-log lookup does not require embedding replay state in rows.

## Suggested Plan Split

1. **10-01 Pin state points**: add pin model/store/UI and tests. Covers COMPARE-01.
2. **10-02 Basic comparison**: add top-level compare helper and comparison panel with confidence labels. Covers COMPARE-02 and COMPARE-03.
3. **10-03 Verification/docs**: add Playwright E2E, large-log/SSE verification, refresh `USER_GUIDE.md` and screenshots. Covers VERIFY-03 and VERIFY-04.

## Threat Model Notes

| Threat | Risk | Mitigation |
|---|---|---|
| Information disclosure through persistence | State may contain secrets, prompts, paths, or tokens. | Keep pins memory-only; no localStorage/export in Phase 10. |
| Spoofing authoritative comparison | Partial/unknown replay could be mistaken for complete. | Show confidence on each pin and comparison output; warn when either point is not complete. |
| DoS through deep diff | Large state could block UI. | Top-level-only comparison with display cap; no recursive diff. |
| SSE payload inflation | Replay state in rows would harm large logs. | Keep state fetch lazy through `/api/state-at`; verify SSE frames omit replay fields. |
| Boundary violation | UI imports server code. | Duplicate minimal client types if needed; run `test/boundary.test.ts`. |

## Open Questions (RESOLVED)

- **Persist pins?** RESOLVED: No, keep memory-only for privacy and scope.
- **How many pins?** RESOLVED: Support two active comparison points for first implementation.
- **Diff depth?** RESOLVED: Top-level only, with overflow cap.
- **Where UI lives?** RESOLVED: Existing detail/state inspector rail/drawer.
- **Docs refresh?** RESOLVED: Phase 10 plan 10-03 owns user guide and screenshots.
