---
phase: 17
plan: 03
status: complete
date: 2026-05-12
---

# 17-03 SUMMARY — useDropZone hook + AppShell wiring + E2E

## What Was Built

Wires Plans 01 (parser) and 02 (presentational components) into the standalone web shell:

- **`packages/ui/src/components/picker/error-copy.ts`** — extracted the `ERROR_COPY` map and `FALLBACK_ERROR` constant out of `ManualOpenInput.tsx` so both `ManualOpenInput` and the new `useDropZone` use one source of truth (D-05: dropped vs pasted opens fail with identical wording).
- **`packages/ui/src/components/drop/useDropZone.ts`** — React hook that owns the four window-level drag listeners (`dragenter`, `dragover`, `dragleave`, `drop`) and the `DropOverlayState` state machine. Uses a depth counter (ref) to disarm only at the document edge. On a valid drop, it computes `basename` (POSIX split), invokes the caller-supplied `onOpenPath(path)`, surfaces server errors via the shared `ERROR_COPY` map by `code` only (never echoes path/basename into error text — T-17-03-01), and pops the toast only when `ignoredCount > 0`. SSR-safe (`typeof window === "undefined"` guard).
- **`packages/ui/src/components/shell/AppShell.tsx`** — mounts `<DropOverlay>` and conditionally `<MultiFileToast>` as the last children of the shell, driven by `useDropZone({ hasActiveLog: meta !== null, onOpenPath: onPickerOpenPath })`. Reuses `onPickerOpenPath` verbatim — no new transport, no new server route.
- **`packages/ui/src/components/drop/useDropZone.test.tsx`** — 10 vitest cases covering armed/armed-replacing transitions, document-edge dragleave, success path → `onOpenPath` called → toast for multi-file, locked `NO_FILE_COPY` and `WRONG_EXT_COPY` error messages, server error mapping with no path leakage, dismissError, and unmount listener cleanup.
- **`packages/ui/src/components/shell/AppShell.test.tsx`** — extended with a single drop-integration smoke case asserting the overlay is wired in.
- **`e2e/phase17.spec.ts`** — Playwright spec that drives the standalone CLI on `http://127.0.0.1:5173`, synthesizes a `drop` event on `window` carrying a `text/uri-list` pointing at `test/fixtures/tiny.jsonl`, and asserts `tiny.jsonl` appears in the SourceStrip.

## Key Files

- created: `packages/ui/src/components/picker/error-copy.ts`
- created: `packages/ui/src/components/drop/useDropZone.ts`
- created: `packages/ui/src/components/drop/useDropZone.test.tsx`
- created: `e2e/phase17.spec.ts`
- modified: `packages/ui/src/components/picker/ManualOpenInput.tsx` (re-import ERROR_COPY/FALLBACK_ERROR; no behavior change)
- modified: `packages/ui/src/components/shell/AppShell.tsx` (mount overlay+toast, useDropZone hook)
- modified: `packages/ui/src/components/shell/AppShell.test.tsx` (one new drop-integration case)

## Verification

- `pnpm -F @ahp-inspector/ui exec vitest run` — 53 files, 368/368 tests pass (includes Plan 17-01/02/03 unit tests and unchanged ManualOpenInput tests).
- `pnpm exec biome check packages/ui/src/components/drop/ packages/ui/src/components/picker/error-copy.ts packages/ui/src/components/shell/AppShell.tsx` — clean.
- `pnpm -F @ahp-inspector/ui build` — built (348.57 KB JS, 27.88 KB CSS).
- `pnpm -F @ahp-inspector/extension build` — built (260.80 KB CJS).
- `pnpm exec playwright test e2e/phase17.spec.ts --reporter=line` — 1 passed (993ms) against the running CLI.
- `grep -RIn "ERROR_COPY" packages/ui/src/components/` — declared once in `picker/error-copy.ts`, imported by `picker/ManualOpenInput.tsx` and `drop/useDropZone.ts` only.
- `grep -RIn "/api/sessions/open\|fetch(" packages/ui/src/components/drop/` — no matches; D-05 confirmed (no new transport in the drop layer).

## Deviations from Plan

**[Rule 1 - Bug] E2E uses `process.cwd()` instead of `__dirname`** — Found during: first Playwright run. Issue: the workspace's Playwright runtime is ESM, where `__dirname` is undefined. Fix: resolve from `process.cwd()` (Playwright invokes from repo root). Files modified: `e2e/phase17.spec.ts`.

**[Rule 1 - Bug] E2E synthesizes `dataTransfer` via `Object.defineProperty` and does not assert the armed overlay is visible** — Found during: second Playwright run. Issue: Chromium's `DragEvent` constructor does not honor a `dataTransfer:` option (the property is null on programmatically-constructed events). Synthesized `DataTransfer` also cannot include the `"Files"` MIME type — that is set only by the OS-level drag pipeline. The hook's `dragenter` handler gates on `types.includes("Files")`, so a synthetic dragenter cannot light up the overlay. Fix: (a) use `Object.defineProperty(event, "dataTransfer", ...)` so the `drop` handler reads the payload; (b) skip the overlay-visible assertion (which is fully covered by the unit test `dragenter on window mounts the DropOverlay armed`) and instead assert the end-state SourceStrip filename change, which proves the parser → state machine → `onOpenPath` → SSE replacement chain executed end-to-end. Files modified: `e2e/phase17.spec.ts`.

**Total deviations:** 2 auto-fixed (2 Rule 1 — Playwright/Chromium synthetic-event runtime constraints). **Impact:** none on production behavior; tests still verify the full integration chain.

## Self-Check: PASSED
