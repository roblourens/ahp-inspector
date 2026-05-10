---
phase: 14
slug: hardening-state-diagnostics-scrolling-and-parsing-row-highlight
status: backfilled
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
backfilled: true
backfill_note: "Retroactively created during v1.1 milestone audit; phase already executed."
---

# Phase 14 — Validation Strategy

> Per-phase Nyquist validation contract for the v1.1 hardening pass: state diagnostics scrolling, row-highlight precedence, smarter notification summaries, and search ergonomics.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Playwright |
| **Config file** | root `vitest.config.ts`, `packages/ui/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm test -- packages/ui/src/components packages/core/src/row-projection.test.ts` |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm lint && pnpm e2e -- e2e/phase14.spec.ts` |
| **Estimated runtime** | repo-standard |

## Sampling Rate

- After every task commit: focused unit run for the modified component or core helper.
- After every plan wave: `pnpm test` and `pnpm typecheck`.
- Before `/gsd-verify-work`: full unit suite + Phase 14 Playwright spec green.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | (HARDEN-01) | n/a | Diagnostics list caps height + scrolls; long messages wrap without overflowing the panel | unit | `pnpm test -- packages/ui/src/components/detail/StateInspectorPanel.test.tsx` | ✅ | ✅ green |
| 14-02-01 | 02 | 2 | (HARDEN-02) | n/a | Row-highlight precedence is `selected > pair-highlight > search-match`; no conflicting `outline` rule | unit | `pnpm test -- packages/ui/src/components/timeline/EventRow.columns.test.tsx packages/ui/src/components/timeline/EventRow.orphan.test.tsx` | ✅ | ✅ green |
| 14-03-01 | 03 | 3 | (HARDEN-03) | n/a | Notification summaries extract structured fields (`state`/`status`, `message`/`text`/`detail`/`reason`); never inject HTML | unit | `pnpm test -- packages/core/src/row-projection.test.ts` | ✅ | ✅ green |
| 14-04-01 | 04 | 4 | (HARDEN-04) | n/a | Enter/Shift+Enter dispatches existing `ahp-search-nav` CustomEvent; selected match scrolls to center; tail-follow disabled while navigating | unit | `pnpm test -- packages/ui/src/components/filters/FilterBar.test.tsx packages/ui/src/components/timeline/TimelineList.virt.test.tsx packages/ui/src/components/timeline/TimelineRegion.test.tsx` | ✅ | ✅ green |
| 14-04-02 | 04 | 4 | (HARDEN-01..04) | n/a | End-to-end coverage in browser context | e2e | `pnpm e2e -- e2e/phase14.spec.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Phase 14 plans did not include explicit STRIDE threat tables. The hardening surface is purely client-rendering and helper-string; it introduces no network, persistence, or message-protocol changes. The relevant guardrails (no `dangerouslySetInnerHTML`, no path leakage, no telemetry) are upheld by the existing `test/security.test.ts` and `test/boundary.test.ts` gates that run as part of the full suite.

## Wave 0 Requirements

- [x] `packages/ui/src/styles/global.css` — diagnostics scroll/wrap rules.
- [x] `packages/ui/src/components/detail/StateDiagnosticsPanel.tsx` — meta + message split.
- [x] `packages/ui/src/components/timeline/EventRow.tsx` — precedence + rail-cell highlight.
- [x] `packages/core/src/row-projection.ts` — notification field extraction.
- [x] `packages/ui/src/components/filters/SearchInput.tsx` — Enter/Shift+Enter handler.
- [x] `packages/ui/src/components/timeline/TimelineList.tsx` — scroll-to-center on selected match.
- [x] `e2e/phase14.spec.ts` — Playwright regression spec.

## Manual-Only Verifications

The 14-UAT.md script captures user-experience scenarios for the four hardening behaviors. All four behaviors also have automated coverage; manual UAT remains useful for visual review but is not a Nyquist gate.

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all baseline references
- [x] No watch-mode flags
- [x] Feedback latency controlled via focused package commands
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** backfilled and approved 2026-05-09 during v1.1 milestone audit.
