---
phase: 34
slug: rethink-search-result-navigation-and-focus-behavior
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-27
---

# Phase 34 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + jsdom + Testing Library; Playwright for end-to-end browser coverage |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm vitest run packages/ui/src/components/filters packages/ui/src/components/shell packages/ui/src/components/detail packages/ui/src/components/timeline` |
| **Full suite command** | `pnpm test && pnpm -r typecheck && pnpm lint && pnpm e2e -- e2e/phase34.spec.ts` |
| **Estimated runtime** | ~60 seconds quick; full suite project-dependent |

---

## Sampling Rate

- **After every task commit:** Run the targeted Vitest file(s) for the touched search, shell, detail, or timeline component.
- **After every plan wave:** Run `pnpm test && pnpm -r typecheck && pnpm lint`.
- **Before `/gsd-verify-work`:** Full suite and `pnpm e2e -- e2e/phase34.spec.ts` must be green.
- **Max feedback latency:** 60 seconds for quick checks.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 0 | D-06, D-08 | T-34-01, T-34-02 | Shared highlighting renders literal React text nodes and never compiles the query as regex or HTML | unit | `pnpm vitest run packages/ui/src/components/timeline/cells/highlight.test.tsx` | no W0 | pending |
| 34-01-02 | 01 | 1 | D-01, D-02, D-03, D-04 | — | Search selection and explicit inspection remain one selected index with a typed source discriminator | unit | `pnpm vitest run packages/ui/src/state/store.test.ts packages/ui/src/components/shell/AppShell.test.tsx packages/ui/src/components/timeline/TimelineRegion.test.tsx` | yes update | pending |
| 34-02-01 | 02 | 1 | D-07, D-10, D-11, D-12, D-13 | — | Find remains keyboard operable without invoking browser-native find or stealing focus during navigation | component | `pnpm vitest run packages/ui/src/components/filters/FilterBar.test.tsx packages/ui/src/components/filters/SearchPopover.test.tsx packages/ui/src/components/timeline/TimelineRegion.test.tsx` | yes update | pending |
| 34-03-01 | 03 | 2 | D-08, D-09 | T-34-01 | Arbitrary JSON payload text is highlighted through escaped React children; collapsed branches reveal literal matches safely | component | `pnpm vitest run packages/ui/src/components/detail/PrettyJsonView.test.tsx packages/ui/src/components/detail/RawJsonView.test.tsx packages/ui/src/components/detail/DetailPanel.test.tsx` | yes update | pending |
| 34-04-01 | 04 | 3 | D-01..D-13 | T-34-03 | Browser evidence uses synthetic fixtures only and covers wide/narrow focus and drawer behavior | e2e | `pnpm e2e -- e2e/phase34.spec.ts` | no W0 | pending |

*Status: pending, green, red, flaky*

---

## Wave 0 Requirements

- [ ] `packages/ui/src/components/timeline/cells/highlight.test.tsx` - cover case-insensitive, literal, non-overlapping match ranges and escaped React rendering for the extracted shared highlighter.
- [ ] `e2e/phase34.spec.ts` - cover uninterrupted Enter/Shift+Enter navigation, repeated Command+F/Ctrl+F, Escape focus restoration, and wide/narrow detail behavior using `test/fixtures/*.jsonl`.
- [ ] Narrow-screen `window.matchMedia` test helper - simulate the detail breakpoint consistently in AppShell component tests, reusing an existing helper if one is already available.
- [ ] No framework installation - Vitest, Testing Library, and Playwright are already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The pinned find widget remains readable and unobstructed across dark, light, and hacker themes | D-10 | Layering and visual legibility are theme-dependent | Open fixture data at desktop width in each theme, open find, navigate results, and confirm the widget stays above the desktop detail rail without clipping. |
| Revealing the first hidden detail match feels stable rather than resetting unrelated expansion state excessively | D-09 | The acceptable balance between automatic reveal and manual tree state is interaction-sensitive | Navigate between fixture events with nested matches, manually expand/collapse unrelated branches, and confirm only selection/query changes reseed match reveal. |

---

## Validation Sign-Off

- [x] All anticipated tasks have automated verification or Wave 0 dependencies.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Wave 0 covers all missing test references.
- [x] No watch-mode flags.
- [x] Feedback latency target is under 60 seconds for quick checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-06-27 for planning
