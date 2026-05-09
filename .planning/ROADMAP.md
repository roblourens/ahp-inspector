# Roadmap: AHP Log Viewer

**Created:** 2026-05-06  
**Current milestone:** v1.1 Reducer-backed State Snapshots
**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

## Vision

Make AHP traffic understandable at a glance while preserving fast access to exact raw event details.

## Milestones

- **v1.0 Initial MVP** — shipped 2026-05-08. Delivered standalone local viewing, JSONL ingestion, virtualized timeline, detail/search/filtering, live discovery/tail/persistence, row polish, three themes, and full verification.
- **v1.1 Reducer-backed State Snapshots** — ready for milestone verification. Reconstructs root/session/terminal state at selected log events by replaying canonical AHP reducers over snapshots and server action envelopes.

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

- [x] 08-01: Add `StateReplayIndex` lifecycle beside EventStore, Correlator, SearchIndex, and timeline rows.
- [x] 08-02: Add `/api/state-at` endpoint with resource selection, confidence, diagnostics, and cache scoping.
- [x] 08-03: Cover log switch, live append, pause/resume, rotation reset, and large-log lookup behavior.

**Success criteria:**

- Selected-index state fetches do not inflate SSE row payloads.
- State replay resets correctly on log switch and rotation.
- Missing baselines/gaps/unknown actions are visible in diagnostics.

### Phase 9: State inspector UI

**Goal:** Let users click a timeline event and inspect reconstructed state at that point.

**Depends on:** Phase 8
**Requirements:** STATE-01, STATE-02, STATE-03, STATE-04, STATE-05

Plans:

- [x] 09-01: Add state-at-this-point action in the timeline/detail flow.
- [x] 09-02: Add resource selector and themed state summary/Pretty/Raw views.
- [x] 09-03: Add confidence and diagnostics UI with copy actions.

**Success criteria:**

- State inspection fits the existing detail drawer/rail UX.
- Light, dark, and hacker themes cover all new state UI.
- Partial/unknown state cannot be mistaken for authoritative complete state.

### Phase 10: Pinned comparison and milestone verification

**Goal:** Support before/after state reasoning and verify the full reducer-backed workflow.

**Depends on:** Phase 9
**Requirements:** COMPARE-01, COMPARE-02, COMPARE-03, VERIFY-03, VERIFY-04

Plans:

- [x] 10-01: Add pinned state points with event metadata and resource context.
- [x] 10-02: Add basic comparison with changed top-level paths and clear confidence labels.
- [x] 10-03: Add E2E/large-log verification and refresh user-facing docs/screenshots.

**Success criteria:**

- Users can pin two points and understand what changed between them.
- Browser E2E covers state inspection, pinning, comparison, and diagnostics.
- Local-only privacy posture is preserved.

## Progress

| Milestone | Phases | Plans | Status | Completed |
|-----------|--------|-------|--------|-----------|
| v1.0 Initial MVP | 6/6 | 37/37 | Shipped | 2026-05-08 |
| v1.1 Reducer-backed State Snapshots | 5/5 | 15/15 | Ready for milestone verification | — |

## Next

Run `/gsd-complete-milestone` for v1.1 milestone verification/archive when requested.

### Phase 11: VS Code extension command palette webview

**Goal:** Let users open AHP Log Viewer from the VS Code Command Palette in a local-only webview backed by direct extension-host messaging.
**Requirements:** EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-06, EXT-07
**Depends on:** Phase 10
**Plans:** 4 plans

Plans:
- [x] 11-01-PLAN.md — Add the VS Code extension package, command contribution, webview shell, and active-log detection.
- [x] 11-02-PLAN.md — Introduce a UI transport abstraction while preserving the browser HTTP/SSE runtime.
- [x] 11-03-PLAN.md — Implement the direct webview `postMessage` bridge for sessions, stream frames, detail, search, and state lookup.
- [x] 11-04-PLAN.md — Add extension packaging verification, security guards, docs, and end-to-end validation.

### Phase 12: Search rather than filter

**Goal:** Make free-text search preserve timeline context by highlighting and navigating matches instead of filtering nonmatching rows out of the visible timeline, while faceted filters remain the row-narrowing mechanism.
**Requirements:** SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, EXT-04, VERIFY-02, VERIFY-03
**Depends on:** Phase 11
**Plans:** 3 plans

Plans:
- [x] 12-01-PLAN.md — Separate search result state from faceted row filtering.
- [x] 12-02-PLAN.md — Add search match highlighting, count, and navigation without hiding rows.
- [x] 12-03-PLAN.md — Verify browser/extension search semantics and update user-facing docs.

### Phase 13: npx publishing and auto-open latest log

**Goal:** Ship the standalone viewer as a published npm package so a single `npx` invocation downloads, runs the loopback server, and opens the browser viewer streaming the most-recently-modified AHP JSONL log under the standard VS Code log roots.
**Requirements:** NPX-01, NPX-02, NPX-03, NPX-04, NPX-05, NPX-06
**Depends on:** Phase 11
**Plans:** TBD (run `/gsd-plan-phase 13`)

Outline:
- 13-01 — CLI: when launched without a path argument, reuse `discoverVsCodeLogs()` to pick the most-recently-modified JSONL candidate, then open it as the active log (treat "no candidate" the same as today's empty discovery state).
- 13-02 — Packaging: choose a public scope/name, ensure the published tarball includes `packages/cli/dist`, `packages/ui/dist`, and the protocol/server/host-node bundles; add a `bin` entry so `npx <name>` runs the CLI; verify `npm pack` and a tarball install boot the viewer.
- 13-03 — Release automation + docs: add a release script (or GH Actions workflow) that bumps version, builds, runs typecheck/test, and publishes (with a documented dry-run); update README/USER_GUIDE with the `npx` flow, auto-open behavior, and the local-only privacy posture.

---
*Roadmap updated after v1.1 milestone start: 2026-05-08*
*Phase 13 added: 2026-05-09 (npx publishing).*
