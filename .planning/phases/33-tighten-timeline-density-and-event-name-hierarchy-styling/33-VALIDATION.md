---
phase: 33
slug: tighten-timeline-density-and-event-name-hierarchy-styling
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-22
---

# Phase 33 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + jsdom; Playwright 1.59.1 for E2E screenshots |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx packages/ui/src/components/timeline/TimelineList.virt.test.tsx packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/no-hex-in-components.test.ts` |
| **Full suite command** | `pnpm test && pnpm -F @ahp-inspector/ui build && pnpm typecheck && pnpm lint` |
| **Estimated runtime** | ~60 seconds quick, full suite project-dependent |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx packages/ui/src/components/timeline/TimelineList.virt.test.tsx packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/no-hex-in-components.test.ts`
- **After every plan wave:** Run `pnpm test && pnpm -F @ahp-inspector/ui build && pnpm typecheck && pnpm lint`
- **Before `/gsd-verify-work`:** Full suite plus Phase 33 Playwright fixture screenshots must be green
- **Max feedback latency:** 60 seconds for quick checks

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 0 | EVENTNAME-33-02 | T-33-01 | Event labels are rendered as React text spans, not HTML | component | `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx` | yes update | pending |
| 33-01-02 | 01 | 0 | DENSITY-33-01 | T-33-03 | Virtualized row estimate and rendered row height stay aligned | unit | `pnpm vitest run packages/ui/src/components/timeline/TimelineList.virt.test.tsx` | yes update | pending |
| 33-01-03 | 01 | 0 | THEME-33-03 | T-33-04 | Prefix color is tokenized for dark/light/hacker themes | style | `pnpm vitest run packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/no-hex-in-components.test.ts` | yes update | pending |
| 33-02-01 | 02 | 1 | DENSITY-33-01 | T-33-03 | Timeline density changes do not break large-log virtualization | unit | `pnpm vitest run packages/ui/src/components/timeline/TimelineList.virt.test.tsx` | yes | pending |
| 33-02-02 | 02 | 1 | EVENTNAME-33-02 | T-33-01 | `foo/` prefix remains readable while leaf stays primary | component | `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx` | yes | pending |
| 33-03-01 | 03 | 2 | PRIVACY-33-04 | T-33-02 | Screenshots use synthetic fixtures and contain no absolute path leakage | e2e | `pnpm e2e -- e2e/phase33.spec.ts` | no W0 | pending |

*Status: pending, green, red, flaky*

---

## Wave 0 Requirements

- [ ] `packages/ui/src/components/timeline/EventRow.columns.test.tsx` - add hierarchical event-name prefix/leaf assertions.
- [ ] `packages/ui/src/components/timeline/TimelineList.virt.test.tsx` - assert 24px row estimate/rendered style alignment.
- [ ] `packages/ui/src/styles/theme-tokens.test.ts` - require `--color-event-name-prefix` for dark/light/hacker themes if that token is introduced.
- [ ] `e2e/phase33.spec.ts` - fixture-only visual evidence for dark/light/hacker density and event-name styling.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Density feels close to Chrome DevTools without looking cramped | DENSITY-33-01 | Visual polish threshold is subjective | Review Phase 33 fixture screenshots in dark/light/hacker themes at desktop width. |
| Event-name prefix is "very slightly grayed out" but still readable | EVENTNAME-33-02 | Subtle contrast is visual and theme-dependent | Inspect `foo/bar` and deeper `foo/bar/baz` fixture rows across all themes. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s for quick checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-22 for planning
