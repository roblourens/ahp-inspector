---
phase: 23
slug: hacker-theme-crt-overhaul
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Playwright |
| **Config file** | `vitest.config.ts`, `packages/ui/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/reduced-motion-css.test.ts packages/ui/src/theme/theme.test.ts` |
| **Quick Phase 23 smoke command** | `pnpm exec playwright test e2e/phase23.spec.ts --grep "CRT smoke"` |
| **Full suite command** | `pnpm -F @ahp-inspector/ui test && pnpm exec playwright test e2e/phase23.spec.ts && pnpm -F @ahp-inspector/ui build && pnpm -F @ahp-inspector/extension build && pnpm exec vitest run packages/extension/src/__test__/webviewHtml.test.ts` |
| **Estimated runtime** | Quick smoke should return materially faster than the ~120 second screenshot/evidence pass; the full gate keeps the heavier fixture and parity evidence intact. |

---

## Sampling Rate

- **After every task commit:** Run `pnpm exec vitest run packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/reduced-motion-css.test.ts packages/ui/src/theme/theme.test.ts`
- **After Plan 23-01 CRT placement work or displacement retuning:** Run `pnpm exec playwright test e2e/phase23.spec.ts --grep "CRT smoke"`
- **After every plan wave:** Run `pnpm -F @ahp-inspector/ui test && pnpm exec playwright test e2e/phase23.spec.ts`
- **After Plan 23-03 webview parity work:** Run `pnpm -F @ahp-inspector/ui build && pnpm -F @ahp-inspector/extension build && pnpm exec vitest run packages/extension/src/__test__/webviewHtml.test.ts`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** quick smoke first for iteration; ~120 seconds remains acceptable for the final screenshot/evidence pass

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | Phase context D-01..D-04 | T-23-01 | Visual-only overlays remain noninteractive and bundled | unit / E2E smoke | `pnpm exec vitest run packages/ui/src/theme/theme.test.ts` | Existing theme test yes; dedicated E2E no | ⬜ pending |
| 23-02-01 | 02 | 2 | Phase context D-05..D-12 | T-23-02 | Reduced-motion removes animation while static CRT remains | CSS contract | `pnpm exec vitest run packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/reduced-motion-css.test.ts` | Existing files need revision | ⬜ pending |
| 23-03-01 | 03 | 3 | Phase context D-13..D-16 | T-23-03 | Fixture-only screenshots and shared runtime parity remain local | quick smoke + E2E / evidence | `pnpm exec playwright test e2e/phase23.spec.ts --grep "CRT smoke" && pnpm exec playwright test e2e/phase23.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 23-03-02 | 03 | 3 | Phase context D-16 | T-23-03 | Extension delivery keeps the same CRT SVG/filter/compositing surface as the shared UI bundle | extension build + parity unit | `pnpm -F @ahp-inspector/ui build && pnpm -F @ahp-inspector/extension build && pnpm exec vitest run packages/extension/src/__test__/webviewHtml.test.ts` | Existing HTML test yes; copied-bundle parity assertion pending | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/phase23.spec.ts` — fixture-backed quick `CRT smoke` assertion plus warped-interaction and screenshot scenario for Hacker CRT.
- [ ] `packages/ui/src/styles/theme-tokens.test.ts` — update assertions that encode the older restrained Hacker intensity contract.
- [ ] `packages/ui/src/styles/reduced-motion-css.test.ts` — assert every new Phase 23 Hacker animation is removed under reduced motion while static CRT styling remains.
- [ ] `packages/extension/src/__test__/webviewHtml.test.ts` — retain local webview HTML/CSP assertions and add copied `packages/extension/ui-dist/assets/` inspection for `crt-filter-defs`, `crt-display-surface`, `ahp-crt-warp`, `feDisplacementMap`, and the Hacker compositing CSS route, matching the resolved D-16 parity gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Final CRT intensity feels aggressively intentional rather than accidentally broken | Phase context D-04, D-06 | Aesthetic threshold is judgment-based even when screenshots exist | Review fixture screenshots in `screenshots/phase23/` at desktop and drawer/mobile-ish layouts; confirm full-screen warp, dark tube edge, and bold analog character are clearly present. |
| Pointer alignment remains acceptable at the chosen displacement strength | Phase context D-01, D-02 | Automated click tests prove targetability, but visual trust still needs eyeballing | In fixture UI, click the theme picker, a timeline row, drawer close, and search field while visually assessing whether hit targets appear dishonest. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Quick `CRT smoke` feedback is available before the ~120s final screenshot/evidence pass
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
