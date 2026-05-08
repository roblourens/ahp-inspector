---
phase: 03-detail-search-and-filtering
fixed_at: 2025-07-14T12:25:30Z
review_path: .planning/phases/03-detail-search-and-filtering/03-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2025-07-14T12:25:30Z  
**Source review:** .planning/phases/03-detail-search-and-filtering/03-REVIEW.md  
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03)
- Fixed: 3
- Skipped: 0

---

## Fixed Issues

### WR-01: CopyMenu raw/pretty labels produce identical output

**Files modified:** `packages/ui/src/components/detail/CopyMenu.tsx`, `packages/ui/src/components/detail/CopyMenu.test.tsx`  
**Commit:** `c5c5fa8`  
**Applied fix:** Changed "Copy raw JSON" action to use `JSON.stringify(event.raw)` (compact/minified, no indentation) while keeping "Copy pretty JSON" as `JSON.stringify(event.raw, null, 2)` (indented). The two options now produce demonstrably different output for any structured object. Added `CopyMenu.test.tsx` with three tests verifying: (1) raw produces compact JSON with no newlines, (2) pretty produces indented JSON with newlines, (3) both differ for the same input object.

---

### WR-02: `useSearch` cleanup does not abort the in-flight request

**Files modified:** `packages/ui/src/components/filters/useSearch.ts`, `packages/ui/src/transport/search-client.test.ts`  
**Commit:** `845f5aa`  
**Applied fix:** Added `abortRef.current?.abort(); abortRef.current = null;` to the `useEffect` cleanup function so that any in-flight fetch is immediately aborted when the query changes or the component unmounts — not just after the 150 ms debounce timer would fire. `AbortController.abort()` is idempotent, so the double-abort (cleanup + timer callback) is safe. Added a new test "WR-02: in-flight request is aborted when query changes before it resolves" that captures the `AbortSignal` passed to the mock fetch and asserts it is `aborted` after the query changes.

---

### WR-03: `fetchEvent` LRU cache stores mutable `status`/`latencyMs` — detail panel shows stale status after cache hit

**Files modified:** `packages/ui/src/components/detail/DetailPanel.tsx`, `packages/ui/src/components/detail/DetailPanel.test.tsx`  
**Commit:** `ee1a659`  
**Applied fix:** Implemented Option B (simpler than cacheInvalidate). In the populated state of `DetailPanel`, introduced `liveStatus` and `liveLatencyMs` that prefer the Zustand store row values (`row.status`, `row.latencyMs`) over the cached `detail.status`/`detail.latencyMs`. Since `applyPatch` keeps rows current with SSE patch frames, these values are always up-to-date. The `??` fallback to `detail.*` covers the edge case where the row no longer exists in the store. Both `DetailSummary` and `CopyMenu` now receive the live values. Added a test "shows live row status (ok) even when cached fetch returned pending" that mocks fetchEvent returning `status: "pending"` while setting the row to `status: "ok", latencyMs: 42`, and verifies the rendered summary shows "ok" and "42ms".

---

## Skipped Issues

_None — all in-scope findings were fixed._

---

## Tests Run

| Test file | Tests | Result |
|-----------|-------|--------|
| `packages/ui/src/components/detail/CopyMenu.test.tsx` | 3 | ✅ pass |
| `packages/ui/src/components/detail/DetailPanel.test.tsx` | 7 | ✅ pass |
| `packages/ui/src/transport/search-client.test.ts` | 12 | ✅ pass |
| **Total** | **22** | **✅ all pass** |

---

## Info Findings (out of scope)

The following Info findings were not addressed (fix_scope = critical_warning):

- **IN-01** (`detail-routes.ts`): `parseInt` accepts partial numeric strings like `"1abc"` → returns event 1 instead of 400.
- **IN-02** (`http-client.ts`): `cacheGet` does not promote accessed entries → effective eviction policy is FIFO, not LRU.
- **IN-03** (`DetailResizeHandle.tsx`): `document` mousemove/mouseup listeners may leak if component unmounts during mid-drag.

---

_Fixed: 2025-07-14T12:25:30Z_  
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 1_
