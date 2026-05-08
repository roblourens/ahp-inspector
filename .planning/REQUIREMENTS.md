# Requirements: AHP Log Viewer v1.1

**Defined:** 2026-05-08  
**Core Value:** Make AHP traffic understandable at a glance while preserving fast access to exact raw event details.

## v1.1 Requirements

Requirements for reducer-backed state reconstruction.

### Protocol Sync

- [x] **SYNC-01**: Developer can sync canonical AHP TypeScript protocol files from `../agent-host-protocol` into a generated local package.
- [x] **SYNC-02**: Synced protocol files include reducers, state, actions, action-origin, messages, commands, notifications, errors, and version registry.
- [x] **SYNC-03**: The app records the source AHP commit for synced protocol files and exposes it in developer-facing diagnostics.
- [x] **SYNC-04**: Existing imports use the generated protocol package instead of stale or hand-rolled protocol definitions.

### Replay Engine

- [x] **REPLAY-01**: The app can reconstruct AHP root state at a selected event index from snapshots and server action envelopes.
- [x] **REPLAY-02**: The app can reconstruct AHP session state at a selected event index from snapshots and session-scoped action envelopes.
- [x] **REPLAY-03**: The app can reconstruct AHP terminal state at a selected event index from snapshots and terminal-scoped action envelopes.
- [x] **REPLAY-04**: Replay uses event timestamps for reducer-derived time values so repeated runs are deterministic.
- [x] **REPLAY-05**: Client dispatch requests are shown as intent but do not mutate reconstructed state unless accepted through server action envelopes.
- [x] **REPLAY-06**: Reconnect replay responses apply embedded action envelopes in order.

### State Confidence and Diagnostics

- [ ] **CONF-01**: Every reconstructed state result reports confidence as complete, partial, or unknown.
- [ ] **CONF-02**: State results explain missing baseline snapshots, server sequence gaps, unknown actions, ignored client intent, and parse errors that affect confidence.
- [ ] **CONF-03**: Log switch, live tail, pause/resume, and rotation reset state replay caches consistently with existing event/search/detail state.

### Inspector UI

- [ ] **STATE-01**: User can request "state at this point" from a selected timeline row or detail panel.
- [ ] **STATE-02**: User can choose among reconstructed root/session/terminal resources available at the selected point.
- [ ] **STATE-03**: User can inspect reconstructed state in themed summary, Pretty JSON, and Raw JSON views.
- [ ] **STATE-04**: User sees confidence and replay diagnostics next to the reconstructed state.
- [ ] **STATE-05**: User can copy reconstructed state or a concise state summary.

### Comparison

- [ ] **COMPARE-01**: User can pin at least two state points from the timeline.
- [ ] **COMPARE-02**: User can compare pinned state points with clear event metadata and changed top-level paths.
- [ ] **COMPARE-03**: Comparison preserves local-only privacy and never sends state outside the local viewer.

### Verification

- [x] **VERIFY-01**: Reducer replay is covered by parity fixtures based on `../agent-host-protocol/types/test-cases/reducers`.
- [ ] **VERIFY-02**: Integration tests cover state reconstruction from synthetic JSONL with subscribe/reconnect snapshots and action envelopes.
- [ ] **VERIFY-03**: Browser E2E covers opening a log, selecting a row, viewing state, pinning two points, and seeing confidence diagnostics.
- [ ] **VERIFY-04**: Large-log tests confirm state-at-index lookup remains responsive and does not inflate timeline SSE payloads.

## Future Requirements

### Advanced State Analysis

- **FUTURE-01**: User can scrub continuously through timeline rows with live state updates.
- **FUTURE-02**: User can view a deep semantic diff for arbitrary nested state paths.
- **FUTURE-03**: User can compare reconstructed state across multiple log files.
- **FUTURE-04**: User can export selected state snapshots or diffs.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Editing or replaying protocol traffic | Viewer remains an observer/debugger, not a protocol mutator. |
| Treating partial reconstructed state as authoritative truth | Logs can start mid-stream or omit snapshots; confidence must remain explicit. |
| External AI explanation of state | Violates local-only/no-outbound posture. |
| Full semantic diff for every protocol field | Useful but larger than the first reducer-backed milestone. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SYNC-01 | Phase 6 | Done |
| SYNC-02 | Phase 6 | Done |
| SYNC-03 | Phase 6 | Done |
| SYNC-04 | Phase 6 | Done |
| REPLAY-01 | Phase 7 | Done |
| REPLAY-02 | Phase 7 | Done |
| REPLAY-03 | Phase 7 | Done |
| REPLAY-04 | Phase 7 | Done |
| REPLAY-05 | Phase 7 | Done |
| REPLAY-06 | Phase 7 | Done |
| CONF-01 | Phase 8 | Pending |
| CONF-02 | Phase 8 | Pending |
| CONF-03 | Phase 8 | Pending |
| STATE-01 | Phase 9 | Pending |
| STATE-02 | Phase 9 | Pending |
| STATE-03 | Phase 9 | Pending |
| STATE-04 | Phase 9 | Pending |
| STATE-05 | Phase 9 | Pending |
| COMPARE-01 | Phase 10 | Pending |
| COMPARE-02 | Phase 10 | Pending |
| COMPARE-03 | Phase 10 | Pending |
| VERIFY-01 | Phase 6 | Done |
| VERIFY-02 | Phase 8 | Pending |
| VERIFY-03 | Phase 10 | Pending |
| VERIFY-04 | Phase 10 | Pending |

**Coverage:**

- v1.1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-05-08 after v1.1 milestone start*
