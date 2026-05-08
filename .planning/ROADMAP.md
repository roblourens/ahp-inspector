# Roadmap: AHP Log Viewer

**Created:** 2026-05-06  
**Current milestone:** v1.1 Reducer-backed State Snapshots
**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

## Vision

Make AHP traffic understandable at a glance while preserving fast access to exact raw event details.

## Milestones

- **v1.0 Initial MVP** — shipped 2026-05-08. Delivered standalone local viewing, JSONL ingestion, virtualized timeline, detail/search/filtering, live discovery/tail/persistence, row polish, three themes, and full verification.
- **v1.1 Reducer-backed State Snapshots** — in progress. Reconstruct root/session/terminal state at selected log events by replaying canonical AHP reducers over snapshots and server action envelopes.

## Phases

<details>
<summary>v1.0 Initial MVP (Phases 1-5 plus inserted Phase 04.1) — SHIPPED 2026-05-08</summary>

- [x] Phase 1: Core Foundations — 3/3 plans complete
- [x] Phase 2: Vertical Slice — CLI, Server, Timeline — 7/7 plans complete
- [x] Phase 3: Detail, Search, and Filtering — 7/7 plans complete
- [x] Phase 4: Live Tail, Discovery, and Persistence — 8/8 plans complete
- [x] Phase 04.1: Timeline row information polish and real-log validation — 6/6 plans complete
- [x] Phase 5: Themes, Polish, and Verification — 6/6 plans complete

Full phase details are archived in `.planning/milestones/v1.0-ROADMAP.md`.

</details>

### Phase 6: Protocol reducer sync foundation

**Goal:** Pull canonical AHP reducer/state/action code into this repo through a deterministic generated package.

**Depends on:** v1.0 archive
**Requirements:** SYNC-01, SYNC-02, SYNC-03, SYNC-04, VERIFY-01

Plans:

- [x] 06-01: Add generated `@ahp-viewer/protocol` package and sync script based on VS Code's AHP sync workflow.
- [x] 06-02: Switch protocol imports away from stale sibling `file:` dependency behavior.
- [x] 06-03: Add reducer parity fixtures and source-commit diagnostics.

**Success criteria:**

- Protocol files can be regenerated from `../agent-host-protocol` with a single command.
- The synced source commit is recorded and test-visible.
- Reducer fixture parity passes in this repo.

### Phase 7: Deterministic replay engine

**Goal:** Build pure reducer replay that reconstructs root, session, and terminal state from canonical events.

**Depends on:** Phase 6
**Requirements:** REPLAY-01, REPLAY-02, REPLAY-03, REPLAY-04, REPLAY-05, REPLAY-06

Plans:

- [x] 07-01: Model replay resources, snapshots, action-envelope application, and diagnostics.
- [x] 07-02: Implement deterministic reducer execution with event-time `Date.now()` behavior.
- [x] 07-03: Handle subscribe/initialize/reconnect snapshots, reconnect action replay, and ignored client intent.

**Success criteria:**

- Replaying the same log to the same index produces stable state.
- Root/session/terminal reducers are selected correctly.
- Client dispatch intent is visible but does not mutate canonical state.

### Phase 8: Server state-at-index API and cache integration

**Goal:** Integrate replay with `AppState` and expose lazy state-at-event endpoints.

**Depends on:** Phase 7
**Requirements:** CONF-01, CONF-02, CONF-03, VERIFY-02

Plans:

- [ ] 08-01: Add `StateReplayIndex` lifecycle beside EventStore, Correlator, SearchIndex, and timeline rows.
- [ ] 08-02: Add `/api/state-at` endpoint with resource selection, confidence, diagnostics, and cache scoping.
- [ ] 08-03: Cover log switch, live append, pause/resume, rotation reset, and large-log lookup behavior.

**Success criteria:**

- Selected-index state fetches do not inflate SSE row payloads.
- State replay resets correctly on log switch and rotation.
- Missing baselines/gaps/unknown actions are visible in diagnostics.

### Phase 9: State inspector UI

**Goal:** Let users click a timeline event and inspect reconstructed state at that point.

**Depends on:** Phase 8
**Requirements:** STATE-01, STATE-02, STATE-03, STATE-04, STATE-05

Plans:

- [ ] 09-01: Add state-at-this-point action in the timeline/detail flow.
- [ ] 09-02: Add resource selector and themed state summary/Pretty/Raw views.
- [ ] 09-03: Add confidence and diagnostics UI with copy actions.

**Success criteria:**

- State inspection fits the existing detail drawer/rail UX.
- Light, dark, and hacker themes cover all new state UI.
- Partial/unknown state cannot be mistaken for authoritative complete state.

### Phase 10: Pinned comparison and milestone verification

**Goal:** Support before/after state reasoning and verify the full reducer-backed workflow.

**Depends on:** Phase 9
**Requirements:** COMPARE-01, COMPARE-02, COMPARE-03, VERIFY-03, VERIFY-04

Plans:

- [ ] 10-01: Add pinned state points with event metadata and resource context.
- [ ] 10-02: Add basic comparison with changed top-level paths and clear confidence labels.
- [ ] 10-03: Add E2E/large-log verification and refresh user-facing docs/screenshots.

**Success criteria:**

- Users can pin two points and understand what changed between them.
- Browser E2E covers state inspection, pinning, comparison, and diagnostics.
- Local-only privacy posture is preserved.

## Progress

| Milestone | Phases | Plans | Status | Completed |
|-----------|--------|-------|--------|-----------|
| v1.0 Initial MVP | 6/6 | 37/37 | Shipped | 2026-05-08 |
| v1.1 Reducer-backed State Snapshots | 2/5 | 6/15 | In progress | — |

## Next

Plan and execute Phase 8 with `/gsd-plan-phase 8`.

---
*Roadmap updated after v1.1 milestone start: 2026-05-08*
