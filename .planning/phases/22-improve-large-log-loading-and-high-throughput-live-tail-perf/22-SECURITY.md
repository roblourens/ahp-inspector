---
phase: 22
slug: improve-large-log-loading-and-high-throughput-live-tail-perf
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-16
---

# Phase 22 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Host reader -> server state | Local JSONL baseline bytes and append chunks enter portable event projection. | Parsed log lines plus byte-count lifecycle metadata. |
| Server state -> browser SSE | Snapshot, append, patch, progress, and backlog frames cross the loopback stream boundary. | Compact projected rows, bounded patch metadata, non-sensitive progress counters. |
| Browser stream -> UI state | Scheduled stream publication updates store state that drives visible progress and backlog cues. | Event rows, percentages only when server-supplied, and queue counts. |
| UI state -> local persistence | Per-log interaction preferences hydrate after baseline completion. | Search/filter/grouping/view preferences and selected row index only. |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-22-01-01 | D | `Correlator` changed-index accumulator | mitigate | Deduplicated `Set` drain clears after consumption; correlator tests cover repeated drain behavior. | closed |
| T-22-01-02 | T | `Correlator.reset()` | mitigate | Reset clears pending correlation state and changed indexes before rotated-log replacement rows can be patched. | closed |
| T-22-02-01 | D | `AppState` append/flush patch projection | mitigate | AppState consumes `drainChangedIndexes()` and patches only affected prior rows instead of rescanning historical projections. | closed |
| T-22-02-02 | I | `SsePayload` rows/patches | mitigate | Row/patch payloads remain compact; server and SSE integration tests assert replay/detail state does not leak into streamed append payloads. | closed |
| T-22-03-01 | I | Progress/backlog payloads | mitigate | Progress/backlog frames carry counts and percentages only; path-leak assertions and basename-safe UI paths remain in tests. | closed |
| T-22-03-02 | D | SSE queue during baseline snapshot | mitigate | SSE subscribes before snapshot delivery, queues concurrent frames, emits backlog, drains queued work, then emits a zeroed backlog clear frame. | closed |
| T-22-03-03 | T | Percent calculation | mitigate | Percentages derive from captured initial-read byte totals and are omitted when no trustworthy denominator exists. | closed |
| T-22-04-01 | D | SSE client drain queue | mitigate | Client drains bounded scheduled frame batches, uses cursor-based queues, and clears stale queued work on reset or close. | closed |
| T-22-04-02 | T | Progress parsing | mitigate | Browser accepts explicit progress payload percentages only; no row-count-derived percentage synthesis exists in UI state. | closed |
| T-22-04-03 | D | Store pause/backlog separation | mitigate | `streamBacklog` state is separate from manual `pendingBuffer` / `pendingNewCount` paused-tail state. | closed |
| T-22-05-01 | I | `LoadingState` and backlog status copy | mitigate | Loading/backlog copy renders basename-safe filename input and count/percent status only, with no raw event or filesystem path fields. | closed |
| T-22-05-02 | T | Percentage presentation | mitigate | Loading UI renders percentage only when the store receives an explicit server-derived percent; otherwise it shows honest row-count status. | closed |
| T-22-05-03 | D | Backlog cue layout | mitigate | Backlog pill clamps counts to `99+`, stays passive status UI, and has stable compact fixed-height styling covered by component tests. | closed |
| T-22-06-01 | T | `usePersistEffect()` hydration trigger | mitigate | Preference hydration waits for `loadProgress.phase === "complete"`, preserves selection bounds, and handles late subscribers via snapshot progress replay. | closed |
| T-22-06-02 | D | `TimelineList` follow-scroll effects | mitigate | Follow-scroll remains gated by bottom ownership; virtualized tests cover off-tail stability and at-tail scheduled follow. | closed |

*Status: open - closed*
*Disposition: mitigate (implementation required) - accept (documented risk) - transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-16 | 15 | 15 | 0 | GitHub Copilot direct audit after `gsd-security-auditor` file-access escalation |

### Audit Notes

- The dedicated security subagent escalated because its isolated session lacked repository read/search access; it did not identify a code gap.
- Rob approved direct recovery in the orchestrator session, which had working repository access.
- Evidence was checked against the Phase 22 plans, summaries, validation/verification artifacts, implementation files, and the already-green post-review verification gates (`pnpm test`, `pnpm typecheck`, `pnpm e2e`, focused Biome on review-fixed files).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-16