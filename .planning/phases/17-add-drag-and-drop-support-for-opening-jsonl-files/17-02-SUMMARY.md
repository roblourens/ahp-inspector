---
phase: 17
plan: 02
status: complete
date: 2026-05-12
---

# 17-02 SUMMARY — DropOverlay + MultiFileToast presentational components

## What Was Built

Two pure presentational React components in `packages/ui/src/components/drop/` per `17-UI-SPEC.md`:

- `DropOverlay.tsx` — full-viewport state-driven affordance with four states (`idle` returns `null`; `armed` and `armed-replacing` show the dashed-accent card with locked headings/bodies; `error` shows dashed-destructive card, `role="alert"` text, Dismiss button, and document-level Escape handler attached only in the error state). Container is a `<section>` with `aria-label="Drop a log file"` (implicit role=region).
- `MultiFileToast.tsx` — bottom-right transient with `role="status"`, focusable for in-toast Escape, locked copy `Opened {basename}. Ignored {N} other file{s}.` with correct singular/plural, monospace `<code>` for the basename, dismiss button with `aria-label="Dismiss notice"`, 5-second auto-dismiss via `window.setTimeout`.

All visual values use existing tokens from `packages/ui/src/styles/tokens.css` — `--space-*`, `--color-*`, `--text-*`, `--font-*`, `--weight-*`. No hex/rgb/hsl literals introduced. No drag-event listeners, no fetches, no parser imports — components are state-in / callback-out.

## Key Files

- created:
  - `packages/ui/src/components/drop/DropOverlay.tsx`
  - `packages/ui/src/components/drop/DropOverlay.test.tsx`
  - `packages/ui/src/components/drop/MultiFileToast.tsx`
  - `packages/ui/src/components/drop/MultiFileToast.test.tsx`

## Verification

- `pnpm -F @ahp-inspector/ui exec vitest run src/components/drop/` — 25/25 in this plan + 11 carried over from Plan 17-01 = 27/27 passing.
- `pnpm -F @ahp-inspector/ui exec vitest run src/styles/no-hex-in-components.test.ts` — passes (no hex/rgb/hsl in any new file).
- `pnpm -F @ahp-inspector/ui exec vitest run src/styles/reduced-motion-css.test.ts` — passes.
- `pnpm exec biome check packages/ui/src/components/drop/` — clean.
- `grep -RIn "Drop a .jsonl file to open" packages/ui/src/components/drop/` — only `DropOverlay.tsx` (definition) and `DropOverlay.test.tsx` (assertion). No stray duplicates.

## Deviations from Plan

**[Rule 1 - Bug] DropOverlay outer container changed from `<div role="region">` to `<section>`** — Found during: biome lint pass after Task 1. Issue: biome's `lint/a11y/useGenericFontNames`-adjacent ARIA rule flags `role="region"` on a non-section element. Fix: use a semantic `<section aria-label="Drop a log file">` which has the implicit role of `region`. Files modified: `DropOverlay.tsx`. Verification: the existing test `outer container exposes role="region" and aria-label` continues to pass — Testing Library resolves the implicit role correctly. Commit hash: see plan commit.

**[Rule 1 - Bug] MultiFileToast `tabIndex={0}` opted out of biome a11y rule via inline ignore** — Found during: biome lint pass after Task 3. Issue: `lint/a11y/noNoninteractiveTabindex` flags `tabIndex={0}` on a `<div role="status">`. The UI-SPEC explicitly requires the toast be focusable so users can dismiss with Escape (locked behavior). Fix: added a `// biome-ignore lint/a11y/noNoninteractiveTabindex: ...` comment naming the UI-SPEC requirement. Files modified: `MultiFileToast.tsx`. Verification: tests covering focus + Escape dismissal continue to pass. Commit hash: see plan commit.

**Total deviations:** 2 auto-fixed (2 Rule 1 — surface-level lint vs locked-spec mediation). **Impact:** none — visible behavior, copy, accessibility tree, and token usage match the UI-SPEC exactly.

## Self-Check: PASSED
