# Requirements: AHP Inspector v1.1

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

- [x] **CONF-01**: Every reconstructed state result reports confidence as complete, partial, or unknown.
- [x] **CONF-02**: State results explain missing baseline snapshots, server sequence gaps, unknown actions, ignored client intent, and parse errors that affect confidence.
- [x] **CONF-03**: Log switch, live tail, pause/resume, and rotation reset state replay caches consistently with existing event/search/detail state.

### Inspector UI

- [x] **STATE-01**: User can request "state at this point" from a selected timeline row or detail panel.
- [x] **STATE-02**: User can choose among reconstructed root/session/terminal resources available at the selected point.
- [x] **STATE-03**: User can inspect reconstructed state in themed summary, Pretty JSON, and Raw JSON views.
- [x] **STATE-04**: User sees confidence and replay diagnostics next to the reconstructed state.
- [x] **STATE-05**: User can copy reconstructed state or a concise state summary.

### Comparison

- [x] **COMPARE-01**: User can pin at least two state points from the timeline.
- [x] **COMPARE-02**: User can compare pinned state points with clear event metadata and changed top-level paths.
- [x] **COMPARE-03**: Comparison preserves local-only privacy and never sends state outside the local viewer.

### Verification

- [x] **VERIFY-01**: Reducer replay is covered by parity fixtures based on `../agent-host-protocol/types/test-cases/reducers`.
- [x] **VERIFY-02**: Integration tests cover state reconstruction from synthetic JSONL with subscribe/reconnect snapshots and action envelopes.
- [x] **VERIFY-03**: Browser E2E covers opening a log, selecting a row, viewing state, pinning two points, and seeing confidence diagnostics.
- [x] **VERIFY-04**: Large-log tests confirm state-at-index lookup remains responsive and does not inflate timeline SSE payloads.

### VS Code Extension Webview

- [x] **EXT-01**: User can run an AHP Inspector command from the VS Code Command Palette and open the viewer inside a VS Code webview.
- [x] **EXT-02**: If the active editor is an AHP JSONL log, the command opens the webview with that log selected by default; otherwise the webview shows log discovery/open options.
- [x] **EXT-03**: The VS Code webview runtime uses direct `postMessage` communication with the extension host instead of starting the loopback browser server.
- [x] **EXT-04**: The VS Code webview supports discovery/open, live timeline updates, event detail, search, and reconstructed state lookup through a shared transport contract.
- [x] **EXT-05**: The extension package has publishable manifest metadata, activation, command contribution, CSP-safe webview asset loading, and build/typecheck scripts.
- [x] **EXT-06**: The existing standalone CLI/browser viewer continues to build and run through the HTTP/SSE transport after the UI transport refactor.
- [x] **EXT-07**: Automated verification covers command activation, active-log detection, webview message handling, and local-only/no-outbound constraints.

### npx Publishing and Auto-open Latest Log

- [x] **NPX-01**: User can install or invoke the viewer with `npx ahp-inspector` (unscoped, top-level) without cloning the repository.
- [x] **NPX-02**: Running the published binary with no arguments discovers the most-recently-modified AHP JSONL log under the standard VS Code log roots, opens the viewer browser tab, and streams that log immediately.
- [x] **NPX-03**: Running the published binary with an explicit path argument behaves the same as today's CLI (open that file, ignore auto-discovery).
- [x] **NPX-04**: The published package bundles the prebuilt UI assets (`packages/ui/dist`) so the binary works without a post-install build step.
- [x] **NPX-05**: Publishing is automated: a release script (or CI workflow) bumps the version, builds, runs typecheck/test, and publishes to npm under a public scope with a documented dry-run mode.
- [x] **NPX-06**: A short README/USER_GUIDE section documents the `npx` invocation, the auto-discovery rule, and the local-only privacy posture (loopback bind, no telemetry).

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
| CONF-01 | Phase 8 | Done |
| CONF-02 | Phase 8 | Done |
| CONF-03 | Phase 8 | Done |
| STATE-01 | Phase 9 | Done |
| STATE-02 | Phase 9 | Done |
| STATE-03 | Phase 9 | Done |
| STATE-04 | Phase 9 | Done |
| STATE-05 | Phase 9 | Done |
| COMPARE-01 | Phase 10 | Done |
| COMPARE-02 | Phase 10 | Done |
| COMPARE-03 | Phase 10 | Done |
| VERIFY-01 | Phase 6 | Done |
| VERIFY-02 | Phase 8 | Done |
| VERIFY-03 | Phase 10 | Done |
| VERIFY-04 | Phase 10 | Done |
| EXT-01 | Phase 11 | Done |
| EXT-02 | Phase 11 | Done |
| EXT-03 | Phase 11 | Done |
| EXT-04 | Phase 11 | Done |
| EXT-05 | Phase 11 | Done |
| EXT-06 | Phase 11 | Done |
| EXT-07 | Phase 11 | Done |
| NPX-01 | Phase 13 | Implemented |
| NPX-02 | Phase 13 | Implemented |
| NPX-03 | Phase 13 | Implemented |
| NPX-04 | Phase 13 | Implemented |
| NPX-05 | Phase 13 | Implemented |
| NPX-06 | Phase 13 | Implemented |

**Coverage:**

- v1.1 requirements: 32 total
- Mapped to phases: 32
- v1.2 requirements: 6 total (NPX-01..06) mapped to Phase 13
- Unmapped: 0

---
*Requirements defined: 2026-05-08 after v1.1 milestone start*
