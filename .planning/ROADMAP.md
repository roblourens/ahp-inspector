# Roadmap: AHP Log Viewer

**Created:** 2026-05-06
**Granularity:** standard
**Coverage:** 41/41 v1 requirements mapped ✓

## Vision

Make AHP traffic understandable at a glance while preserving fast access to exact raw event details — delivered first as a polished standalone local web app, with architecture that lets the same UI later run inside a VS Code webview.

## Phases

- [x] **Phase 1: Core Foundations** - Project scaffolding, canonical event model, JSONL + sample parsers, EventStore, host adapter boundary (completed 2026-05-07)
- [x] **Phase 2: Vertical Slice — CLI, Server, Timeline** - Open a JSONL file from the CLI and render an information-dense virtualized timeline in the browser (completed 2026-05-07)
- [x] **Phase 3: Detail, Search, and Filtering** - Inspect events deeply, search and filter responsively, group by session/turn (completed 2026-05-07)
- [ ] **Phase 4: Live Tail, Discovery, and Persistence** - Auto-discover VS Code logs, watch growing files, pause/resume, persist filter state per log
- [ ] **Phase 5: Themes, Polish, and Verification** - Light/dark/hacker themes via design tokens, responsive layout, full UI + E2E test coverage

## Phase Details

### Phase 1: Core Foundations
**Goal**: Establish a clean architecture with a canonical AHP event model, working parsers, an in-memory EventStore, and a host adapter boundary that keeps Node-only capabilities out of the UI.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, INGEST-07, EVENT-01, EVENT-02, EVENT-03, VERIFY-01, VERIFY-04
**Success Criteria** (what must be TRUE):
  1. Developer can clone the repo, install dependencies, and run a CLI entrypoint that boots the local app shell with no outbound network calls or CDN assets.
  2. A JSONL parser converts raw lines into a canonical event model (timestamp, direction, kind, method/action, IDs, session/turn, sequence, raw payload, parse status) sourced conceptually from `../agent-host-protocol`.
  3. A legacy adapter parses the current human-readable sample log into the same canonical model without leaking its format into the core.
  4. Request/response correlation produces a JSON-RPC-safe bidirectional key that preserves session, direction, id value, and id type.
  5. Parser/normalizer tests cover valid JSONL, malformed lines, partial trailing lines, CRLF/BOM, large payloads, correlation, and the legacy adapter — using scrubbed fixture logs.
**Plans**: 3 plans
- [x] 01-01-PLAN.md — Workspace + tooling scaffold + Wave 0 boundary/security/fixture-scrub tests
- [x] 01-02-PLAN.md — Shared AHP/event/host contracts + JSONL parser + normalizer + legacy adapter
- [x] 01-03-PLAN.md — EventStore + Correlator + NodeHostAdapter + Hono health server + CLI entry
**UI hint**: no

### Phase 2: Vertical Slice — CLI, Server, Timeline
**Goal**: A user can run the CLI against a JSONL log and see an information-dense, virtualized timeline of AHP events in the browser, with correlation status visible.
**Depends on**: Phase 1
**Requirements**: INGEST-01, INGEST-06, EVENT-04, EVENT-05, TIME-01, TIME-02, TIME-03, TIME-06
**Success Criteria** (what must be TRUE):
  1. User can pass a JSONL file path to the CLI and a local server serves the viewer in their browser, streaming events to the UI over an SSE-style transport.
  2. The browser renders a virtualized timeline that stays smooth and responsive on logs of tens of thousands of events.
  3. Each row shows timestamp, direction, kind, method/action type, status, latency, session, turn, key IDs, and a short payload preview.
  4. Visual encoding makes direction, event kind, success vs error, action taxonomy, and latency severity readable at a glance, and unmatched / orphaned / failed / malformed events stand out.
  5. Empty, loading, no-results, parse-error, and disconnected states render with informative content instead of blank screens.
**Plans**: 7 plans
- [x] 02-00-PLAN.md — Wave 0: boundary/security guardrails, @ahp-viewer/ui skeleton + jsdom, vendored fonts, EventRow projection contract
- [x] 02-01-PLAN.md — AppState + Projector + SSE routes + CSP/Host-guard middleware
- [x] 02-02-PLAN.md — UI foundations: tokens / fonts / global CSS / Zustand store / app shell chrome / TimelineRegion stub / hex-literal guard
- [x] 02-03-PLAN.md — Timeline cells: DirectionGlyph / KindTag / ActionDot / StatusCell / LatencyCell / PayloadPreview (+ tests)
- [x] 02-04-PLAN.md — Wave 2: Five screen-level states + EventRow / ParseErrorRow / TimelineList virtualization + TimelineRegion (replaces 02-02 stub) + App.tsx state routing
- [x] 02-05-PLAN.md — Wave 2: CLI launch path, browser open, error copy, --port validation, structural direction inference
- [x] 02-06-PLAN.md — Wave 3: SSE client wiring + static-UI mount + vertical-slice gate test
**UI hint**: yes

### Phase 3: Detail, Search, and Filtering
**Goal**: A user can pick any event, inspect it deeply, and slice the timeline by free-text search and faceted filters without losing responsiveness.
**Depends on**: Phase 2
**Requirements**: TIME-04, TIME-05, DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04, SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, EVENT-06
**Success Criteria** (what must be TRUE):
  1. User can select rows with mouse or keyboard and open a detail view that shows summary fields, correlation metadata, and the full raw JSON without breaking timeline virtualization.
  2. Detail view supports folded pretty JSON, raw JSON text, syntax highlighting, truncation for huge payloads, and copy actions, and highlights AHP-specific fields (session, turn, tool call, action type, serverSeq, origin, request id, error code, notification type) when present.
  3. User can run free-text search across method, action type, IDs, session, turn, error text, and payload text, and combine it with filters for direction, kind, method, action type, session, turn, status, and time range.
  4. Search and filter changes update the visible timeline without blocking typing, with active filters visible at a glance and a clear-all action.
  5. User can toggle session/turn grouping to read traffic as a story; server sequence gaps and authentication failures are surfaced when present.
**Plans**: 7 plans
Plans:
**Wave 1**
- [x] 03-00-PLAN.md — Wave 0: Foundation (security allowlist, EventRow extension, Phase 3 tokens, test scaffold)
- [x] 03-01-PLAN.md — Wave 1a: Detail + Search backend endpoints (GET /api/log/event/:idx + GET /api/log/search)
- [x] 03-02-PLAN.md — Wave 1b: Store extensions, FilterState, selectors, performance gate (parallel)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-03-PLAN.md — Wave 2a: Filter bar UI — FacetChips, GroupToggle, ActiveChips, NoResultsState
- [x] 03-04-PLAN.md — Wave 2b: Detail panel UI — DetailPanel, AhpFieldStrip, PrettyJsonView, CopyMenu (parallel)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-05-PLAN.md — Wave 3: Search client + grouping + App assembly (AppShell wiring, TimelineList polymorphic)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03-06-PLAN.md — Wave 4: Phase 3 gate test + browser UAT + USER_GUIDE update

**Cross-cutting constraints:**
- No raw #hex literals in any component file
**UI hint**: yes

### Phase 4: Live Tail, Discovery, and Persistence
**Goal**: The viewer feels like a live tool — it finds VS Code logs on its own, follows them as they grow, and remembers per-log context.
**Depends on**: Phase 3
**Requirements**: INGEST-02, INGEST-03, INGEST-04, INGEST-05, SEARCH-05
**Success Criteria** (what must be TRUE):
  1. From the app, user can see auto-discovered likely VS Code / Copilot AHP log files and pick one to open.
  2. User can manually open any log file when auto-discovery misses it.
  3. The selected log is watched incrementally — new appended JSONL lines appear in the timeline without reparsing the whole file.
  4. User can pause and resume live following without losing their selection or scroll position.
  5. Search and filter state persists for the current log across reloads where appropriate.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Themes, Polish, and Verification
**Goal**: Ship a polished v1 — three distinctive themes wired through design tokens, a layout that scales from laptop to ultra-wide, and tests that protect the experience.
**Depends on**: Phase 4
**Requirements**: THEME-01, THEME-02, THEME-03, THEME-04, THEME-05, VERIFY-02, VERIFY-03
**Success Criteria** (what must be TRUE):
  1. User can switch between polished light, dark, and hacker themes from the UI; theme choice and key viewer preferences persist across reloads.
  2. Themes are implemented through design tokens with no hard-coded color values in components, leaving room for future VS Code theme integration.
  3. Hacker mode has an intentional, distinctive aesthetic beyond green-on-black.
  4. The UI remains usable and visually balanced from typical laptop widths up to ultra-wide displays.
  5. UI tests cover timeline rendering, row selection, detail view, filtering/search, theme switching, empty states, and parse-error states; E2E tests cover opening a fixture log, filtering/searching, expanding details, and following appended events.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Foundations | 3/3 | Complete    | 2026-05-07 |
| 2. Vertical Slice — CLI, Server, Timeline | 7/7 | Complete | 2026-05-07 |
| 3. Detail, Search, and Filtering | 7/7 | Complete   | 2026-05-07 |
| 4. Live Tail, Discovery, and Persistence | 0/0 | Not started | - |
| 5. Themes, Polish, and Verification | 0/0 | Not started | - |

---
*Roadmap created: 2026-05-06*
