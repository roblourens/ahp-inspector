---
phase: 03
slug: detail-search-and-filtering
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-07
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for detail, search, filtering, and grouping.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + jsdom for UI package tests |
| **Config file** | `vitest.config.ts`, `packages/ui/vitest.config.ts` |
| **Quick run command** | `pnpm -F @ahp-inspector/<pkg> test` for changed package |
| **Full suite command** | `pnpm test && pnpm -F @ahp-inspector/ui build && pnpm -F @ahp-inspector/cli build && pnpm typecheck && pnpm lint` |
| **Browser UAT** | `playwright-cli` against Chrome, screenshots committed under `screenshots/phase3-*` |

---

## Sampling Rate

- **After every task commit:** Run the package-scoped test command for touched code.
- **After every plan wave:** Run `pnpm test`.
- **Before `/gsd-verify-work`:** Full suite command must be green and browser UAT must be recorded.
- **Max feedback latency:** One task; no three consecutive tasks may lack automated verification.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-W0-01 | Wave 0 | 0 | EVENT-06 | T-03-05 | Additive EventRow fields only; no raw payload inflation in SSE | unit | `pnpm -F @ahp-inspector/core test src/row-projection.test.ts` | ❌ W0 | ⬜ pending |
| 03-W1-02 | Detail/Search API | 1 | DETAIL-02, SEARCH-01 | T-03-07 | Detail/search endpoints bounds-check idx and cap query length | integration | `pnpm -F @ahp-inspector/server test src/detail-routes.test.ts src/search-routes.test.ts` | ❌ W1 | ⬜ pending |
| 03-W0-03 | Wave 0 | 0 | DETAIL-03 | T-03-03 | `react-json-view-lite` allow-listed and checked for no eval/new Function | security | `pnpm test test/security.test.ts` | ❌ W0 | ⬜ pending |
| 03-W1-01 | Detail API | 1 | DETAIL-01, DETAIL-02 | T-03-05, T-03-07 | Lazy detail fetch returns bounded payload and correlation metadata | integration | `pnpm -F @ahp-inspector/server test src/detail-routes.test.ts` | ❌ W1 | ⬜ pending |
| 03-W2-01 | Detail UI | 2 | DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04 | T-03-03, T-03-04 | Text-only JSON rendering, explicit clipboard action, truncation banner | jsdom | `pnpm -F @ahp-inspector/ui test src/components/detail/DetailPanel.test.tsx` | ❌ W2 | ⬜ pending |
| 03-W3-01 | Facets | 3 | SEARCH-02, SEARCH-03, SEARCH-04 | T-03-01 | Facet selectors are deterministic and non-blocking under 50k rows | jsdom/perf | `pnpm -F @ahp-inspector/ui test src/state/selectors.test.ts src/state/selectors.perf.test.ts` | ❌ W3 | ⬜ pending |
| 03-W4-01 | Search API/UI | 4 | SEARCH-01, SEARCH-03 | T-03-01, T-03-02, T-03-08 | Substring-only query, 256-char query cap, 5000 result cap, abortable requests | integration/jsdom | `pnpm -F @ahp-inspector/server test src/search-routes.test.ts && pnpm -F @ahp-inspector/ui test src/transport/search-client.test.ts` | ❌ W4 | ⬜ pending |
| 03-W5-01 | Grouping | 5 | TIME-05, EVENT-06 | T-03-05 | Group headers preserve virtualization; serverSeq gaps/auth failures surfaced | jsdom/unit | `pnpm -F @ahp-inspector/ui test src/components/timeline/grouping.test.tsx && pnpm -F @ahp-inspector/core test src/row-projection.test.ts` | ❌ W5 | ⬜ pending |
| 03-W6-01 | Vertical slice | 6 | TIME-04, TIME-05, DETAIL-*, SEARCH-*, EVENT-06 | all | Open fixture, search, filter, group, select, inspect detail without regressions | integration | `pnpm test test/phase3-vertical-slice.test.ts` | ❌ W6 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install `react-json-view-lite@2.5.0` and add it to `test/security.test.ts` dependency allow-list.
- [ ] Extend row projection tests for `errorCode`, `serverSeq`, `gapBefore`, and `isAuthFailure`.
- [ ] Confirm Plan 03-01 creates failing server tests for `GET /api/log/event/:idx` and `GET /api/log/search` before implementation.
- [ ] Confirm Plan 03-04 creates failing UI tests for detail panel selection, raw/pretty toggle, truncation, copy, and field highlights before implementation.
- [ ] Confirm Plan 03-02 creates selector/filter performance tests with a 50,000-row synthetic data set before implementation.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Detail panel usability | DETAIL-01–04 | Visual density, truncation copy, and folded JSON readability require browser review | Use `playwright-cli` to open a synthetic fixture, select request/response/action/error rows, capture `screenshots/phase3-detail-*.png` |
| Search/filter typing feel | SEARCH-01–04 | jsdom perf catches gross regressions but not user-perceived input latency | Type a 20+ char search in browser while a 50k-row fixture is loaded; capture `screenshots/phase3-search-filter.png` |
| Grouped story mode scanability | TIME-05, EVENT-06 | Group header hierarchy and gap/auth badges are visual UX | Toggle session/turn grouping, scroll, and capture `screenshots/phase3-grouped-story.png` |

---

## Validation Sign-Off

- [x] All phase requirements have planned automated coverage.
- [x] Sampling continuity defined for each task/wave.
- [x] Wave 0 covers the shared dependency/security/EventRow foundation; each feature wave owns its red-to-green test scaffold.
- [x] No watch-mode flags in validation commands.
- [x] Full phase gate includes test, builds, typecheck, lint, and browser UAT.

**Approval:** approved 2026-05-07
