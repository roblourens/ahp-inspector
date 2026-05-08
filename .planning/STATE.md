---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Reducer-backed State Snapshots
status: in_progress
last_updated: "2026-05-08T16:10:19.000Z"
last_activity: 2026-05-08
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 15
  completed_plans: 6
  percent: 40
---

# State: AHP Log Viewer

## Project Reference

**Core Value:** Make AHP traffic understandable at a glance while preserving fast access to exact raw event details.
**Current Focus:** Milestone v1.1 — Reducer-backed State Snapshots

## Current Position

Phase: 7 complete; Phase 8 next
Plan: 07-01 through 07-03 complete
Status: Deterministic replay engine implemented and validated
Last activity: 2026-05-08 — Phase 7 added pure reducer-backed replay in @ahp-viewer/core with deterministic event-time reducer execution, diagnostics, reconnect handling, and client intent capture

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 6 / 6 |
| v1 requirements mapped | 41 / 41 |
| v1 requirements validated | 41 / 41 |
| Phase 02 P01 | 30min | 2 tasks | 12 files |
| Phase 02 P02 | 10min | 2 tasks | 17 files |
| Phase 02 P03 | 13min | 2 tasks | 12 files |
| Phase 02 P04 | 10min | 3 tasks | 16 files |
| Phase 02 P05 | 6min | 2 tasks | 9 files |
| Phase 02 P06 | 14min | 2 tasks | 9 files |
| Phase 03 P00 | 15min | 2 tasks | 11 files |
| Phase 03 P01 | 6 | 2 tasks | 7 files |
| Phase 03 P02 | 5min | 2 tasks | 5 files |
| Phase 03 P03 | 15min | 2 tasks | 14 files |
| Phase 03 P04 | 15min | 3 tasks | 17 files |
| Phase 03 P05 | 14min | 2 tasks | 15 files |
| Phase 03 P06 | 15min | 2 tasks | 29 files |
| Phase 04.1 plans | 6 planned | 16 tasks | ready |
| Phase 05 plans | 6 planned | 18 tasks | ready |
| Phase 04.1 Pall | 11min | 16 tasks | 37 files |
| Phase 05 Pall | 74min | 18 tasks | 50 files |
| v1.1 requirements mapped | 25 / 25 |
| v1.1 phases planned | 5 phases |
| Phase 06 plans | 3 complete | 8 tasks | validated |
| Phase 07 plans | 3 complete | 9 tasks | validated |

## Accumulated Context

### Key Decisions

- Standalone local web app first; VS Code extension deferred to v2 but architecture must accommodate it via a host adapter boundary.
- Target real JSONL as the canonical event source; current human-readable log is reachable only through a legacy parser adapter.
- Use `../agent-host-protocol` as the source of truth for AHP method, action, notification, and schema concepts.
- Local-only privacy posture: no telemetry, no CDN assets, no outbound network for viewing logs.
- Themes (light, dark, hacker) implemented via design tokens from the start so future VS Code theme integration does not require a UI rewrite.
- Plan 02-01: SSE heartbeat uses `setInterval` rather than a `stream.sleep` loop — the long await blocks subscriber writes and was the root cause of an integration-test timeout.
- Plan 02-01: `AppState` owns ingest + projection + listener fan-out behind one interface; SSE route handlers are pure transport.
- Plan 02-02: `tokens.css` is the single source of truth for every UI color/spacing/typography variable; a Vitest guard rejects raw `#xxxxxx` literals under `packages/ui/src/components/` so theme drift is impossible.
- Plan 02-02: Substituted lucide-react `FileBraces` for `FileJson` (FileJson is not exported in lucide-react@1.14.0); semantic match for a JSONL source, no dependency-lock churn.
- Plan 02-02: `useAppStore` (Zustand) is the single UI state surface (rows / connection / selectedIdx / meta + 7 actions); shell components are pure presentational and only `AppShell` reads the store.
- Plan 02-03: widen `DirectionGlyph` prop to `Direction | "unknown"` locally — shared `Direction` is `c2s|s2c` only, but UI-SPEC §5.1 requires an "unknown" fallback glyph; widened cell prop avoids changing the shared type.
- Plan 02-03: import `KindTag`/`ActionFamily`/`LatencyBand`/`Status` from `@ahp-viewer/core` barrel; import `Direction` from `@ahp-viewer/shared` (not re-exported by core).
- Plan 02-04: TanStack Virtual measures via `offsetWidth`/`offsetHeight` (virtual-core `getRect`), not `getBoundingClientRect`; virt test mocks both `HTMLElement.prototype` getters in jsdom to give the scroll element a non-zero viewport.
- Plan 02-04: window-scoped keydown handler in `TimelineRegion` (Up/Down/PageUp/PageDown/Home/End/Esc); empty-rows guard prevents bogus selection when no rows exist.
- Plan 02-04: `App.tsx` routes to `ServerNotRunningState` full-page (before `AppShell`) when `connection === "no-server"`; Plan 02-06 SSE client will set this on EventSource failure.
- Plan 02-05: `classifyDirection` assumes client-side capture — request `{id, method}` → c2s; response (`result`/`error`) and server-originated `method === "action"|"notification"` → s2c. A future flag will inject an inverted inference for server-side logs.
- Plan 02-05: deleted Phase-1 `cli.smoke.test.ts` (depended on removed `--no-server` flag); `cli-launch.test.ts` is its strict superset and asserts UI-SPEC §10 verbatim copy + 127.0.0.1-only binding via `not.toMatch(/0\.0\.0\.0/)` and `/localhost/`.
- Plan 02-05: dropped plan-prescribed `serverHandle.sayGoodbye()` call — method does not exist on `LogServerHandle`; CLI shutdown disposes `appState` then `serverHandle.close()` only. SSE 'bye' broadcast is a route-layer concern Plan 02-06 will exercise via the EventSource client.
- Plan 02-06: SSE client buffers snapshot chunks locally and only commits to the store on `snapshot-end` (single setRows). Mid-snapshot store is empty by design — avoids virtualized rerender thrash on large baselines.
- Plan 02-06: graceful `bye` flips connection to 'disconnected' and explicitly closes the EventSource; transient `onerror` keeps state at 'connecting' so the browser's built-in retry loop is not poisoned (T-02-06-02).
- Plan 02-06: App.tsx probes `/api/log/meta` once on mount before opening the stream — separates 'no server' (HTTP probe failure) from 'disconnected' (SSE drop), matching ServerNotRunningState semantics from Plan 02-04. `window.__ahpStream` holds the active ConnectionHandle for DisconnectedBanner reconnect.
- Plan 02-06: `registerStaticUi` mounts on absolute distDir under the existing `app.use("*", cspMiddleware)` registration, so static responses inherit CSP/nosniff/no-referrer (T-02-06-03). CLI auto-discovers `packages/ui/dist` via `locateUiDist()`.
- Plan 02-06: vertical-slice test treats request/response correlation as collapsed-into-snapshot for the file-read flow (CLI ingests entire fixture before SSE client connects); separate `append`+`patch` cycle is covered by `test/sse-integration.test.ts` (Plan 02-01) using a fake host.
- Plan 03-00: `EventRowExtras` uses optional parameter with `DEFAULT_EXTRAS` default — avoids breaking callers that don't need extras; extras computation lives in `AppState.buildRow` (server) to respect boundary.test.ts portable-package restrictions.
- Plan 03-00: `lastSeenServerSeq Map<string|null, number>` in `AppState` tracks per-session serverSeq for gap detection; `eventAt(idx)` added to `AppState` interface as the hook Plan 03-01 uses for the raw event detail API endpoint.
- Plan 03-01: `SearchIndex.scan` uses `String.prototype.includes` (no regex from user input) with query capped at 256 chars and result count capped at 5000 — mitigates T-03-01-01 (ReDoS) and T-03-01-02 (unbounded result DoS).
- Plan 03-01: `correlatorDataFor(idx)` added to `AppState` interface — exposes correlator metadata (pairIdx, latencyMs, status) to route handlers without leaking the private `Correlator` object; keeps detail-routes.ts a thin HTTP adapter.
- Plan 03-02: `useDeferredValue` wraps filters and searchMatches in `useFilteredRows` — mitigates T-03-02-01 (DoS: main-thread block at 50k+ rows); perf gate confirmed 11 ms < 15 ms threshold.
- Plan 03-02: Conditional spread `{ ...(row.turnId !== null ? { turnId } : {}) }` used for VirtualItem header to satisfy `exactOptionalPropertyTypes`; `?.has()` optional chaining replaces `!` non-null assertion on deferredMatches.
- Plan 03-03: FacetPopover capped at 100 visible options with "…and N more" footer — T-03-03-02 DoS mitigation for large session lists.
- Plan 03-03: biome `useSemanticElements` rule requires `<input type="radio">+<label>` over `<button role="radio">`; plan prescribed the button pattern but the semantic HTML version is equivalent for a11y.
- Plan 03-04: fetchEvent uses conditional init object for AbortSignal (exactOptionalPropertyTypes: fetch signal must be AbortSignal|null, not undefined)
- Plan 03-04: AhpFieldStrip uses conditional spread pattern for optional props — required by exactOptionalPropertyTypes; PrettyJsonView casts data as object for react-json-view-lite
- Plan 03-05: search-client.ts uses conditional spread for AbortSignal — RequestInit.signal is AbortSignal|null (not |undefined); exactOptionalPropertyTypes enforcement
- Plan 03-05: SearchInput accepts ref as plain prop (React 19 — no forwardRef needed); FilterBar passes searchInputRef via conditional spread
- Plan 03-05: TimelineList.onSelect wraps store selectIdx in lambda to adapt (number|null)→void to number→void
- Plan 03-05: highlightMatches uses React mark elements with CSS token colors — never interpret searchQuery as HTML (XSS-safe per T-03-05-03)
- Plan 03-05: StickyGroupBar returns null when topGroup is null — no DOM overhead when grouping is off
- Plan 03-06: @vitest-environment jsdom directive needed for UI hook tests run via root vitest config — avoids breaking `pnpm test` when selectors.test.ts and search-client.test.ts run without jsdom environment
- Plan 03-06: return null over <></> for early-return JSX components; requires JSX.Element|null return type annotation; satisfies biome noUselessFragments
- Plan 03-06: tabIndex={-1} on gap-banner and group-header role=row divs — biome useFocusableInteractive requires programmatic focusability; keyboard navigation managed at TimelineRegion level
- Phase 05: Playwright browser UAT uses @playwright/test, starts the local CLI/server against copied synthetic fixtures, captures the committed screenshot matrix, and verifies no absolute path leakage in browser-visible text.
- Phase 05: Responsive details use a desktop side rail at >=1400px and an overlay drawer below 1400px; theme choice remains global under `ahp-theme` while per-log preferences remain keyed by opaque logKey.
- Phase 06: `@ahp-viewer/protocol` is a generated workspace package synced from sibling `../agent-host-protocol/types` via `pnpm sync:ahp`; generated files carry a DO NOT EDIT banner and source commit metadata.
- Phase 06: Parser code imports canonical `ActionEnvelope` / `ProtocolNotification` directly from `@ahp-viewer/protocol`; `@ahp-viewer/shared/ahp` remains only as compatibility aliases for old I-prefixed names.
- Phase 06: Reducer parity tests run copied upstream synthetic reducer fixtures with `Date.now()` mocked to `9999`; fixture privacy tests prevent real JSONL/log data from entering the generated fixture set.
- Milestone v1.1: reducer-backed state reconstruction should be implemented as server-side replay of canonical AHP snapshots/action envelopes, using synced protocol reducers from `../agent-host-protocol` and explicit confidence diagnostics for partial logs.

### Open TODOs

- None.

### Blockers

- None.

### Roadmap Evolution

- 2026-05-08: Started v1.1 "Reducer-backed State Snapshots" with phases 6-10.

- Phase 04.1 inserted after Phase 4 (URGENT): Timeline row information polish and real-log validation.
- Phase 04.1 completed: ID-first timeline rows, Summary column, request/response pair highlighting, nested session/turn extraction, expanded Pretty JSON defaults, and privacy-safe real-log structural validation are in place.
- Phase 05 completed: polished dark/light/hacker themes, responsive drawer/rail layout, theme persistence hardening, integrated UI coverage, Playwright E2E, UAT screenshots, and final verification gate are complete.
- Milestone v1.0 archived: roadmap, requirements, audit, milestones index, project state, and retrospective are updated.

## Session Continuity

**Last session:** 2026-05-08T04:57:00.498Z
**Next action:** `/gsd-new-milestone`
**Stopped at:** Milestone v1.0 archived

---
*State initialized: 2026-05-06*
