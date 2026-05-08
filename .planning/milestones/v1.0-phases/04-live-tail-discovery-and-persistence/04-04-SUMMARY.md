---
phase: 04-live-tail-discovery-and-persistence
plan: 04
subsystem: ui
tags: [picker, no-log-state, safe-candidate, ui-components]
provides:
  - SafeCandidate type (no path field)
  - CandidateRow / CandidateList / NoCandidatesHint
  - ManualOpenInput with server-code → fixed-copy mapping
  - NoActiveLogState page (UI-SPEC §1)
  - LogPickerPanel overlay (UI-SPEC §4)
requires:
  - tokens.css confidence + candidate-row-height tokens (already present)
affects:
  - Sets up the visual surface for plan 04-05 wiring
key-files:
  created:
    - packages/ui/src/types/safe-candidate.ts
    - packages/ui/src/components/picker/CandidateRow.tsx
    - packages/ui/src/components/picker/CandidateRow.test.tsx
    - packages/ui/src/components/picker/CandidateList.tsx
    - packages/ui/src/components/picker/NoCandidatesHint.tsx
    - packages/ui/src/components/picker/ManualOpenInput.tsx
    - packages/ui/src/components/picker/ManualOpenInput.test.tsx
    - packages/ui/src/components/picker/LogPickerPanel.tsx
    - packages/ui/src/components/states/NoActiveLogState.tsx
    - packages/ui/src/components/states/NoActiveLogState.test.tsx
  modified: []
decisions:
  - "SafeCandidate has no `path` field — TypeScript prevents accidental path leakage to UI."
  - "Server error codes map to fixed UI strings via ERROR_COPY; user-typed paths never appear in error UI."
  - "Picker components are pure presentation; transport wiring deferred to 04-05."
metrics:
  tasks_completed: 3
  tests_added: 14
  files_created: 10
  files_modified: 0
completed: 2026-05-07
---

# Phase 04 Plan 04: Picker UI Components Summary

Built every NEW Phase 4 picker component as pure presentation surface — `SafeCandidate` type, `CandidateRow`/`CandidateList`/`NoCandidatesHint`, `ManualOpenInput` with server-code→fixed-copy mapping, `NoActiveLogState` page, and `LogPickerPanel` non-modal overlay — all token-driven, zero raw hex literals, zero existing-file modifications. Plan 04-05 will wire these to `/api/sessions/*`.

## What Was Built

### Task 1 — SafeCandidate type + row/list components (commit `0bed507`)

- `packages/ui/src/types/safe-candidate.ts` — readonly interface with `id`, `label` (basename only), `origin`, `confidence`, `mtimeMs`, `sizeBytes`, optional `contextLabel`. **No `path` field** (information-disclosure mitigation T-04-04-01).
- `CandidateRow.tsx` — confidence dot (token-colored), basename, badge + origin chip, relative mtime, formatted size, chevron. All styles via CSS variables.
- `CandidateList.tsx` — delegates to `CandidateRow` per item, falls back to `NoCandidatesHint` when empty.
- `NoCandidatesHint.tsx` — "No logs discovered" hint with explanatory copy.
- 4 vitest cases verify basename + badge rendering, **DOM contains no `/Users/`/`\\Users\\`/leading-slash strings**, click activation, and dot-color token selection.

### Task 2 — ManualOpenInput (commit `431828b`)

- 4096-char client-side cap (matches server cap; defense in depth — T-04-04-03).
- `ERROR_COPY` map indexes server `code` strings to verbatim UI-SPEC copy:
  `path-too-long`, `not-found`, `not-a-file`, `not-readable`, `bad-request`. Unknown codes fall back to `bad-request` copy.
- Error region NEVER echoes the typed path (T-04-04-02). Tests prove it: a typed secret-style path does not appear in `role="alert"` content on `not-found` error.
- 5 vitest cases cover: typed path → `onOpen`, Enter-submit, oversize rejection, code mapping, fallback.

### Task 3 — NoActiveLogState page + LogPickerPanel overlay (commit `80c62d6`)

- `NoActiveLogState.tsx` (UI-SPEC §1): centered 640px layout with `<h1>No log open</h1>`, adaptive body copy (different message when zero candidates and not loading), Discovered logs `<h2>` section with Refresh List button, `CandidateList`, `or open manually` divider, embedded `ManualOpenInput`. On mount, focus moves to first candidate button or to the manual-open input.
- `LogPickerPanel.tsx` (UI-SPEC §4): non-modal `role="dialog" aria-modal="false" aria-label="Switch log"`, fixed top overlay, Escape closes, focus moves into the panel on open.
- 5 vitest cases cover heading copy, body adaptation, click→`onSelect(id)`, Refresh button, divider + embedded input.

## Verification

| Command                                                                                                                               | Result |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `pnpm -F @ahp-viewer/ui test src/components/picker/CandidateRow.test.tsx`                                                             | 4/4 ✅ |
| `pnpm -F @ahp-viewer/ui test src/components/picker/ManualOpenInput.test.tsx`                                                          | 5/5 ✅ |
| `pnpm -F @ahp-viewer/ui test src/components/states/NoActiveLogState.test.tsx`                                                         | 5/5 ✅ |
| Combined run (all three above)                                                                                                        | 14/14 ✅ |
| `pnpm -F @ahp-viewer/ui build`                                                                                                        | ✅ (vite production build) |
| `pnpm typecheck` (workspace)                                                                                                          | ✅ all 7 packages |
| `grep -nE "#[0-9a-fA-F]{3,}" packages/ui/src/components/picker/*.tsx packages/ui/src/components/states/NoActiveLogState.tsx`          | no matches (no raw hex) |
| `npx biome check` over new + modified files                                                                                           | 0 errors |

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| `SafeCandidate` exists with no `path` field | ✅ (`grep "path:" safe-candidate.ts` empty) |
| `CandidateRow` / `CandidateList` / `NoCandidatesHint` exported | ✅ |
| `MAX_PATH_LEN = 4096` and verbatim error copy in ManualOpenInput | ✅ |
| Error UI never echoes typed path | ✅ (test asserts) |
| `NoActiveLogState` heading "No log open" + "or open manually" divider | ✅ |
| `LogPickerPanel` is `role="dialog"` with `aria-label="Switch log"` and Escape-closes | ✅ |
| Zero raw hex literals in any new component file | ✅ |
| Test suite green; workspace typecheck green | ✅ |

## Deviations from Plan

**[Rule 3 - Blocking] Manual `afterEach(cleanup)` in test files.**
The repo's vitest config does not auto-cleanup React Testing Library between tests (existing `states.test.tsx` shows the pattern). Without explicit `afterEach(() => cleanup())`, leftover DOM from previous tests caused `getByRole("button")` to match multiple elements. Added `import { cleanup, ... }` and `afterEach(() => cleanup())` to all three new test files. Matches the project convention.

**[Rule 3 - Blocking] Biome lint compliance for new files.**
Initial drafts triggered `lint/a11y/noRedundantRoles` (explicit `role="list"`/`role="listitem"`), `lint/style/useTemplate` (string concatenation in test), `lint/style/noNonNullAssertion` (`!` after `.closest("form")`), and formatter diffs. Fixed all four:
- Removed redundant `role` attributes on native `<ul>` and `<li>`.
- Replaced `"/" + "a".repeat(5000)` with template literal.
- Replaced `input.closest("form")!` with explicit `if (!form) throw` guard.
- Ran `biome check --write` to apply formatter fixes.

Pre-existing lint errors in unrelated files (server tests, `session-routes.ts`) were left untouched per scope-boundary rule (logged via `pnpm lint` exit but not in our files).

## Threat Surface Verification

All STRIDE register items from the plan are mitigated:

| Threat ID | Disposition | Verification |
|-----------|-------------|--------------|
| T-04-04-01 (path leakage in CandidateRow) | mitigate | `SafeCandidate` lacks `path` field; CandidateRow test asserts no `/Users/`, `\\Users\\`, leading-slash text in DOM |
| T-04-04-02 (path echo in error UI) | mitigate | ERROR_COPY map; test confirms typed path absent from `role="alert"` content |
| T-04-04-03 (oversize path tampering) | mitigate | `MAX_PATH_LEN=4096` client check; test bypasses `maxLength` and confirms rejection |
| T-04-04-04 (panel DoS via large list) | accept | server caps at 200 rows; CSS `overflow-y:auto` |
| T-04-04-05 (No-log vs No-server confusion) | mitigate | "No log open" heading distinct from existing "Server not running" page |

No new threat flags introduced.

## Self-Check: PASSED

- FOUND: packages/ui/src/types/safe-candidate.ts
- FOUND: packages/ui/src/components/picker/CandidateRow.tsx
- FOUND: packages/ui/src/components/picker/CandidateRow.test.tsx
- FOUND: packages/ui/src/components/picker/CandidateList.tsx
- FOUND: packages/ui/src/components/picker/NoCandidatesHint.tsx
- FOUND: packages/ui/src/components/picker/ManualOpenInput.tsx
- FOUND: packages/ui/src/components/picker/ManualOpenInput.test.tsx
- FOUND: packages/ui/src/components/picker/LogPickerPanel.tsx
- FOUND: packages/ui/src/components/states/NoActiveLogState.tsx
- FOUND: packages/ui/src/components/states/NoActiveLogState.test.tsx
- FOUND commit: 0bed507 (Task 1)
- FOUND commit: 431828b (Task 2)
- FOUND commit: 80c62d6 (Task 3)
