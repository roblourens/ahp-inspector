---
phase: 01-core-foundations
fixed_at: 2025-07-14T22:00:00Z
review_path: .planning/phases/01-core-foundations/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2025-07-14T22:00:00Z  
**Source review:** `.planning/phases/01-core-foundations/01-REVIEW.md`  
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: Correlator orphans first request on duplicate-key collision

**Files modified:** `packages/core/src/correlator.ts`, `packages/core/src/correlator.test.ts`  
**Commits:** `a2b3ad9` (source fix), `22db830` (test update)  
**Applied fix:** In `#onRequest`, look up `#pendingRequests` for a pre-existing entry with the same key. If found, set `this.status[displaced] = "orphan"` before overwriting the map entry. Updated the correlator test: the existing assertion expected both requests to be `'pending'`; after the fix the displaced first request is correctly `'orphan'` and only the newer one is `'pending'`.

---

### WR-02: Correlator silently drops first early-arriving response on duplicate-key collision

**Files modified:** `packages/core/src/correlator.ts`  
**Commit:** `a2b3ad9`  
**Applied fix:** In `#onResponse`, look up `#pendingResponses` for a pre-existing entry with the same key. If found, set `this.status[displaced] = "orphan"` before overwriting the map entry. Committed together with WR-01.

---

### WR-03: TailReader — concurrent `#readTail` invocations deliver duplicate bytes

**Files modified:** `packages/host-node/src/tail-reader.ts`  
**Commit:** `eccf48a`  
**Applied fix:** Added a `#readInFlight = false` private field to `TailReader`. The chokidar `'change'` handler now guards on `this.#readInFlight`; if a read is already in progress the new event is coalesced (skipped). The flag is reset in a `.finally()` callback so it is cleared even if `#readTail` throws.

---

### WR-04: TailReader — `#readTail` silently swallows stream read errors

**Files modified:** `packages/host-node/src/tail-reader.ts`  
**Commit:** `eccf48a`  
**Applied fix:** Changed `stream.on("error", () => resolve())` to log via `console.warn("[TailReader] read error during tail:", err.message)` before resolving, making read errors observable. Still resolves (not rejects) to keep the watcher chain alive, consistent with the reviewer's recommendation. Committed together with WR-03.

---

### WR-05: `makeParseErrorEvent` caps `rawText` by character count, not bytes

**Files modified:** `packages/shared/src/parse-error.ts`  
**Commit:** `b40a4c7`  
**Applied fix:** Replaced the `.length` (UTF-16 char) comparison with a byte-accurate approach: encode `rawText` to UTF-8 via `new TextEncoder().encode()`, compare `bytes.length` against `MAX_RAW_TEXT_BYTES`, and decode the sliced byte array via `new TextDecoder()` when capping is needed. The fallback path (`bytes.length <= MAX_RAW_TEXT_BYTES`) returns the original string unchanged to avoid an unnecessary encode/decode round-trip.

---

## Skipped Issues

None — all five in-scope warnings were successfully fixed.

---

_Fixed: 2025-07-14T22:00:00Z_  
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 1_
