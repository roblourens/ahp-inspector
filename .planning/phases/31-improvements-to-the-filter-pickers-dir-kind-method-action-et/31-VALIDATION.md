---
phase: 31
slug: improvements-to-the-filter-pickers-dir-kind-method-action-et
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-11
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + React Testing Library 16.3.2; Playwright 1.59.1 for browser geometry and fixture evidence |
| **Config file** | `vitest.config.ts`, `packages/ui/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm lint` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx`
- **After every plan wave:** Run `pnpm --filter @ahp-inspector/ui typecheck && pnpm --filter @ahp-inspector/ui build && pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx`
- **Before `/gsd-verify-work`:** Run `pnpm --filter @ahp-inspector/ui build && pnpm exec playwright test e2e/phase31.spec.ts e2e/phase25.spec.ts --project=chromium`, inspect all saved fixture screenshots, then run the full suite
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | Contextual complete-set bulk toggle; remove Close; deterministic visible-label sorting | — | Bulk action operates on complete facet options and does not alter persistence semantics | component | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` | ✅ | ⬜ pending |
| 31-01-02 | 01 | 1 | Search-input and Group: Session selected-background containment | — | Local border-box fixes avoid application-wide layout changes | component | `pnpm exec vitest run packages/ui/src/components/filters/FilterBar.test.tsx` | ✅ | ⬜ pending |
| 31-02-01 | 02 | 2 | Fixture-only desktop/narrow interaction, geometry, visual proof, and stale-contract Phase 25 compatibility | — | Saved evidence uses synthetic fixture data and reveals no absolute path | e2e | `pnpm --filter @ahp-inspector/ui build && pnpm exec playwright test e2e/phase31.spec.ts e2e/phase25.spec.ts --project=chromium` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/phase31.spec.ts` — add fixture-only contextual-action, deterministic-order, narrow-input, Group: Session background, viewport-containment, screenshot, and path-leak proof.
- [ ] `screenshots/phase31/` — populate only from synthetic fixture data when the Phase 31 Playwright flow runs.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual polish across Dark, Light, and Hacker themes | Picker layout goal | Bounding-box assertions prove containment but not final visual quality | Inspect every Phase 31 fixture screenshot for clipping, incoherent overlap, selected-background bleed, and token/theme regressions. |

---

## Validation Sign-Off

- [x] All tasks have automated verification or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
