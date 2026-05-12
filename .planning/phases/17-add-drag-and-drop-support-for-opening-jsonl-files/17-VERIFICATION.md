---
phase: 17
status: verified
date: 2026-05-12
verifier: inline
---

# Phase 17 — VERIFICATION

## Phase Goal

Let the user open (or switch to) a JSONL log in the standalone web UI by dragging a file from Finder / VS Code Explorer / a terminal into the browser window. The drop must reuse the existing `POST /api/sessions/open { path }` transport (no new server route, no new fetch path) and surface clear feedback for armed / replacing / error / multi-file cases. Source: `.planning/phases/17-add-drag-and-drop-support-for-opening-jsonl-files/17-CONTEXT.md`.

## Goal-to-Evidence Map

| Goal Bullet (CONTEXT) | Evidence | Status |
|---|---|---|
| Whole-window drop target armed on `dragenter`, disarmed on `dragleave`/`drop` (D3) | `useDropZone.ts` window listeners + depth counter; tests `enters armed state on dragenter`, `enters armed-replacing state when a log is active`, `leaves to idle on dragleave at the document edge` | PASS |
| Recover real path from `text/uri-list`, decode `file://` URI (D2) | `parseDroppedUri.ts`; 12 unit tests including malformed-percent regression | PASS |
| Reuse existing `onOpenPath` / `sessions.open` flow (D5) | `AppShell.tsx` passes `onPickerOpenPath` to `useDropZone({ onOpenPath })`; `grep '/api/sessions/open' packages/ui/src/components/drop/` returns no matches; E2E proves end-to-end open via the same transport | PASS |
| Visual + accessible feedback (D3) | `DropOverlay.tsx` uses `<section aria-label="Drop a log file">` with `aria-live="polite"`; covered by 8 component tests | PASS |
| Friendly error when drop carries no `text/uri-list` or non-`.jsonl` URI (D2) | `useDropZone` sets locked `NO_FILE_COPY` / `WRONG_EXT_COPY`; tests `drop with no usable URI ...` and `drop with only non-jsonl URIs ...` | PASS |
| First `.jsonl` wins with multi-file toast (D4) | `parseDroppedUri` returns `ignoredCount`; `MultiFileToast` renders basename only; tests `multi-file drop sets the toast with basename only` and 6 toast component tests | PASS |
| Trust posture: paths never echoed in errors (D1, T-17-03-01) | `useDropZone` server-error mapping uses `ERROR_COPY[code]` only; test `server error maps via ERROR_COPY without echoing the path` asserts message does not contain `secret-name` or `/tmp` | PASS |
| ERROR_COPY shared with ManualOpenInput so dropped/pasted fail identically (D5) | `picker/error-copy.ts` is the single declaration site; both `ManualOpenInput.tsx` and `useDropZone.ts` import from it; verified via grep | PASS |
| End-to-end drop in the running standalone CLI opens the dropped log | `e2e/phase17.spec.ts` drops `test/fixtures/tiny.jsonl` and asserts the SourceStrip filename changes; passes in 993ms | PASS |

## Test Suite

- Vitest (root): **1167 tests across 98 files passed** — covers Phase 17 unit/integration tests plus all prior phases as the regression gate.
- Playwright: `e2e/phase17.spec.ts` — 1 passed.
- UI build: `pnpm -F @ahp-inspector/ui build` — built (348.57 KB JS, 27.88 KB CSS).
- Extension build: `pnpm -F @ahp-inspector/extension build` — built (260.80 KB CJS).
- Biome: clean across all touched files.

## Code Review

`17-REVIEW.md` — status: clean (after fixes). 0 critical, 1 warning + 3 info found, 3 resolved (WR-01 URIError fix, IN-01 dead ref removal, IN-03 describe rename), 1 deferred (IN-02 reduced-motion reactivity — not worth a `useSyncExternalStore` rewrite for a 150ms transition).

## Out-of-Scope Check

VS Code extension webview drop, native file-picker fallback, file-content upload, multi-file queueing, folder drops, drag-into-custom-editor — all explicitly deferred per CONTEXT and **not** introduced.

## Verdict

**Phase 17 verified.** All seven success criteria from `17-03-PLAN.md` are met:

1. Dragging a file over the standalone web window shows the locked overlay copy. (Unit + AppShell tests)
2. Dropping a single `.jsonl` file replaces the active log via the existing `openSessionByPath` flow with no new transport. (Unit + E2E)
3. Multi-file drops show the basename-only toast. (Unit)
4. Bad drops show the matching locked error copy. (Unit)
5. Server errors surface via the same `ERROR_COPY` map. (Unit + grep)
6. All Vitest suites green; UI + extension builds succeed. (Verified)
7. `e2e/phase17.spec.ts` passes against the running CLI. (Verified)

No path/URI/basename ever appears in any error message rendered by the overlay — verified by direct test assertion.
