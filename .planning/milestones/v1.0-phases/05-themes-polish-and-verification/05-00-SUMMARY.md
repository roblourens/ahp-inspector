---
phase: 05-themes-polish-and-verification
plan: 00
subsystem: guardrails
tags: [themes, playwright, tests]
requires: []
provides: [playwright-e2e-infra, raw-color-guard, theme-token-baseline]
affects: [package.json, pnpm-lock.yaml, playwright.config.ts, e2e/phase5.spec.ts, packages/ui/src/styles]
tech_stack:
  added: ["@playwright/test"]
  patterns: ["token-first theme guardrails", "local-only Playwright config"]
key_files:
  created: [playwright.config.ts, e2e/phase5.spec.ts, packages/ui/src/styles/theme-tokens.test.ts]
  modified: [package.json, pnpm-lock.yaml, packages/ui/src/styles/no-hex-in-components.test.ts]
decisions:
  - "Use @playwright/test as the committed browser E2E runner with Chromium-only local execution."
metrics:
  completed: 2026-05-08T04:45:00Z
  tasks: 3
---

# Phase 05 Plan 00: Guardrails and Playwright Setup Summary

Phase 5 now has committed browser E2E infrastructure and automated token/color guardrails before visual polish begins.

## Completed Tasks

| Task | Result | Key Files |
|------|--------|-----------|
| Add committed Playwright setup | Added root `e2e` scripts, `@playwright/test`, and a Chromium-only local config. | `package.json`, `pnpm-lock.yaml`, `playwright.config.ts`, `e2e/phase5.spec.ts` |
| Expand raw color guard | Reworked the guard to scan UI source and reject raw hex, rgb/rgba, and hsl/hsla literals outside tokenized styles. | `packages/ui/src/styles/no-hex-in-components.test.ts` |
| Add theme token completeness guard | Added a shared baseline token list for dark/light/hacker blocks. | `packages/ui/src/styles/theme-tokens.test.ts` |

## Verification

- `pnpm install --lockfile-only` — passed
- `pnpm exec playwright test --list` — passed
- `pnpm -F @ahp-inspector/ui test src/styles/no-hex-in-components.test.ts src/styles/theme-tokens.test.ts` — passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a skipped placeholder E2E spec for Playwright discovery**
- **Found during:** Plan 05-00 verification
- **Issue:** `pnpm exec playwright test --list` exits non-zero when no tests exist.
- **Fix:** Added a skipped `e2e/phase5.spec.ts` placeholder that Plan 05-05 replaces with full browser UAT.
- **Files modified:** `e2e/phase5.spec.ts`

## Known Stubs

- `e2e/phase5.spec.ts` contains an intentional skipped placeholder so Playwright discovery is green before Plan 05-05 implements full E2E coverage.

## Threat Flags

None. Playwright is dev/test-only and uses local reporters only.

## Self-Check: PASSED

- Created files exist: `playwright.config.ts`, `e2e/phase5.spec.ts`, `packages/ui/src/styles/theme-tokens.test.ts`
- Guardrail verification passed.
