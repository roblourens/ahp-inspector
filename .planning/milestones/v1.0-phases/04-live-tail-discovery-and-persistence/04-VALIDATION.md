---
phase: 04
slug: live-tail-discovery-and-persistence
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-07
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + jsdom for UI; native Node test surfaces through Vitest for server/host packages |
| **Config file** | `vitest.config.ts`, `packages/ui/vitest.config.ts` |
| **Quick run command** | `pnpm -F @ahp-viewer/<pkg> test` for the package changed by the task |
| **Full suite command** | `pnpm test && pnpm -F @ahp-viewer/ui build && pnpm -F @ahp-viewer/cli build && pnpm typecheck && pnpm lint` |
| **Browser UAT command** | Playwright CLI skill with screenshots saved under `screenshots/phase4-*` |

---

## Sampling Rate

- **After every task commit:** Run the package-scoped test for the changed package.
- **After every plan wave:** Run `pnpm test`.
- **Before `/gsd-verify-work`:** Run the full suite command and complete browser UAT screenshots.
- **Max feedback latency:** No 3 consecutive implementation tasks without an automated verification command.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-W0-discovery-tests | 04-01 | 0 | INGEST-02 | V12-FILE-01 | Discovery walk is bounded and returns safe candidates without absolute paths | unit | `pnpm -F @ahp-viewer/host-node test src/discovery.test.ts` | Yes | green |
| 04-W0-session-routes | 04-03 | 0 | INGEST-02, INGEST-03 | V7-ERR-01 | Discover/open endpoints expose safe codes and never echo absolute paths | integration | `pnpm -F @ahp-viewer/server test src/session-routes.test.ts` | Yes | green |
| 04-W0-log-key | 04-00 | 0 | SEARCH-05 | V8-DATA-01 | `logKey` is non-reversible and stable for the opened log identity | unit | `pnpm -F @ahp-viewer/server test src/log-key.test.ts` | Yes | green |
| 04-W0-persistence | 04-06 | 0 | SEARCH-05 | V8-DATA-02 | localStorage stores only UI preferences, validates schema, and drops stale selected rows | jsdom | `pnpm -F @ahp-viewer/ui test src/state/persistence.test.ts` | Yes | green |
| 04-W1-tail-append | 04-02 | 1 | INGEST-04 | V12-FILE-02 | Appends are byte-offset based and partial trailing lines remain buffered | unit | `pnpm -F @ahp-viewer/host-node test src/tail-reader.test.ts` | Yes | green |
| 04-W1-tail-reset | 04-02 | 1 | INGEST-04 | V12-FILE-03 | Shrink/rename/replacement emits visible reset state instead of silent ignore | unit | `pnpm -F @ahp-viewer/host-node test src/tail-reader.test.ts` | Yes | green |
| 04-W1-watch-error | 04-02 | 1 | INGEST-04 | V7-ERR-02 | Read/watch errors become safe `watch-error` frames and UI-safe codes | integration | `pnpm -F @ahp-viewer/server test src/app-state.test.ts` | Yes | green |
| 04-W2-session-manager | 04-03 | 2 | INGEST-02, INGEST-03, INGEST-04 | V4-AC-01 | Server can run with no active log, switch logs, and dispose old watchers | integration | `pnpm -F @ahp-viewer/server test src/session-manager.test.ts` | Yes | green |
| 04-W3-picker-ui | 04-04 | 3 | INGEST-02, INGEST-03 | V7-ERR-01 | Picker/manual-open UI never renders absolute paths and maps errors to fixed copy | jsdom | `pnpm -F @ahp-viewer/ui test src/components/states/NoActiveLogState.test.tsx` | Yes | green |
| 04-W3-stream-events | 04-05 | 3 | INGEST-04 | V7-ERR-02 | UI distinguishes `rotation`, `log-reset`, and `watch-error` frames | jsdom | `pnpm -F @ahp-viewer/ui test src/transport/sse-client.test.ts` | Yes | green |
| 04-W4-live-pause | 04-06 | 4 | INGEST-05 | UX-STATE-01 | Paused view preserves selection/scroll while pending event count increments | jsdom | `pnpm -F @ahp-viewer/ui test src/components/timeline/TimelineRegion.test.tsx` | Yes | green |
| 04-W4-new-events-pill | 04-06 | 4 | INGEST-05 | UX-STATE-02 | Resume clears pending count and jumps to newest row without clearing filters | jsdom | `pnpm -F @ahp-viewer/ui test src/components/timeline/NewEventsPill.test.tsx` | Yes | green |
| 04-W5-vertical-slice | 04-07 | 5 | INGEST-02, INGEST-03, INGEST-04, INGEST-05, SEARCH-05 | ALL | Discover/open/tail/pause/resume/reload restore flow works end-to-end | integration | `pnpm test -- test/phase4-vertical-slice.test.ts` | Yes | green |

---

## Wave 0 Requirements

- [x] `packages/host-node/src/discovery.test.ts` — fixtures for VS Code log roots, scoring, bounded traversal, no-path candidate output.
- [x] `packages/server/src/session-manager.test.ts` — lifecycle fixture for no active log, direct-open initializer, switch, dispose, and current metadata.
- [x] `packages/server/src/session-routes.test.ts` — discover/open endpoints and safe error-code mapping.
- [x] `packages/server/src/log-key.test.ts` — stable sanitized log key generation using Node `crypto`.
- [x] `packages/ui/src/state/persistence.test.ts` — localStorage hydration, schema validation, LRU cap, and stale selected-row cleanup.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresh no-file launch renders polished no-log picker | INGEST-02, INGEST-03 | Visual polish and theme fit require browser inspection | Start the app with no log path, open it with Playwright CLI, capture `screenshots/phase4-no-log-state.png`. |
| Discovered-candidate picker is dense and path-safe | INGEST-02 | Candidate visual hierarchy and no-path surfaces need screenshot review | Use mock/discovery fixture data, capture `screenshots/phase4-discovered-candidates.png`. |
| Manual-open validation copy is safe and helpful | INGEST-03 | Error copy must be visually checked for no path echo | Enter an invalid path and capture `screenshots/phase4-manual-open-error.png`. |
| Live pause affordance preserves reading context | INGEST-05 | Scroll/selection behavior is user-perceptual | Pause live follow, append fixture events, capture `screenshots/phase4-live-paused.png`. |
| Rotation/watch banner is visually distinct | INGEST-04 | Banner severity and copy require visual confirmation | Trigger truncate/rotation fixture, capture `screenshots/phase4-rotation-banner.png`. |
| Per-log persistence restores view state after reload | SEARCH-05 | Browser storage and route reload behavior are easiest to validate in-browser | Set filters/grouping/selection, reload, capture `screenshots/phase4-persisted-restore.png`. |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references above.
- [x] No watch-mode flags in validation commands.
- [x] Browser UAT screenshots captured for all manual-only rows.
- [x] `nyquist_compliant: true` set in frontmatter after Wave 0 tests exist and pass.

**Approval:** passed
