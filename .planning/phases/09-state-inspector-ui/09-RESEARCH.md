# Phase 09: State Inspector UI - Research

**Researched:** 2026-05-08  
**Domain:** React/Zustand UI for reducer-backed AHP state inspection  
**Confidence:** HIGH

## User Constraints

No `09-CONTEXT.md` exists, so Phase 9 planning uses roadmap, requirements, current project state, and existing code conventions.

Pinned comparison belongs to Phase 10 (`COMPARE-01`..`COMPARE-03`) and must remain out of scope for Phase 9.

## Requirements

| ID | Requirement | Research Finding |
|---|---|---|
| STATE-01 | User can request "state at this point" from selected timeline row or detail panel. | Add an explicit action in the selected event detail flow; the existing UX already flows through `selectedIdx` and `DetailPanel`. |
| STATE-02 | User can choose among reconstructed root/session/terminal resources. | `/api/state-at` returns metadata-only `resources[]` first and full `selectedResource` only with `resourceKind` + `resourceUri`. |
| STATE-03 | User can inspect reconstructed state in themed summary, Pretty JSON, and Raw JSON views. | Reuse existing `PrettyJsonView` and `RawJsonView`; add a state-specific Summary tab. |
| STATE-04 | User sees confidence and replay diagnostics next to reconstructed state. | The Phase 8 response includes aggregate confidence, per-resource confidence, diagnostics, intents, and cache metadata. |
| STATE-05 | User can copy reconstructed state or concise state summary. | Reuse/extract the existing `CopyMenu` clipboard pattern and `CopyToast` feedback. |

## Existing Architecture

- UI source must not import Node, Hono, `@ahp-viewer/server`, host adapters, or legacy parser sub-entries; `test/boundary.test.ts` enforces this.
- Zustand `useAppStore` is the central UI state surface.
- The detail UX already supports a desktop rail and responsive drawer; Phase 9 should extend it rather than create a separate page or global modal.
- Theme support is dark, light, and hacker through `packages/ui/src/styles/tokens.css`; component code should not introduce raw color literals.
- Phase 8 completed lazy state delivery: state comes only from `/api/state-at`, not timeline rows or SSE payloads.
- Current detail components already provide event Pretty/Raw JSON views, copy menu/toast, privacy caption, and selected-event detail loading patterns.

## Recommended UI Pattern

Add a `StateInspectorPanel` inside the existing detail rail/drawer. The panel should be opened by an explicit "State at this point" action near the selected event details. It should:

1. Fetch metadata with `/api/state-at?idx=<selectedIdx>&logKey=<logKey>`.
2. Render resource choices from `resources[]`.
3. Default to the first `complete` resource if present, otherwise the first available resource.
4. Fetch full state with `resourceKind` + encoded `resourceUri`.
5. Render Summary, Pretty JSON, and Raw JSON views for `selectedResource.state`.
6. Keep confidence and diagnostics visually adjacent to state.
7. Abort in-flight requests when `selectedIdx` or `logKey` changes.

## Recommended Implementation Files

- `packages/ui/src/transport/state-client.ts`
- `packages/ui/src/transport/state-client.test.ts`
- `packages/ui/src/components/detail/StateInspectorPanel.tsx`
- `packages/ui/src/components/detail/StateInspectorPanel.test.tsx`
- `packages/ui/src/components/detail/DetailPanel.tsx`
- `packages/ui/src/styles/global.css`
- `packages/ui/src/styles/tokens.css` only if existing tokens are insufficient

## Pitfalls

- Do not assume the metadata response includes selected state; default response intentionally has `selectedResource: null`.
- Do not import server route types into UI; duplicate minimal browser transport types or move a shared contract in a dedicated task.
- Always include `logKey`; treat `409 log-mismatch` as a stale request, not a fatal app error.
- Do not make partial/unknown confidence subtle; partial or unknown state must not look authoritative.
- Do not hand-roll a JSON renderer; use `PrettyJsonView` and `RawJsonView`.
- Avoid continuous scrub fetching; Phase 9 is explicit click/open state inspection.
- Do not implement pinning or comparison; that is Phase 10.

## Recommended Plan Breakdown

### 09-01: Add state-at-this-point action in the timeline/detail flow

- Add browser-only `state-client.ts` with response types and `fetchStateAt`.
- Add `StateInspectorPanel` shell and wire it into `DetailPanel`.
- Add a "State at this point" button for populated selected details.
- Fetch metadata for selected `idx` and active `logKey`.
- Cover URL encoding, logKey, abort/error handling, and metadata loading tests.

### 09-02: Add resource selector and themed summary/Pretty/Raw views

- Render resource selector from metadata.
- Refetch selected full state with `resourceKind` and `resourceUri`.
- Add state Summary, Pretty JSON, and Raw JSON tabs.
- Reuse existing JSON components and theme tokens.
- Cover selector behavior, summary metadata, Pretty/Raw tabs, and themed CSS constraints.

### 09-03: Add confidence and diagnostics UI with copy actions

- Add confidence badge/strip for aggregate and selected resource confidence.
- Add diagnostics panel for top-level and selected-resource diagnostics.
- Surface intents/cache metadata only as concise diagnostic/context details.
- Add copy actions for compact JSON, pretty JSON, and summary.
- Use `CopyToast` feedback and preserve local-only privacy posture.

## Validation Architecture

Quick run:

```bash
pnpm test -- packages/ui/src/transport/state-client.test.ts packages/ui/src/components/detail/StateInspectorPanel.test.tsx
```

Full suite:

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Phase 9 is UI-visible, so execution should include browser verification and refreshed screenshots/docs when the UI is implemented. Full state/pinning/comparison E2E remains Phase 10, but focused Phase 9 smoke coverage is appropriate if the implementation adds a stable state-inspector fixture path.

## Open Questions Resolved by Recommended Defaults

1. **Button placement:** Use an explicit button in the populated `DetailPanel`, not per-row timeline buttons.
2. **Default selected resource:** First `complete` resource, else first resource.
3. **Diagnostic details:** Show code, severity, event index, and message by default; keep raw `details` collapsed or omit until needed.

## Sources

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/08-server-state-at-index-api-and-cache-integration/08-VERIFICATION.md`
- `packages/server/src/state-routes.ts`
- `packages/server/src/state-routes.test.ts`
- `packages/core/src/replay.ts`
- `packages/ui/src/components/detail/*`
- `packages/ui/src/components/shell/AppShell.tsx`
- `packages/ui/src/state/store.ts`
- `packages/ui/src/styles/tokens.css`
- `packages/ui/src/styles/global.css`
- `test/boundary.test.ts`
