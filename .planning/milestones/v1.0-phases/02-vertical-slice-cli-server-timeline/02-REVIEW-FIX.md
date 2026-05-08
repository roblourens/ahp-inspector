---
phase: 02-vertical-slice-cli-server-timeline
fixed_at: 2026-05-07T15:59:45Z
review_path: .planning/phases/02-vertical-slice-cli-server-timeline/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-05-07T15:59:45Z  
**Source review:** .planning/phases/02-vertical-slice-cli-server-timeline/02-REVIEW.md  
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: `locateUiDist()` — first two candidates are identical; third resolves to a non-existent path

**Files modified:** `packages/cli/src/index.ts`  
**Commits:** e02ee02, 430a85b  
**Applied fix:** Replaced the duplicated/broken candidate list with de-duplicated candidates derived from the CLI package directory:
1. Workspace sibling layout: `packages/cli/{src,dist}` → `packages/ui/dist`
2. Packaged CLI layout: `packages/cli/ui/dist`
3. Monorepo root fallback: `<root>/packages/ui/dist`

Added a `process.stderr.write` warning when no candidate resolves to an existing `index.html`, so the user knows the server is running API-only mode rather than silently failing.

---

### WR-02: `collect()` helper leaves a dangling `setInterval` after the timeout fires

**Files modified:** `test/vertical-slice.test.ts`  
**Commit:** 9273ac4  
**Applied fix:** Added `clearInterval(tick)` inside the `setTimeout` callback so the polling interval is always cancelled when the duration expires. Also restructured so `tick` is declared before `timer` to avoid the temporal dead zone (the interval's early-exit branch already references `timer`). Removed the dead `void timer; void tick;` no-op comments.

---

### IN-01: Host-guard port regex permits invalid port numbers (> 65535)

**Files modified:** `packages/server/src/host-guard.ts`  
**Commit:** 215d769  
**Applied fix:** Replaced the loose `\d{1,5}` port pattern with a precise alternation that matches only values 0–65535:
```
6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|\d{1,4}
```
Verified with Node.js that `65535` passes, `65536` and `70000` are rejected, and common ports (`5173`, `3000`, `0`) still pass.

---

### IN-02: `toKill` variable in `cli-launch.test.ts` is declared but never used

**Files modified:** `packages/cli/src/cli-launch.test.ts`  
**Commit:** 1abd74d  
**Applied fix:** Removed the `let toKill: NodeJS.Process | null = null;` declaration, the `toKill = null;` reset in `afterEach`, and the `void toKill;` no-op expression at the end of the `--no-open` test.

---

### IN-03: `byteOffset` accounting assumes LF-only line endings

**Files modified:** `packages/server/src/app-state.ts`  
**Commit:** a4da6d2  
**Applied fix:** Detect CRLF vs LF once per chunk by checking `text.includes("\r\n")` and storing the result as `newlineSize` (2 for CRLF, 1 for LF). Use `byteOffset += byteLength + newlineSize` instead of the hardcoded `+1`. This is correct for the common case of consistent line endings per file (AHP log files). Mixed line endings within a single chunk remain an edge case that is left for future work if ever needed.

---

_Fixed: 2026-05-07T15:59:45Z_  
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 1_
