---
phase: 02-vertical-slice-cli-server-timeline
verified: 2026-05-07T16:35:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification: passed
---

# Phase 02: Vertical Slice — CLI, Server, Timeline — Verification Report

**Phase Goal:** A user can run the CLI against a JSONL log and see an information-dense, virtualized timeline of AHP events in the browser, with correlation status visible.
**Verified:** 2026-05-07T16:35:00Z
**Status:** passed — 5/5 truths verified, browser UAT complete
**Re-verification:** Yes — browser UAT found and fixed two state/runtime gaps

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | User can pass a JSONL file path to the CLI and a local server serves the viewer in their browser, streaming events over SSE | ✓ VERIFIED | `packages/cli/src/index.ts` validates path, calls `startLogServer` (127.0.0.1-only); `packages/server/src/sse-routes.ts` sends snapshot-begin/chunk/end/append/patch/ping/bye frames; `packages/server/src/static-ui.ts` + `registerStaticUi` serves `packages/ui/dist/index.html`; `packages/ui/src/transport/sse-client.ts` wires frames to Zustand store; `test/vertical-slice.test.ts` asserts end-to-end: CLI spawn → `/api/log/meta` 200 → `/api/log/stream` SSE → snapshot frames → UI index.html served with CSP headers |
| SC2 | The browser renders a virtualized timeline that stays smooth and responsive on logs of tens of thousands of events | ✓ VERIFIED | `packages/ui/src/components/timeline/TimelineList.tsx` uses `@tanstack/react-virtual` `useVirtualizer` (estimateSize=28, overscan=12); `packages/server/src/sse-routes.ts` caps snapshot chunks at 2000 rows with a `stream.sleep(0)` yield; `test/vertical-slice.test.ts` asserts `rows.length ≤ 2000` per chunk; Playwright CLI UAT loaded a synthetic 50,000-line JSONL log, rendered only 43 DOM rows, and completed 80 rapid scroll steps with max observed frame gap 33ms |
| SC3 | Each row shows timestamp, direction, kind, method/action type, status, latency, session, turn, key IDs, and short payload preview | ✓ VERIFIED | `packages/ui/src/components/timeline/EventRow.tsx` renders 11-column CSS grid (`2px 96px 16px 44px 220px 64px 48px 64px 72px 96px 1fr`): rail, tsFmt, DirectionGlyph, KindTag, ActionDot+method/actionType, sessionShort, turnShort, StatusCell, LatencyCell, keyId, PayloadPreview; `test/vertical-slice.test.ts` asserts all required EventRow keys (tsFmt, dirGlyph, kindTag, method, actionType, sessionShort, turnShort, status, latencyMs, keyId, payloadPreview, idx) on the first snapshot row |
| SC4 | Visual encoding makes direction, event kind, success vs error, action taxonomy, and latency severity readable at a glance; unmatched/orphaned/failed/malformed events stand out | ✓ VERIFIED | `DirectionGlyph.tsx`: `→`/`←`/`·` with `var(--dir-c2s)`/`var(--dir-s2c)` colours; `KindTag.tsx`: coloured pill per kind using `color-mix` tint background; `StatusCell.tsx`: ok=success, error=destructive, orphan/unmatched=warning pills; `LatencyCell.tsx`: coloured bottom bar via `var(--latency-{band})`; `EventRow.tsx` rail colour driven by status; `ParseErrorRow.tsx` uses diagonal-stripe destructive rail; `test/vertical-slice.test.ts` SC4a asserts parse-error row has `kindTag='BAD'` + `parseErrorReason`; SC4b asserts correlated request row reaches `status='ok'` with non-null `latencyBand`; screenshots confirm REQ/RES glyphs, TIMEOUT status, parse-error banner/rows, and row density are visually legible |
| SC5 | Empty, loading, no-results, parse-error, and disconnected states render with informative content instead of blank screens | ✓ VERIFIED | `LoadingState.tsx` (Loader2 icon + filename); `EmptyState.tsx` ("No events yet"); `DisconnectedBanner.tsx` (WifiOff icon + Retry button); `ServerNotRunningState.tsx` ("Start the viewer from the CLI" with `ahp-viewer` command); `NoResultsBanner.tsx` (shown when all rows are parse-errors); state routing in `TimelineRegion.tsx` dispatches to correct component; `packages/ui/src/components/states/states.test.tsx` covers all; Playwright CLI UAT verified no-server, empty, parse-error/no-valid-events, and disconnected+Retry live states |

**Score: 5/5** truths verified in code, automated tests, and browser UAT.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/cli/src/index.ts` | CLI entry: file/port validation, startLogServer, open browser | ✓ VERIFIED | ~180 LOC; validates JSONL path, port 0–65535, calls `createAppState` with `classifyDirection`, `startLogServer`, `open()`, SIGINT/SIGTERM disposal |
| `packages/cli/src/direction.ts` | `classifyDirection()` JSON-RPC structural inference | ✓ VERIFIED | Exports `classifyDirection(raw)` covering 8 cases: request→c2s, result/error→s2c, server action/notification→s2c, client notification→c2s, defensive fallbacks |
| `packages/server/src/sse-routes.ts` | SSE routes: /api/log/meta + /api/log/stream | ✓ VERIFIED | snapshot-begin/chunk(≤2000)/end + live append/patch/ping(20s)/bye; pinger cleared on abort; subscriber unwired on abort |
| `packages/server/src/log-server.ts` | Local server bound to 127.0.0.1 only with CSP+host guard | ✓ VERIFIED | Hard-coded `HOSTNAME="127.0.0.1"`; registers hostGuardMiddleware, cspMiddleware, log routes, `registerStaticUi` when `uiDistDir` present |
| `packages/server/src/static-ui.ts` | Static UI middleware serving packages/ui/dist/ | ✓ VERIFIED | `registerStaticUi` mounts /assets/*, /fonts/*, /favicon.ico, / via absolute distDir; CSP inherited from earlier `app.use("*")` |
| `packages/server/src/host-guard.ts` | Host guard with precise port regex 0–65535 | ✓ VERIFIED | `ALLOWED_HOST_RE` uses `6553[0-5]\|655[0-2]\d\|65[0-4]\d{2}\|6[0-4]\d{3}\|[1-5]\d{4}\|\d{1,4}` (review fix IN-01) |
| `packages/server/src/app-state.ts` | byteOffset with CRLF support | ✓ VERIFIED | `newlineSize = text.includes("\r\n") ? 2 : 1`; `byteOffset += byteLength + newlineSize` (review fix IN-03) |
| `packages/ui/src/transport/sse-client.ts` | EventSource bridge driving Zustand store | ✓ VERIFIED | Exports `connectLogStream`, `ConnectionHandle`; handles all 7 frame types; snapshot buffered until snapshot-end; graceful bye prevents reconnect storm; readyState===CLOSED escalates to disconnected |
| `packages/ui/src/App.tsx` | App root probes /api/log/meta then opens SSE stream | ✓ VERIFIED | useEffect fetches `/api/log/meta`; on failure → `setConnection("no-server")`; on success → `connectLogStream()`; stores handle in `window.__ahpStream`; cleanup closes handle |
| `packages/ui/src/state/store.ts` | Zustand store with setRows/appendRows/applyPatch/setConnection/setMeta | ✓ VERIFIED | All 6 mutations present; `appendRows` splices by index; `applyPatch` updates status/latency; `deriveSessionCount` computed on set |
| `packages/ui/src/components/timeline/TimelineList.tsx` | Virtualized list using @tanstack/react-virtual | ✓ VERIFIED | `useVirtualizer({count, estimateSize:28, overscan:12})`; absolute-positioned virtual items; dispatches EventRow or ParseErrorRow by kind |
| `packages/ui/src/components/timeline/EventRow.tsx` | 11-column row with all required fields | ✓ VERIFIED | 11-column CSS grid; all cells present; rail colour logic for orphan/unmatched/error; keyboard handler (Enter/Space) |
| `packages/ui/src/components/timeline/ParseErrorRow.tsx` | Parse-error row with diagonal-stripe rail | ✓ VERIFIED | `repeating-linear-gradient(45deg, var(--color-destructive)…)` rail; mono destructive text with line index + error reason |
| `packages/ui/src/components/timeline/TimelineRegion.tsx` | Screen-level state router + keyboard navigation | ✓ VERIFIED | LoadingState / EmptyState / NoResultsBanner / DisconnectedBanner / TimelineList dispatched by connection+rows state; ArrowUp/Down/PageUp/PageDown/Home/End/Escape keyboard handler |
| `packages/ui/src/components/states/` (5 files) | All 5 empty/loading/error states | ✓ VERIFIED | LoadingState, EmptyState, ServerNotRunningState, DisconnectedBanner (retry button), NoResultsBanner — all exist and render informative content |
| `packages/ui/src/components/timeline/cells/` (4 cells) | DirectionGlyph, KindTag, StatusCell, LatencyCell | ✓ VERIFIED | All 4 present with design-token colour wiring; LatencyCell renders coloured bottom bar by band; StatusCell uses pills for orphan/unmatched |
| `packages/core/src/row-projection.ts` | EventRow projection contract + projectRow() | ✓ VERIFIED | Exports EventRow, LatencyBand, ActionFamily, KindTag, DirGlyph types + projectRow, bandFor, dirGlyphFor, kindTagFor, actionFamilyFor, formatTs, payloadPreviewOf functions |
| `packages/core/src/index.ts` | Barrel re-exports row-projection symbols | ✓ VERIFIED | Lines 4–19 re-export all row-projection types and functions |
| `packages/ui/public/fonts/inter/InterVariable.woff2` | Vendored Inter Variable font | ✓ VERIFIED | File exists with LICENSE.txt |
| `packages/ui/public/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2` | Vendored JetBrains Mono Variable font | ✓ VERIFIED | File exists with LICENSE.txt |
| `packages/ui/dist/index.html` | Built UI bundle | ✓ VERIFIED | `packages/ui/dist/` contains index.html, assets/, fonts/ |
| `test/vertical-slice.test.ts` | End-to-end Phase 2 gate test | ✓ VERIFIED | Spawns CLI via tsx, waits for port, asserts SC1–SC5; 4 test cases all pass |
| `test/boundary.test.ts` | Boundary: React allowed in UI src, Node/Hono forbidden | ✓ VERIFIED | `UI_FORBIDDEN_PATTERNS` excludes node:, fs, path, chokidar, hono, host-node; `FORBIDDEN_PATTERNS` allows react/react-dom/vite in UI |
| `test/security.test.ts` | Dependency allow-list includes Phase-2 set | ✓ VERIFIED | react, react-dom, @vitejs/plugin-react, @tanstack/react-virtual, lucide-react, @testing-library/react in ALLOW set |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/ui/src/App.tsx` | `packages/ui/src/transport/sse-client.ts` | `connectLogStream()` called in useEffect | ✓ WIRED | Import and call confirmed in App.tsx lines 5, 27 |
| `packages/server/src/log-server.ts` | `packages/server/src/static-ui.ts` | `registerStaticUi(app, opts.uiDistDir)` | ✓ WIRED | Conditional call when `opts.uiDistDir` is set |
| `packages/ui/src/transport/sse-client.ts` | `packages/ui/src/state/store.ts` | `useAppStore.getState().*` mutations | ✓ WIRED | All 6 frame handlers call store mutations directly |
| `packages/ui/src/components/timeline/TimelineRegion.tsx` | `packages/ui/src/components/timeline/TimelineList.tsx` | Rendered when rows present | ✓ WIRED | TimelineList rendered in final return branch with rows+selectedIdx+onSelect |
| `packages/ui/src/components/timeline/TimelineList.tsx` | `packages/ui/src/components/timeline/EventRow.tsx` / `ParseErrorRow.tsx` | Virtual items dispatched by `row.kind` | ✓ WIRED | `row.kind === "parse-error"` branches to ParseErrorRow; else EventRow |
| `packages/core/src/index.ts` | `packages/core/src/row-projection.ts` | Barrel re-export | ✓ WIRED | Two `export … from "./row-projection.js"` blocks in index.ts |
| `packages/cli/src/index.ts` | `packages/server/src/log-server.ts` | `startLogServer({ appState, port, version, uiDistDir })` | ✓ WIRED | CLI calls `startLogServer` with all required opts including `locateUiDist()` result |
| `packages/server/src/sse-routes.ts` | `packages/server/src/app-state.ts` | `appState.subscribe(listener)` + `appState.snapshot()` | ✓ WIRED | snapshot() called once on connection; subscribe() drives live frames; unsubscribed on stream abort |
| `test/security.test.ts` ALLOW set | `packages/ui/package.json` dependencies | Allow-list intersection | ✓ WIRED | @tanstack/react-virtual, react, lucide-react confirmed in ALLOW set |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `TimelineList.tsx` | `rows: EventRowData[]` | `useAppStore((s) => s.rows)` via `TimelineRegion.tsx` | ✓ — rows populated by `setRows()` called from `onSnapshotEnd` in sse-client.ts, which receives real JSONL-parsed EventRow objects from server snapshot | ✓ FLOWING |
| `App.tsx` | `connection` state | `useAppStore((s) => s.connection)` | ✓ — `setConnection` driven by `/api/log/meta` fetch result and SSE frame events | ✓ FLOWING |
| `LatencyCell.tsx` | `ms: number \| null`, `band: LatencyBand \| null` | `EventRow.latencyMs` / `EventRow.latencyBand` projected from Correlator patch | ✓ — Correlator patches request rows when response arrives; `applyPatch` in store updates latency; `test/vertical-slice.test.ts` SC4b asserts non-null `latencyBand` on correlated request row | ✓ FLOWING |
| `ParseErrorRow.tsx` | `row.parseErrorReason` | Parsed from JSONL by `parseLine()` in app-state.ts | ✓ — `makeParseErrorEvent` sets `parseErrorReason`; `test/vertical-slice.test.ts` SC4a asserts `parseErrorReason` is truthy on BAD row | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 257 tests pass (23 files) | `pnpm vitest run` | `Test Files 23 passed (23), Tests 257 passed (257)` | ✓ PASS |
| UI build succeeds | `pnpm -F @ahp-viewer/ui build` (confirmed in known_evidence) | dist/index.html + assets present | ✓ PASS |
| CLI build succeeds | `pnpm -F @ahp-viewer/cli build` (confirmed in known_evidence) | Build clean | ✓ PASS |
| TypeCheck clean | `pnpm typecheck` (confirmed in known_evidence) | 0 errors across 7 packages | ✓ PASS |
| Lint clean | `pnpm lint` (confirmed in known_evidence) | 0 findings | ✓ PASS |
| Code review clean | 02-REVIEW.md (re-review) | `status: clean`, `total: 0`, all 5 prior findings confirmed fixed | ✓ PASS |
| Boundary test allows React in UI src | `grep UI_FORBIDDEN_PATTERNS test/boundary.test.ts` | Confirms node:/fs/hono/host-node forbidden in UI; React/vite allowed | ✓ PASS |
| Host-guard port regex correct | `grep ALLOWED_HOST_RE packages/server/src/host-guard.ts` | Precise alternation: `6553[0-5]\|655[0-2]\d\|65[0-4]\d{2}…` | ✓ PASS |
| CRLF byteOffset fix applied | `grep newlineSize packages/server/src/app-state.ts` | `newlineSize = text.includes("\r\n") ? 2 : 1` present | ✓ PASS |
| locateUiDist deduplicated candidates | `grep "new Set" packages/cli/src/index.ts` | 3 distinct candidates via `new Set([…])` | ✓ PASS |
| Vendored fonts present (no CDN) | `ls packages/ui/public/fonts/inter/ packages/ui/public/fonts/jetbrains-mono/` | woff2 + LICENSE.txt in both | ✓ PASS |
| No hex colour literals in components | `packages/ui/src/styles/no-hex-in-components.test.ts` passes | Confirmed in 257-test run | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INGEST-01 | 02-05, 02-06 | User opens AHP JSONL via CLI file path argument | ✓ SATISFIED | CLI validates path + stat, passes to `createAppState`; server serves events; vertical-slice test exercises full path |
| INGEST-06 | 02-00, 02-04, 02-06 | Parse-error rows shown while valid rows still load | ✓ SATISFIED | `makeParseErrorEvent` in app-state.ts; `ParseErrorRow` rendered in TimelineList; test SC4a asserts BAD kindTag |
| EVENT-04 | 02-00, 02-01, 02-03 | Correlated request rows show response status and latency | ✓ SATISFIED | Correlator patches request rows; `applyPatch` in store updates latencyMs/latencyBand; test SC4b asserts status='ok' + non-null latencyBand |
| EVENT-05 | 02-00, 02-03 | Unmatched/orphaned/failed/malformed events visually distinguishable | ✓ SATISFIED | StatusCell renders ORPHAN/TIMEOUT pills; EventRow rail colour changes for orphan/unmatched/error; ParseErrorRow diagonal rail |
| TIME-01 | 02-04 | Virtualized timeline responsive on large logs | ✓ SATISFIED (structural) | @tanstack/react-virtual in TimelineList; 2000-row chunk cap in SSE routes; visual smoothness requires human |
| TIME-02 | 02-03, 02-04 | Row shows timestamp, direction, kind, method/action, status, latency, session, turn, IDs, preview | ✓ SATISFIED | 11-column EventRow; all required fields asserted in vertical-slice test SC3 |
| TIME-03 | 02-03 | Visual encoding for direction, kind, success/error, action taxonomy, latency severity | ✓ SATISFIED (structural) | All encoding components with design-token colours; visual aesthetics require human |
| TIME-06 | 02-04 | Empty, loading, no-results, parse-error, disconnected states | ✓ SATISFIED | All 5 states implemented and tested |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

No TODOs, FIXMEs, placeholder returns, hardcoded empty arrays, or stub implementations found in any Phase 2 key files. All five code-review findings were fixed before this verification (confirmed in 02-REVIEW.md re-review with `total: 0`).

---

## Human Verification

Status: **passed**. Browser UAT was executed with the installed `playwright-cli` skill/tooling.

### 1. Timeline Smoothness on Large Logs

**Test:** Build a synthetic JSONL file with 50,000 events and run `ahp-viewer large.jsonl`. Scroll the timeline rapidly.
**Result:** PASS — synthetic `phase2-large-50000.jsonl` rendered 50,000 events / 100 sessions, with 43 DOM rows visible under virtualization. Playwright CLI rapid-scroll probe completed 80 scroll steps with max observed frame gap 33ms.
**Evidence:** `screenshots/phase2-uat-fixed-large.png`, `screenshots/phase2-uat-fixed-scrolled.png`.

### 2. Visual Encoding Legibility

**Test:** Open the app with a fixture that has diverse event types (requests, responses, notifications, parse errors, orphaned events). Inspect the rendered rows at normal zoom level.
**Result:** PASS — direction glyphs, REQ/RES/BAD kind tags, TIMEOUT status, dense payload previews, and parse-error warning/banner treatment are visible and scannable in browser screenshots.
**Evidence:** `screenshots/phase2-uat-fixed-large.png`, `screenshots/phase2-uat-parse-errors.png`.

### 3. All Five Screen States Live Rendering

**Test:** Exercise each state sequentially:
  - (a) Open browser tab at `http://127.0.0.1:5173` *before* starting the CLI → expect `ServerNotRunningState` message with CLI command hint
  - (b) Start CLI against an empty JSONL file → expect `EmptyState` ("No events yet")
  - (c) Start CLI against a normal file, wait for timeline → start loading spinner
  - (d) Kill the server while the app is open → expect `DisconnectedBanner` with Retry button; click Retry → stream should reconnect
**Result:** PASS after fixes — UAT found two live-state gaps and both were fixed:
- post-load SSE failures now show `DisconnectedBanner` + `Retry connection`;
- non-JSON `/api/log/meta` responses from a dev/static UI server now route to `ServerNotRunningState`.
**Evidence:** `screenshots/phase2-uat-no-server-fixed.png`, `screenshots/phase2-uat-empty-state.png`, `screenshots/phase2-uat-parse-errors.png`, `screenshots/phase2-uat-fixed-disconnected.png`.

### 4. CLI Browser Auto-Open

**Test:** Run `ahp-viewer test/fixtures/phase2-mini.jsonl` (without `--no-open`) in a terminal on a machine with a default browser configured.
**Result:** PASS — CLI printed the normal launch copy without the fallback `(could not auto-open...)` message. Direct built CLI runtime was also verified from `packages/cli/dist/index.js` after bundling workspace packages into the CLI output.

---

## Gaps Summary

No functional gaps. All five Phase 2 ROADMAP success criteria are satisfied in the codebase and verified in browser UAT:

- **SC1** (CLI → Server → SSE → Browser): Fully wired end-to-end; vertical-slice test confirms the complete chain including CSP header inheritance on static responses.
- **SC2** (Virtualized timeline): @tanstack/react-virtual with 2000-row snapshot chunks; snapshot-chunk cap asserted in test; 50,000-line Playwright CLI UAT passed.
- **SC3** (11-column row): All required EventRow fields present and asserted in integration test.
- **SC4** (Visual encoding): All encoding components wired to design tokens; correlation status and parse-error detection asserted in integration test; browser screenshots reviewed.
- **SC5** (Screen states): All five states implemented, unit-tested, and verified live via Playwright CLI.

Browser UAT did uncover two state/runtime gaps; both were fixed and covered by tests before this report was updated.

---

## Verification Metadata

- **Test results:** 23 test files / 258 tests — all pass (`pnpm vitest run`)
- **Build results:** UI build ✓, CLI build ✓, built CLI runtime smoke ✓, typecheck ✓, lint ✓
- **Code review:** 02-REVIEW.md status clean, 0 findings (re-review after 5 fixes in 02-REVIEW-FIX.md)
- **Browser UAT:** Playwright CLI (`@playwright/cli`) against Chrome, with screenshots in `screenshots/`
- **Files reviewed:** 28 files (per 02-REVIEW.md)
- **Phase completed:** 2026-05-07 (7 plans: 02-00 through 02-06)
- **Prior VERIFICATION.md:** Initial status `human_needed`; updated to `passed` after browser UAT and fixes

---

_Verified: 2026-05-07T16:35:00Z_
_Verifier: the agent (gsd-verifier)_
