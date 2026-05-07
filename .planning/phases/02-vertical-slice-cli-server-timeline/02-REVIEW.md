---
phase: 02-vertical-slice-cli-server-timeline
reviewed: 2025-01-31T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - packages/cli/package.json
  - packages/cli/src/cli-errors.test.ts
  - packages/cli/src/cli-launch.test.ts
  - packages/cli/src/cli-test-helpers.ts
  - packages/cli/src/direction.test.ts
  - packages/cli/src/direction.ts
  - packages/cli/src/index.ts
  - packages/core/src/index.ts
  - packages/core/src/row-projection.test.ts
  - packages/core/src/row-projection.ts
  - packages/server/package.json
  - packages/server/src/app-state.test.ts
  - packages/server/src/app-state.ts
  - packages/server/src/csp.ts
  - packages/server/src/host-guard.ts
  - packages/server/src/index.ts
  - packages/server/src/log-server.ts
  - packages/server/src/projector.ts
  - packages/server/src/sse-routes.ts
  - packages/server/src/static-ui.ts
  - packages/ui/src/App.tsx
  - packages/ui/src/transport/sse-client.ts
  - packages/ui/src/state/store.ts
  - packages/ui/src/components/timeline/TimelineList.tsx
  - packages/ui/src/components/timeline/EventRow.tsx
  - packages/ui/src/components/timeline/ParseErrorRow.tsx
  - test/sse-integration.test.ts
  - test/vertical-slice.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2025-01-31  
**Depth:** standard  
**Files Reviewed:** 28  
**Status:** issues_found

## Summary

The Phase 2 vertical-slice is structurally sound. Security mitigations (host-guard, CSP, loopback binding, basename-only meta) are correctly implemented and tested. The SSE lifecycle — snapshot chunking, append/patch fan-out, heartbeat, subscriber cleanup on abort — has no listener leaks. Direction inference, row projection, and the Zustand store mutations are all correct. No critical bugs or meaningful security bypasses were found.

Two warnings were identified: a dead-code duplicate in the UI-discovery path (causing a broken fallback for non-standard layouts) and a lingering `setInterval` in a test helper. Three low-signal info items round out the findings.

---

## Warnings

### WR-01: `locateUiDist()` — first two candidates are identical; third resolves to a non-existent path

**File:** `packages/cli/src/index.ts:49-56`

**Issue:** The comment claims the second candidate handles the tsup-built binary path, but `resolvePath(__dirname, "..", "..", "ui", "dist")` evaluates to the same absolute path whether `__dirname` points to `packages/cli/src` (tsx) or `packages/cli/dist` (tsup), because the `..` traversal lands at `packages/` in both cases. The third candidate (`resolvePath(__dirname, "..", "ui", "dist")`) resolves to `packages/cli/ui/dist`, which does not exist. So the function tries the correct path twice and then a broken fallback — any genuine "hoisted layout" scenario fails silently and the CLI launches without serving the UI, with no warning to the user.

```typescript
// Current (broken)
const candidates = [
  resolvePath(__dirname, "..", "..", "ui", "dist"),  // tsx: packages/ui/dist ✓
  resolvePath(__dirname, "..", "..", "ui", "dist"),  // tsup: identical ← dead duplicate
  resolvePath(__dirname, "..", "ui", "dist"),        // resolves to packages/cli/ui/dist ← wrong
];

// Fix: correct the tsup path (one extra ".." from dist/) and provide a
// genuine hoisted-node_modules fallback
const candidates = [
  // tsx: packages/cli/src → packages/ui/dist
  resolvePath(__dirname, "..", "..", "ui", "dist"),
  // tsup: packages/cli/dist → packages/ui/dist
  resolvePath(__dirname, "..", "..", "..", "ui", "dist"),
  // hoisted monorepo root: packages/cli/dist → <root>/packages/ui/dist
  resolvePath(__dirname, "..", "..", "..", "packages", "ui", "dist"),
];
```

If no candidate matches, emit a `process.stderr.write` warning so the user knows the UI will not be served (rather than silently running API-only).

---

### WR-02: `collect()` helper leaves a dangling `setInterval` after the timeout fires

**File:** `test/vertical-slice.test.ts:108-129`

**Issue:** `collect()` creates two timers: a `setTimeout` that resolves the promise after `durationMs`, and a `setInterval` (`tick`) that polls every 25 ms. The comment at line 126–128 (`// Stop interval when timer fires. void timer; void tick;`) is incorrect — `void` expressions are no-ops and do not cancel either timer. When the `setTimeout` fires and calls `res2(collected)`, `tick` is **not** cleared. It continues running every 25 ms for the remainder of the test process, calling `drain()` which silently moves items from the shared `buf` array into the now-resolved `collected` array. Any subsequent call to `next()` on the same `SseClient` may find `buf` already drained by the lingering tick, causing a spurious `SSE next() timeout` failure.

`collect()` is not called in the current test suite, so there is no active flakiness — but the bug will surface the moment `collect()` is exercised.

```typescript
// Fix: clear tick inside the timer callback
const timer = setTimeout(() => {
  clearInterval(tick);   // ← add this
  res2(collected);
}, durationMs);
const tick = setInterval(() => {
  drain();
  if (collected.length >= 200) {
    clearInterval(tick);
    clearTimeout(timer);
    res2(collected);
  }
}, 25);
```

---

## Info

### IN-01: Host-guard port regex permits invalid port numbers (> 65535)

**File:** `packages/server/src/host-guard.ts:7`

**Issue:** The allowed-host regex `\d{1,5}` matches any 1–5 digit port, allowing values up to 99999. A `Host` header such as `127.0.0.1:70000` passes the guard even though 70000 is not a valid TCP port. The practical security impact is negligible — the server's OS socket only accepts connections on its actual bound port — but the guard's intent is precision.

```typescript
// Fix: constrain to 0–65535
const ALLOWED_HOST_RE =
  /^(?:127\.0\.0\.1|localhost)(?::(?:6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|\d{1,4}))?$/i;
// Or simpler: validate the numeric value after the colon separately.
```

---

### IN-02: `toKill` variable in `cli-launch.test.ts` is declared but never used

**File:** `packages/cli/src/cli-launch.test.ts:9`

**Issue:** `let toKill: NodeJS.Process | null = null;` is declared at the describe-block scope, reset to `null` in `afterEach`, and only ever referenced via `void toKill` (line 69) — a no-op expression. It is never assigned a real value. The variable is dead code that misleads readers into thinking a process is being tracked.

**Fix:** Remove the `toKill` declaration and the `void toKill` statement.

---

### IN-03: `byteOffset` accounting assumes LF-only line endings

**File:** `packages/server/src/app-state.ts:183`

**Issue:** `byteOffset += byteLength + 1` adds exactly 1 byte for the consumed newline, assuming LF (`\n`). On Windows, JSONL files written with CRLF (`\r\n`) line endings would result in `byteOffset` undercounting by 1 byte per line (the `\r` is consumed by the splitter but not counted). Since `byteOffset` is used only as metadata stored in `EventRow.byteOffset` (not for file-seek operations), the practical effect is cosmetic. However, it is worth noting for completeness as the AHP log files may originate from Windows tooling.

**Fix:** If byte-accurate offset tracking is ever needed, use the splitter's reported byte counts, or add an option to account for CRLF.

---

_Reviewed: 2025-01-31_  
_Reviewer: gsd-code-reviewer_  
_Depth: standard_
