---
phase: 02-vertical-slice-cli-server-timeline
reviewed: 2026-05-07T16:30:00Z
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
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 02: Code Review Report (Re-review)

**Reviewed:** 2026-05-07  
**Depth:** standard  
**Files Reviewed:** 28  
**Status:** clean

## Summary

Re-review after code-review-fix iteration 1. All five previously reported findings (WR-01, WR-02, IN-01, IN-02, IN-03) are confirmed resolved. No new issues were identified.

### Previous findings — verification

| ID | Title | Status |
|----|-------|--------|
| WR-01 | `locateUiDist()` duplicate/broken candidates | ✅ Fixed |
| WR-02 | `collect()` dangling `setInterval` | ✅ Fixed |
| IN-01 | Host-guard port regex permits > 65535 | ✅ Fixed |
| IN-02 | Dead `toKill` variable in cli-launch.test.ts | ✅ Fixed |
| IN-03 | `byteOffset` LF-only assumption | ✅ Fixed |

**WR-01** — `locateUiDist()` now computes `cliPackageDir`, `workspacePackagesDir`, and `workspaceRootDir` from `__dirname`, builds three logically distinct candidates (workspace sibling, packaged CLI embed, monorepo root fallback), deduplicates them via `new Set(...)`, and emits a `process.stderr.write` warning when no `index.html` is found. The dead duplicate and broken third path are gone.

**WR-02** — `collect()` in `test/vertical-slice.test.ts` now declares `tick` before `timer` (eliminating the temporal dead zone in the interval's early-exit branch) and calls `clearInterval(tick)` inside the `setTimeout` callback so the polling interval is always cancelled when the duration expires. The dead `void timer; void tick;` no-op comments are removed.

**IN-01** — `ALLOWED_HOST_RE` in `packages/server/src/host-guard.ts` now uses the precise alternation `6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|\d{1,4}` instead of `\d{1,5}`, correctly restricting ports to 0–65535.

**IN-02** — The `toKill` declaration, its `afterEach` reset, and the `void toKill` no-op are removed from `cli-launch.test.ts`. Process cleanup is now done correctly via `lastChild` (assigned on every `spawnCliRaw` call and killed in `afterEach`).

**IN-03** — `byteOffset` accounting in `packages/server/src/app-state.ts` now detects CRLF per chunk (`text.includes("\r\n")`) and uses `newlineSize` (1 or 2) in the accumulation `byteOffset += byteLength + newlineSize`. The fix is correct for the common case of consistent line endings within a file.

All reviewed files meet quality standards.

---

_Reviewed: 2026-05-07_  
_Reviewer: gsd-code-reviewer_  
_Depth: standard_
