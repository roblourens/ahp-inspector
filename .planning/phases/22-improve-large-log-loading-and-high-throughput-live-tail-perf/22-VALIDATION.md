---
phase: 22
slug: improve-large-log-loading-and-high-throughput-live-tail-perf
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-16
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 for unit/integration/component verification; Playwright 1.59.1 for phase-level browser regression coverage. |
| **Config file** | `vitest.config.ts`, `packages/ui/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | Run the focused Vitest command listed for the completed task below. |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm lint && pnpm e2e` |
| **Estimated runtime** | Per-task feedback stays file-scoped and under the plans' focused-test target; the full suite plus Playwright is reserved for wave/phase gates. |

---

## Sampling Rate

- **After every task commit:** Run that task's focused Vitest command from the verification map.
- **After every plan wave:** Run the focused commands for plans in that wave; after Wave 5, run `pnpm test && pnpm typecheck && pnpm lint && pnpm e2e`.
- **Before `/gsd-verify-work`:** `pnpm test && pnpm typecheck && pnpm lint && pnpm e2e` must be green.
- **Max feedback latency:** Keep task-level feedback to the focused file-scoped Vitest commands; Playwright remains a phase gate because no Phase 22 plan adds a new e2e spec.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 22-01 | 1 | D-06, D-09 | T-22-01-01 | Changed indexes are deduplicated and drained instead of replaying stale derived-row work. | unit | `pnpm exec vitest run packages/core/src/correlator.test.ts` | ✅ | ✅ green |
| 22-01-02 | 22-01 | 1 | D-06, D-09 | T-22-01-02 | Flush/reset cannot leak changed indexes across timeout or rotation lifecycles. | unit | `pnpm exec vitest run packages/core/src/correlator.test.ts` | ✅ | ✅ green |
| 22-02-01 | 22-02 | 2 | D-06, D-09 | T-22-02-01 | AppState patches exact affected historical rows without history-wide rediscovery scans. | unit/integration | `pnpm exec vitest run packages/server/src/app-state.test.ts` | ✅ | ✅ green |
| 22-02-02 | 22-02 | 2 | D-06, D-09 | T-22-02-01, T-22-02-02 | Flush work stays changed-row-local and SSE payloads remain compact/lazy. | unit/integration | `pnpm exec vitest run packages/server/src/app-state.test.ts` | ✅ | ✅ green |
| 22-03-01 | 22-03 | 3 | D-03 | T-22-03-03 | Initial-read percentages derive only from captured baseline bytes. | unit | `pnpm exec vitest run packages/host-node/src/tail-reader.test.ts` | ✅ | ✅ green |
| 22-03-02 | 22-03 | 3 | D-03 | T-22-03-01, T-22-03-03 | Progress frames omit paths and omit percentages when the denominator is not trustworthy. | unit/integration | `pnpm exec vitest run packages/server/src/app-state.test.ts` | ✅ | ✅ green |
| 22-03-03 | 22-03 | 3 | D-06, D-08 | T-22-03-01, T-22-03-02 | Snapshot-era live/progress frames are delivered, backlog lag is surfaced, and path leakage remains absent. | integration | `pnpm exec vitest run test/sse-integration.test.ts` | ✅ | ✅ green |
| 22-04-01 | 22-04 | 4 | D-01, D-03, D-08 | T-22-04-02, T-22-04-03 | Store lifecycle state separates truthful baseline progress from manual pause buffers. | unit | `pnpm exec vitest run packages/ui/src/state/store.test.ts` | ✅ | ✅ green |
| 22-04-02 | 22-04 | 4 | D-01, D-02, D-04, D-06, D-08, D-09 | T-22-04-01, T-22-04-02 | Stream drains publish rows progressively in ordered bounded batches and clear pending work on resets. | unit/integration | `pnpm exec vitest run packages/ui/src/transport/sse-client.test.ts` | ✅ | ✅ green |
| 22-05-01 | 22-05 | 5 | D-03 | T-22-05-01, T-22-05-02 | Loading copy renders percent only when supplied and preserves basename-safe file display. | component | `pnpm exec vitest run packages/ui/src/components/states/states.test.tsx` | ✅ | ✅ green |
| 22-05-02 | 22-05 | 5 | D-08 | T-22-05-03 | Backlog cue remains compact, passive, and separate from manual pause/resume state. | component | `pnpm exec vitest run packages/ui/src/components/shell/StreamBacklogPill.test.tsx` | ✅ | ✅ green |
| 22-05-03 | 22-05 | 5 | D-01, D-04, D-08 | T-22-05-01, T-22-05-03 | Rows, search/filter controls, progress, and backlog cues coexist during partial loading without hiding the timeline. | component | `pnpm exec vitest run packages/ui/src/components/timeline/TimelineRegion.test.tsx` | ✅ | ✅ green |
| 22-06-01 | 22-06 | 5 | D-02 | T-22-06-01 | Preference hydration waits for explicit baseline completion rather than first-row visibility. | unit/component | `pnpm exec vitest run packages/ui/src/persistence/persist-effect.test.ts` | ✅ | ✅ green |
| 22-06-02 | 22-06 | 5 | D-05, D-07 | T-22-06-02 | Off-tail inspection stays stable while true tail-follow remains scheduled and smooth. | component/virtualization | `pnpm exec vitest run packages/ui/src/components/timeline/TimelineList.virt.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0 plan is required for Phase 22.

- Existing Vitest, UI Vitest, and Playwright configs already cover every package/test style used by the six plans.
- All listed focused commands target existing test files except `packages/ui/src/components/shell/StreamBacklogPill.test.tsx`, which Plan 22-05 Task 2 creates in the same TDD task before its focused command is executed.
- Existing integration coverage in `test/sse-integration.test.ts` is extended in place for progressive snapshot/backlog ordering; no new harness is required.
- Because the one new component test is part of its implementation task rather than a prerequisite harness, Wave 0 disposition is complete and `wave_0_complete: true` is accurate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | All Phase 22 plan behaviors have automated Vitest coverage, with repository Playwright regression coverage run as the phase gate. | — |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or an explicitly settled Wave 0 disposition
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 disposition covers the only new test-file reference and confirms no harness work is missing
- [x] No watch-mode flags
- [x] Feedback latency is kept to focused file-scoped Vitest commands during execution
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-16

---

## Validation Audit 2026-05-16

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Retroactive audit confirmed the existing Phase 22 validation contract is complete. The mapped focused tests exist, the verifier independently reran Phase 22 focused clusters, and the orchestrator reran `pnpm test`, `pnpm typecheck`, and `pnpm e2e` green after review follow-up fixes. Full `pnpm lint` remains intentionally outside the green claim because it previously stopped on unrelated pre-existing repository findings outside the Phase 22 touched surface.
