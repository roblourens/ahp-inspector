---
phase: 03-detail-search-and-filtering
reviewed: 2025-07-14T00:00:00Z
depth: standard
files_reviewed: 65
files_reviewed_list:
  - packages/core/src/index.ts
  - packages/core/src/row-projection.test.ts
  - packages/core/src/row-projection.ts
  - packages/server/src/app-state.ts
  - packages/server/src/detail-routes.test.ts
  - packages/server/src/detail-routes.ts
  - packages/server/src/log-server.ts
  - packages/server/src/search-index.ts
  - packages/server/src/search-routes.test.ts
  - packages/server/src/search-routes.ts
  - packages/ui/package.json
  - packages/ui/src/components/detail/AhpFieldRow.tsx
  - packages/ui/src/components/detail/AhpFieldStrip.tsx
  - packages/ui/src/components/detail/AuthFailureBanner.tsx
  - packages/ui/src/components/detail/CopyMenu.tsx
  - packages/ui/src/components/detail/CopyToast.tsx
  - packages/ui/src/components/detail/DetailPanel.test.tsx
  - packages/ui/src/components/detail/DetailPanel.tsx
  - packages/ui/src/components/detail/DetailResizeHandle.tsx
  - packages/ui/src/components/detail/DetailSummary.fields.test.tsx
  - packages/ui/src/components/detail/DetailSummary.tsx
  - packages/ui/src/components/detail/DetailTabs.tsx
  - packages/ui/src/components/detail/index.ts
  - packages/ui/src/components/detail/PrettyJsonView.tsx
  - packages/ui/src/components/detail/PrivacyCaption.tsx
  - packages/ui/src/components/detail/RawJsonView.tsx
  - packages/ui/src/components/detail/TruncationBanner.tsx
  - packages/ui/src/components/filters/ActiveChip.tsx
  - packages/ui/src/components/filters/ActiveFilterChips.tsx
  - packages/ui/src/components/filters/FacetChip.tsx
  - packages/ui/src/components/filters/FacetPopover.tsx
  - packages/ui/src/components/filters/FilterBar.test.tsx
  - packages/ui/src/components/filters/FilterBar.tsx
  - packages/ui/src/components/filters/GroupToggleChip.tsx
  - packages/ui/src/components/filters/index.ts
  - packages/ui/src/components/filters/ResultCounter.tsx
  - packages/ui/src/components/filters/SearchInput.tsx
  - packages/ui/src/components/filters/TimeRangePopover.tsx
  - packages/ui/src/components/filters/useSearch.ts
  - packages/ui/src/components/shell/AppShell.tsx
  - packages/ui/src/components/shell/StatusBar.tsx
  - packages/ui/src/components/states/NoResultsState.tsx
  - packages/ui/src/components/states/SearchingIndicator.tsx
  - packages/ui/src/components/states/SearchTruncatedBanner.tsx
  - packages/ui/src/components/timeline/EventRow.columns.test.tsx
  - packages/ui/src/components/timeline/EventRow.orphan.test.tsx
  - packages/ui/src/components/timeline/EventRow.tsx
  - packages/ui/src/components/timeline/GapBannerRow.tsx
  - packages/ui/src/components/timeline/GroupHeaderRow.tsx
  - packages/ui/src/components/timeline/grouping.test.tsx
  - packages/ui/src/components/timeline/ParseErrorRow.test.tsx
  - packages/ui/src/components/timeline/StickyGroupBar.tsx
  - packages/ui/src/components/timeline/TimelineList.tsx
  - packages/ui/src/components/timeline/TimelineList.virt.test.tsx
  - packages/ui/src/components/timeline/TimelineRegion.tsx
  - packages/ui/src/state/filters.ts
  - packages/ui/src/state/selectors.perf.test.ts
  - packages/ui/src/state/selectors.test.ts
  - packages/ui/src/state/selectors.ts
  - packages/ui/src/state/store.ts
  - packages/ui/src/styles/tokens.css
  - packages/ui/src/transport/http-client.ts
  - packages/ui/src/transport/search-client.test.ts
  - packages/ui/src/transport/search-client.ts
  - pnpm-lock.yaml
  - test/fixtures/phase3-mini.jsonl
  - test/phase3-vertical-slice.test.ts
  - test/security.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2025-07-14  
**Depth:** standard  
**Files Reviewed:** 65  
**Status:** issues_found

## Summary

Phase 3 adds server-side substring search (`SearchIndex` + `/api/log/search`), the event detail panel (with fetch/cache/AbortController lifecycle), client-side facet filtering, grouping, and clipboard copy. The overall implementation is solid: no regex from user input (ReDoS safe), no `dangerouslySetInnerHTML`, raw payloads rendered safely via React text children, `AbortController` used in both the detail loader and search hook, server endpoints validated against path traversal and out-of-range indices.

Three genuine defects were found. Two affect user-visible correctness (stale search results flashing after rapid keystrokes, stale detail-panel status after cache hit); one is a functional duplicate in the copy menu. Three lower-priority quality issues are also noted.

---

## Warnings

### WR-01: CopyMenu "Copy raw JSON" and "Copy pretty JSON" produce identical output

**File:** `packages/ui/src/components/detail/CopyMenu.tsx:110–130`

**Issue:** Both menu items call `JSON.stringify(event.raw, null, 2)` — indented pretty-printing — so the two options are functionally identical. One of the two copy actions is always wrong for its label.

```tsx
// current — both branches are byte-for-byte identical
{
  label: "Copy raw JSON",
  action: () => JSON.stringify(event.raw, null, 2),   // ← indented
},
{
  label: "Copy pretty JSON",
  action: () => JSON.stringify(event.raw, null, 2),   // ← also indented
},
```

**Fix:** Differentiate the two actions. The most natural interpretation is that "raw" means compact (minified) JSON and "pretty" means indented:

```tsx
{
  label: "Copy raw JSON",
  action: () => {
    try { return JSON.stringify(event.raw); }           // compact
    catch { return "[Circular or non-serializable value]"; }
  },
},
{
  label: "Copy pretty JSON",
  action: () => {
    try { return JSON.stringify(event.raw, null, 2); }  // indented
    catch { return "[Circular or non-serializable value]"; }
  },
},
```

---

### WR-02: `useSearch` cleanup does not abort the in-flight request — stale results can flash

**File:** `packages/ui/src/components/filters/useSearch.ts:42–45`

**Issue:** The `useEffect` cleanup function only cancels the debounce timer. It does **not** abort the previous in-flight `fetch`. Because the abort happens inside the 150 ms `setTimeout` callback rather than in the cleanup, there is a race window: if the previous query's response arrives during the 150 ms grace period after the query changes, `setMatches` is called with the old query's results. On a local server (sub-millisecond responses) this window reliably triggers on every keystroke.

```ts
// current cleanup — misses the abort:
return () => {
  if (timerRef.current) clearTimeout(timerRef.current);
  // ← abortRef.current is NOT aborted here
};
```

**Fix:** Abort in the cleanup function as well as in the timer callback. `AbortController.abort()` is idempotent, so double-aborting is safe:

```ts
return () => {
  if (timerRef.current) clearTimeout(timerRef.current);
  abortRef.current?.abort();   // cancel any in-flight request immediately
  abortRef.current = null;
};
```

---

### WR-03: `fetchEvent` LRU cache stores mutable `status`/`latencyMs` — detail panel shows stale status after cache hit

**File:** `packages/ui/src/transport/http-client.ts:54–66`

**Issue:** `fetchEvent` caches the full `DetailResponse` (including `status` and `latencyMs`) by event index. These fields are mutable: the server issues SSE `patch` frames that update them (e.g. `pending → ok` when a request/response pair is correlated). The Zustand store applies patches to the timeline rows in real time, but the detail-panel cache is never invalidated. Consequently:

1. User clicks event #N while status is `"pending"` → fetched, cached, panel shows `"pending"`.
2. Patch arrives → timeline row updates to `"ok"`, but cache entry unchanged.
3. User clicks elsewhere then re-clicks event #N → `cacheGet(N)` hits → panel still shows `"pending"`.

The timeline and detail panel then disagree on status/latency.

**Fix (Option A — preferred):** Invalidate the cache entry for any idx that appears in an SSE `patch` payload. Expose a `cacheInvalidate(idx: number): void` export and call it from the SSE handler's `patch` branch.

**Fix (Option B — simpler):** Do not cache `status` and `latencyMs` at all; pull those live from the Zustand store's `rows` array when rendering `DetailPanel`, instead of from `detail.latencyMs` / `detail.status`. The immutable fields (`event.raw`, `pair`, `pairIdx`) are safe to cache.

---

## Info

### IN-01: `parseInt` in `detail-routes.ts` accepts partial numeric strings

**File:** `packages/server/src/detail-routes.ts:22–25`

**Issue:** `parseInt("1abc", 10)` returns `1`, so `GET /api/log/event/1abc` silently returns event 1 instead of 400. This is not a security concern (the idx range is still validated) but it makes the endpoint inconsistent — clients sending a typo get a successful response.

**Fix:** Use `Number()` + `Number.isInteger()` which treats `"1abc"` as `NaN`:

```ts
const idx = Number(raw);
if (!Number.isInteger(idx) || idx < 0) {
  return c.json({ error: "invalid idx" }, 400);
}
```

---

### IN-02: LRU cache `cacheGet` does not promote the accessed entry — effective eviction policy is FIFO

**File:** `packages/ui/src/transport/http-client.ts:30–33`

**Issue:** `cacheGet` returns the cached value without updating `cacheOrder`, so a recently read entry is not moved to the back of the eviction queue. With 16 slots and no promotion, entries are evicted in insertion order regardless of access frequency. For a user who repeatedly opens the same few events, those events will eventually be evicted.

**Fix:** Move the idx to the tail of `cacheOrder` on a read hit:

```ts
function cacheGet(idx: number): DetailResponse | undefined {
  const hit = cache.get(idx);
  if (hit !== undefined) {
    // Promote to MRU position
    const pos = cacheOrder.indexOf(idx);
    if (pos !== -1) cacheOrder.splice(pos, 1);
    cacheOrder.push(idx);
  }
  return hit;
}
```

---

### IN-03: `DetailResizeHandle` adds `document` listeners on `mousedown` with no unmount guard

**File:** `packages/ui/src/components/detail/DetailResizeHandle.tsx:40–53`

**Issue:** `handleMouseDown` attaches `mousemove` and `mouseup` listeners to `document`. These are removed inside the `onMouseUp` callback, but if the component unmounts while the user is mid-drag (e.g. via keyboard shortcut closing the detail panel), the listeners remain attached until the next `mouseup` anywhere on the page.

**Fix:** Track the listener functions in a `useRef` or closure and clean them up in a component-level `useEffect` cleanup, or record whether drag listeners are active and remove them in a returned cleanup:

```ts
// Option: move listeners to a useEffect with cleanup
useEffect(() => {
  return () => {
    // If the component unmounts while dragging, remove dangling listeners.
    if (dragging.current) {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      dragging.current = false;
    }
  };
}, []);
```

(Requires extracting `onMouseMove`/`onMouseUp` to stable refs or a class-level pattern.)

---

_Reviewed: 2025-07-14_  
_Reviewer: gsd-code-reviewer_  
_Depth: standard_
