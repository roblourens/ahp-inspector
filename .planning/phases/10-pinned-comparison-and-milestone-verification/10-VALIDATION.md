---
phase: 10
slug: pinned-comparison-and-milestone-verification
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x, React Testing Library, Playwright |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm test -- packages/ui/src/components/detail/PinnedStatePanel.test.tsx packages/ui/src/components/detail/state-compare.test.ts test/boundary.test.ts` |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm lint` |
| **E2E command** | `pnpm e2e` |

---

## Sampling Rate

- **After every task commit:** Run the focused command for the touched component/helper plus `test/boundary.test.ts`.
- **After every plan wave:** Run `pnpm test && pnpm typecheck && pnpm lint`.
- **Before phase verification:** Full suite, E2E, and browser screenshot smoke must be green.
- **Max feedback latency:** Use focused Vitest commands for component/helper iterations; defer Playwright to plan 10-03 and phase verification.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 10-01 | 1 | COMPARE-01 | T-10-01-01 | Pins are explicit user actions and memory-only. | component/unit | `pnpm test -- packages/ui/src/components/detail/StateInspectorPanel.test.tsx packages/ui/src/components/detail/PinnedStatePanel.test.tsx test/boundary.test.ts` | ✅ | ⬜ pending |
| 10-01-02 | 10-01 | 1 | COMPARE-01, COMPARE-03 | T-10-01-02 | Pins reset on log switch and preserve resource context. | component/unit | `pnpm test -- packages/ui/src/components/detail/PinnedStatePanel.test.tsx test/boundary.test.ts` | ✅ | ⬜ pending |
| 10-02-01 | 10-02 | 2 | COMPARE-02, COMPARE-03 | T-10-02-01 | Comparison is local, top-level-only, and confidence-labelled. | unit/component | `pnpm test -- packages/ui/src/components/detail/state-compare.test.ts packages/ui/src/components/detail/PinnedStatePanel.test.tsx test/boundary.test.ts` | ✅ | ⬜ pending |
| 10-02-02 | 10-02 | 2 | COMPARE-02 | T-10-02-02 | Large/complex states do not trigger recursive deep diff. | unit | `pnpm test -- packages/ui/src/components/detail/state-compare.test.ts` | ✅ | ⬜ pending |
| 10-03-01 | 10-03 | 3 | VERIFY-03 | T-10-03-01 | Browser flow covers state inspection, pinning, comparison, and diagnostics without path leakage. | e2e | `pnpm e2e` | ✅ | ⬜ pending |
| 10-03-02 | 10-03 | 3 | VERIFY-04 | T-10-03-02 | Large-log state-at lookup remains lazy and SSE frames exclude replay payload fields. | integration | `pnpm test -- test/sse-integration.test.ts` | ✅ | ⬜ pending |
| 10-03-03 | 10-03 | 3 | VERIFY-03 | — | User guide and screenshots reflect the completed reducer-backed workflow. | docs/smoke | `pnpm test && pnpm typecheck && pnpm lint` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- Vitest + jsdom component tests already run through root `vitest.config.ts`.
- `@testing-library/jest-dom/vitest` is registered in `packages/ui/src/test-setup.ts`.
- Playwright E2E infrastructure exists in `e2e/phase5.spec.ts`.
- Boundary guard exists in `test/boundary.test.ts`.
- SSE integration patterns exist in `test/sse-integration.test.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual polish of pinned comparison in dark/light/hacker themes | VERIFY-03 | Screenshots supplement automated DOM assertions. | Start the local fixture, pin two state points, inspect comparison, switch all three themes, and save screenshots under `screenshots/phase10/`. |
| Documentation screenshot freshness | VERIFY-03 | Requires human-readable guide review. | Confirm `USER_GUIDE.md` embeds fresh Phase 10 screenshots and describes pinning/comparison. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-08
