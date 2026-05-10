---
phase: 12
slug: search-rather-than-filter
status: backfilled
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
backfilled: true
backfill_note: "Retroactively created during v1.1 milestone audit; phase already executed."
---

# Phase 12 — Validation Strategy

> Per-phase Nyquist validation contract for the search-rather-than-filter UX rework.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Playwright |
| **Config file** | root `vitest.config.ts`, `packages/ui/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm test -- packages/ui/src/state packages/ui/src/components/filters` |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm lint && pnpm e2e -- e2e/phase12.spec.ts` |
| **Estimated runtime** | repo-standard |

## Sampling Rate

- After every task commit: focused unit run for the modified directory.
- After every plan wave: `pnpm test` and `pnpm typecheck`.
- Before `/gsd-verify-work`: full unit suite + Phase 12 Playwright spec green.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | (UX) | T-12-01-01 | Preserve debouncing, abort handling, server query cap, result cap | unit | `pnpm test -- packages/ui/src/components/filters/useSearch packages/ui/src/transport/search-client.test.ts` | ✅ | ✅ green |
| 12-01-02 | 01 | 1 | (UX) | T-12-01-02 | Server match indexes intersect with existing/visible rows | unit | `pnpm test -- packages/ui/src/state/selectors.test.ts packages/ui/src/state/store.test.ts` | ✅ | ✅ green |
| 12-01-03 | 01 | 1 | (UX) | T-12-01-03 | Search query persistence remains local-only; no new outbound path | unit | `pnpm test -- packages/ui/src/state/persistence.test.ts` | ✅ | ✅ green |
| 12-02-01 | 02 | 2 | (UX) | T-12-02-01 | Highlighting uses React text/mark nodes; no `dangerouslySetInnerHTML` | unit | `pnpm test -- packages/ui/src/components/timeline/EventRow.columns.test.tsx` | ✅ | ✅ green |
| 12-02-02 | 02 | 2 | (UX) | T-12-02-02 | Navigation ignores match indexes not in current/facet-visible rows | unit | `pnpm test -- packages/ui/src/components/timeline/TimelineRegion.test.tsx packages/ui/src/components/filters/FilterBar.test.tsx` | ✅ | ✅ green |
| 12-02-03 | 02 | 2 | (UX) | T-12-02-03 | Virtualization preserved; offscreen markers not rendered as full rows | unit | `pnpm test -- packages/ui/src/components/timeline/TimelineList.virt.test.tsx` | ✅ | ✅ green |
| 12-03-01 | 03 | 3 | (UX) | T-12-03-01 | Volatile search match indexes are not persisted | unit | `pnpm test -- packages/ui/src/state/persistence.test.ts packages/ui/src/persistence/persist-effect.test.ts` | ✅ | ✅ green |
| 12-03-02 | 03 | 3 | (UX) | T-12-03-02 | Docs keep logs and queries local; no telemetry language | static | `git grep -nE "telemetry|remote search" USER_GUIDE.md README.md` (expect empty) | ✅ | ✅ green |
| 12-03-03 | 03 | 3 | (UX) | T-12-03-03 | Phase 12 E2E fixture is small and focused | e2e | `pnpm e2e -- e2e/phase12.spec.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Phase 12 was a UX/architecture refactor and registered no new REQ-IDs. Each task maps to a STRIDE threat from the 12-0x-PLAN.md threat tables.

## Wave 0 Requirements

- [x] `packages/ui/src/state/store.ts` — search-result metadata separate from filter state.
- [x] `packages/ui/src/state/selectors.ts::useVisibleSearchMatches` — facet × search intersection helper.
- [x] `packages/ui/src/components/filters/FilterBar.tsx` — search status, count, navigation controls.
- [x] `packages/ui/src/state/persistence.ts` — sanitize-on-hydrate for volatile match metadata.
- [x] `e2e/phase12.spec.ts` — Playwright regression spec.

## Manual-Only Verifications

None — all behaviors are covered by unit + persistence + Playwright tests.

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all baseline references
- [x] No watch-mode flags
- [x] Feedback latency controlled via focused package commands
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** backfilled and approved 2026-05-09 during v1.1 milestone audit.
