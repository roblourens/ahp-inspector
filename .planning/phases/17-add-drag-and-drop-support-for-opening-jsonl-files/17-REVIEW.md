---
phase: 17
status: clean
date: 2026-05-12
depth: standard
files_reviewed: 13
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
resolved: 3
deferred: 1
---

# Phase 17: Code Review Report

**Reviewed:** 2026-05-12
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues-found

## Summary

Phase 17 wires drag-and-drop opening of JSONL files into the AppShell via three layered units: a pure parser ([parseDroppedUri.ts](packages/ui/src/components/drop/parseDroppedUri.ts)), two presentational components ([DropOverlay.tsx](packages/ui/src/components/drop/DropOverlay.tsx), [MultiFileToast.tsx](packages/ui/src/components/drop/MultiFileToast.tsx)), and a window-listener hook ([useDropZone.ts](packages/ui/src/components/drop/useDropZone.ts)). Code is well-typed, no `any`/unsafe casts in production code, all visual values use CSS tokens, ESM imports use `.js`, and listeners are cleaned up on unmount. The information-disclosure rule is honored: error overlay copy is keyed via `ERROR_COPY`, and the toast uses only `basename` (not the full path) — both verified by tests.

One real correctness gap (unhandled `URIError` from `decodeURIComponent` in the parser) plus three minor observations.

## Critical Issues

No issues found.

## Warnings

### WR-01: `decodeURIComponent` can throw `URIError` and crash the drop handler

**File:** [packages/ui/src/components/drop/parseDroppedUri.ts:39](packages/ui/src/components/drop/parseDroppedUri.ts#L39)

**Issue:** `decodeURIComponent(url.pathname)` is called without a try/catch. The `URL` constructor accepts strings whose pathname contains invalid percent-encoding (e.g. `file:///tmp/%E0%A4%A.jsonl` — truncated UTF‑8 sequence), and `decodeURIComponent` throws `URIError: URI malformed` on such input. The throw propagates out of `parseDroppedUri`, then out of the `onDrop` handler in [useDropZone.ts:97](packages/ui/src/components/drop/useDropZone.ts#L97), leaving the overlay stuck in whatever state it was in (commonly `armed`) and surfacing an uncaught error to the window. This is the same defensive shape already applied to `new URL(entry)` immediately above; the asymmetry is the bug.

**Fix:**
```ts
let decoded: string;
try {
  decoded = decodeURIComponent(url.pathname);
} catch {
  ignoredCount++;
  continue;
}
if (!decoded.toLowerCase().endsWith(".jsonl")) {
  ignoredCount++;
  continue;
}
return { kind: "ok", path: decoded, ignoredCount };
```

A regression test for a malformed-percent URI in `parseDroppedUri.test.ts` would lock this in.

## Info

### IN-01: `MultiFileToast` ref is allocated but never read

**File:** [packages/ui/src/components/drop/MultiFileToast.tsx:11](packages/ui/src/components/drop/MultiFileToast.tsx#L11)

**Issue:** `const ref = useRef<HTMLDivElement>(null);` is created and attached via `ref={ref}` but never read. If the intent was to auto-focus the toast so Escape works without a prior click (the test [MultiFileToast.test.tsx:48](packages/ui/src/components/drop/MultiFileToast.test.tsx#L48) calls `.focus()` explicitly to exercise this), the ref is the natural place. As written it is dead state.

**Fix:** Either drop the ref entirely, or auto-focus on mount:
```ts
useEffect(() => { ref.current?.focus(); }, []);
```
Auto-focus would change focus behavior, so prefer dropping the ref unless focus-stealing is desired.

### IN-02: `REDUCED_MOTION` is captured once at module load and never re-read

**File:** [packages/ui/src/components/drop/DropOverlay.tsx:15-18](packages/ui/src/components/drop/DropOverlay.tsx#L15-L18)

**Issue:** The `prefers-reduced-motion` media query is evaluated at module import time and stored in a constant. If the user toggles the OS-level setting after the page loads, the overlay transition does not respond. Minor — the only effect is a 150ms opacity transition. Not worth fixing unless the codebase already has a `usePrefersReducedMotion` hook.

**Fix:** Move the check inside the component (`useSyncExternalStore` against `matchMedia`) if reactivity is desired; otherwise leave as-is.

### IN-03: AppShell drop-integration test coverage is thin

**File:** [packages/ui/src/components/shell/AppShell.test.tsx:206-219](packages/ui/src/components/shell/AppShell.test.tsx#L206-L219)

**Issue:** The new `AppShell — drop integration` describe contains a single test that asserts the overlay mounts on `dragenter`. It does not exercise the actual drop → `onPickerOpenPath` → SSE replacement wiring through AppShell, nor the toast path. The unit-level tests in [useDropZone.test.tsx](packages/ui/src/components/drop/useDropZone.test.tsx) and the Playwright spec at [e2e/phase17.spec.ts](e2e/phase17.spec.ts) cover those flows separately, so this is acceptable layering — flagging only because the describe block name suggests broader coverage than is actually present.

**Fix:** Either rename the describe (e.g. "AppShell — drop overlay mount") or add one drop-path assertion that the picker closes / `setLogKey` runs.

---

## Resolution

- **WR-01 (URIError)** — fixed in `parseDroppedUri.ts` by wrapping `decodeURIComponent` in try/catch (mirrors the existing `new URL()` pattern). Regression test added in `parseDroppedUri.test.ts` (`treats malformed percent-encoding as an ignored entry instead of throwing`).
- **IN-01 (dead ref)** — removed the unused `useRef`/`ref={ref}` from `MultiFileToast.tsx`.
- **IN-03 (describe rename)** — renamed `AppShell — drop integration` → `AppShell — drop overlay mount` to match actual coverage scope.
- **IN-02 (REDUCED_MOTION reactivity)** — deferred per reviewer's own note; not worth a `useSyncExternalStore` rewrite for a 150ms opacity transition.

Vitest after fixes: 1167/1167 (one new regression test added).

_Reviewed: 2026-05-12_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
