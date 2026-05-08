---
phase: 05
slug: themes-polish-and-verification
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-08
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + jsdom 29.1.1 + Testing Library React 16.3.2; Playwright recommended for browser E2E |
| **Config file** | `vitest.config.ts`, `packages/ui/vitest.config.ts`; `playwright.config.ts` if added in Wave 0 |
| **Quick run command** | `pnpm -F @ahp-viewer/ui test` |
| **Full suite command** | `pnpm test && pnpm -F @ahp-viewer/ui build && pnpm -F @ahp-viewer/cli build && pnpm typecheck && pnpm lint` |
| **Runtime policy** | Run the focused verification after each plan and the full gate at phase end |

---

## Sampling Rate

- **After every task commit:** Run the narrowest affected Vitest file(s), plus the static token/color guard for theme/layout tasks.
- **After every plan wave:** Run `pnpm -F @ahp-viewer/ui test` and any added E2E smoke relevant to the wave.
- **Before `/gsd-verify-work`:** Full suite must be green, and browser UAT screenshots must exist for all required themes/viewports.
- **Max feedback latency:** Keep per-task automated checks narrow enough to run inside the current execution turn.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-W0-token-guard | 05-00 | 0 | THEME-02 | T-05-01 | Components cannot introduce raw color literals outside tokens. | static/unit | `pnpm -F @ahp-viewer/ui test src/styles/no-hex-in-components.test.ts` | yes | green |
| 05-W0-token-complete | 05-00 | 0 | THEME-01, THEME-02, THEME-03 | T-05-02 | Dark/light/hacker define the required semantic token set. | unit/static | `pnpm -F @ahp-viewer/ui test src/styles/theme-tokens.test.ts` | yes | green |
| 05-W0-e2e | 05-00 | 0 | VERIFY-03 | T-05-03 | Browser E2E can run locally without exposing paths or outbound runtime dependencies. | e2e | `pnpm e2e` | yes | green |
| 05-layout | 05-01 | 1 | THEME-05 | T-05-04 | Detail panel does not crush the timeline at laptop widths; ultra-wide remains balanced. | unit/e2e/UAT | `pnpm -F @ahp-viewer/ui test src/components/shell/AppShell.test.tsx` plus E2E viewport test | yes | green |
| 05-theme-polish | 05-02 | 2 | THEME-01, THEME-02, THEME-03 | T-05-05 | Theme colors/effects are token-driven, accessible, and reduced-motion aware. | unit/browser/UAT | `pnpm -F @ahp-viewer/ui test src/components/shell/HeaderBar.test.tsx src/styles/*.test.ts` | yes | green |
| 05-persistence | 05-03 | 3 | THEME-04 | T-05-06 | Theme and viewer prefs persist without storing log content, paths, prompts, or raw payloads. | unit/e2e | `pnpm -F @ahp-viewer/ui test src/persistence/persist-effect.test.ts src/state/persistence.test.ts src/components/shell/HeaderBar.test.tsx` | yes | green |
| 05-ui-coverage | 05-04 | 4 | VERIFY-02 | T-05-07 | UI flows are covered at app/integration level, not only isolated components. | component/integration | `pnpm -F @ahp-viewer/ui test` | yes | green |
| 05-browser-gate | 05-05 | 5 | VERIFY-03 | T-05-08 | Browser opens fixture, filters/searches, expands details, switches themes, and observes appended events. | e2e/UAT | `pnpm e2e` plus UAT screenshot capture | yes | green |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [x] `packages/ui/src/styles/no-hex-in-components.test.ts` — expand raw color guard beyond quoted hex.
- [x] `packages/ui/src/styles/theme-tokens.test.ts` — verify dark/light/hacker token completeness.
- [x] `playwright.config.ts` + E2E support files — `@playwright/test` accepted and installed.
- [x] `package.json` scripts — `e2e` command added.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Final visual polish across light/dark/hacker | THEME-01, THEME-03 | Automated tests can detect wiring and token coverage, but aesthetics require visual review. | Capture screenshots at planned viewports and inspect timeline, details, filters, banners, picker, and Pretty JSON. |
| Ultra-wide visual balance | THEME-05 | jsdom cannot measure real layout; browser screenshots catch empty-space and density issues. | Capture 1920x1080 and 2560x1440 views with detail open and filters active. |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency documented from actual runs
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** passed
