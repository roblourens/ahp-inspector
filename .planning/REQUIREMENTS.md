# Requirements: AHP Log Viewer

**Defined:** 2026-05-06
**Core Value:** Make AHP traffic understandable at a glance while preserving fast access to exact raw event details.

## v1 Requirements

Requirements for the first useful standalone release. Each maps to roadmap phases.

### Project Foundation

- [ ] **FOUND-01**: Developer can install dependencies and run a standalone local AHP Log Viewer from the CLI.
- [ ] **FOUND-02**: The codebase separates portable core logic, Node/local host capabilities, server transport, CLI entrypoint, and browser UI so the UI can later run in a VS Code webview.
- [ ] **FOUND-03**: The app uses `../agent-host-protocol` as the source of truth for AHP method, action, notification, and schema concepts instead of inventing protocol definitions.
- [ ] **FOUND-04**: The app enforces a local-only security posture with no telemetry, no CDN assets, and no outbound network dependencies for viewing logs.

### Log Ingestion

- [ ] **INGEST-01**: User can open an AHP JSONL log by passing a file path to the CLI.
- [ ] **INGEST-02**: User can discover likely VS Code / Copilot AHP log files from the app and select one to view.
- [ ] **INGEST-03**: User can manually open a log file when auto-discovery misses it.
- [ ] **INGEST-04**: User can watch a selected log as new JSONL entries are appended without reparsing the entire file.
- [ ] **INGEST-05**: User can pause and resume live following without losing their place in the log.
- [ ] **INGEST-06**: User can see clear parse-error rows for malformed JSONL lines while valid neighboring entries still load.
- [ ] **INGEST-07**: Developer can use the current human-readable sample log as a fixture through a legacy parser adapter without coupling the main event model to that format.

### Event Model and Correlation

- [ ] **EVENT-01**: Each JSONL entry is normalized into a canonical event model with timestamp, direction, kind, method or action type, IDs, optional session/turn/tool identifiers, sequence data, raw payload, and parse status.
- [ ] **EVENT-02**: Requests, responses, notifications, state actions, protocol notifications, errors, and parse errors are classified consistently.
- [ ] **EVENT-03**: Request and response pairs are correlated using a bidirectional JSON-RPC-safe key that preserves session, direction, id value, and id type.
- [ ] **EVENT-04**: Correlated request rows show response status and latency when the matching response arrives.
- [ ] **EVENT-05**: Unmatched, orphaned, failed, and malformed events are visually distinguishable.
- [ ] **EVENT-06**: Server sequence gaps and authentication failures can be detected and surfaced when present in the event stream.

### Timeline UI

- [ ] **TIME-01**: User sees a virtualized, information-dense timeline that remains responsive on large logs.
- [ ] **TIME-02**: Each timeline row displays the most important scan fields: timestamp, direction, kind, method/action type, status, latency, session, turn, relevant IDs, and a short payload preview.
- [ ] **TIME-03**: Timeline rows use clear visual encoding for direction, event kind, success/error state, action taxonomy, and latency severity.
- [ ] **TIME-04**: User can select rows with mouse or keyboard and keep context while navigating through results.
- [ ] **TIME-05**: User can toggle session/turn grouping to understand AHP traffic as a story instead of only a flat stream.
- [ ] **TIME-06**: User sees useful empty, loading, no-results, parse-error, and disconnected states.

### Event Detail

- [ ] **DETAIL-01**: User can expand or select an event to inspect details without breaking timeline virtualization.
- [ ] **DETAIL-02**: Detail view shows normalized summary fields, correlation metadata, and the full raw JSON payload.
- [ ] **DETAIL-03**: Detail view supports folded pretty JSON, raw JSON text, syntax highlighting, truncation for huge payloads, and copy actions.
- [ ] **DETAIL-04**: Detail view highlights AHP-specific fields such as session, turn, tool call, action type, serverSeq, origin, request id, error code, and notification type when present.

### Search and Filtering

- [ ] **SEARCH-01**: User can run fast free-text search across method, action type, IDs, session, turn, error text, and payload text.
- [ ] **SEARCH-02**: User can filter by direction, event kind, method, action type, session, turn, status/error state, and time range.
- [ ] **SEARCH-03**: Search and filters update the visible timeline without blocking typing or live tailing.
- [ ] **SEARCH-04**: User can clear filters quickly and see active filters at a glance.
- [ ] **SEARCH-05**: Search and filter state persists for the current log where appropriate.

### Themes and Polish

- [ ] **THEME-01**: User can switch between polished light, dark, and hacker themes.
- [ ] **THEME-02**: Themes are implemented through design tokens so future VS Code theme integration does not require a UI rewrite.
- [ ] **THEME-03**: Hacker mode has a distinct intentional aesthetic, not just green text on a dark background.
- [ ] **THEME-04**: Theme choice and key viewer preferences persist across app reloads.
- [ ] **THEME-05**: The UI is responsive from laptop width to ultra-wide displays.

### Verification

- [ ] **VERIFY-01**: Parser and normalizer tests cover valid JSONL, malformed lines, partial trailing lines, CRLF/BOM handling, large payloads, request/response correlation, and the legacy sample adapter.
- [ ] **VERIFY-02**: UI tests cover timeline rendering, row selection, detail view, filtering/search, theme switching, empty states, and parse-error states.
- [ ] **VERIFY-03**: End-to-end tests exercise opening a fixture log, filtering/searching, expanding event details, and following appended events.
- [ ] **VERIFY-04**: Fixture logs are scrubbed so committed test data does not contain tokens or private prompt/output content.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### VS Code Extension

- **EXT-01**: User can open AHP Log Viewer as a VS Code extension/webview.
- **EXT-02**: VS Code extension host uses the same UI and core model as the standalone app, swapping only the host adapter.
- **EXT-03**: Webview state persists through VS Code reloads using VS Code webview state APIs.

### Advanced Analysis

- **ADV-01**: User can open and compare multiple log files at once.
- **ADV-02**: User can save named searches and filter presets.
- **ADV-03**: User can bookmark, annotate, or share references to important events.
- **ADV-04**: User can export filtered subsets as JSONL or reports.
- **ADV-05**: User can view aggregate dashboards for methods, latency, errors, sessions, and action volume.
- **ADV-06**: User can use a Wireshark-style advanced filter language.
- **ADV-07**: User can diff two sessions or two log ranges.
- **ADV-08**: User can validate payloads against the full AHP JSON schemas and see schema errors.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Editing or replaying protocol traffic | v1 is an observer/debugger; mutation changes the safety model and product scope |
| Remote hosted log viewing | Logs can contain sensitive tokens, prompts, paths, and model output; local-first is core to trust |
| Telemetry, analytics, CDN fonts, or external AI explanations | Violates the local-only privacy posture for sensitive logs |
| Full VS Code extension packaging in v1 | Standalone app is the fastest path; extension compatibility is handled through architecture |
| Custom filter DSL in v1 | Basic search and faceted filters are enough for v1 and avoid premature complexity |
| Multi-file workspace in v1 | Single-log excellence is required before comparison workflows |
| Tight coupling to the current human-readable log sample | VS Code can emit real JSONL; the sample adapter is only a development bridge |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | TBD | Pending |
| FOUND-02 | TBD | Pending |
| FOUND-03 | TBD | Pending |
| FOUND-04 | TBD | Pending |
| INGEST-01 | TBD | Pending |
| INGEST-02 | TBD | Pending |
| INGEST-03 | TBD | Pending |
| INGEST-04 | TBD | Pending |
| INGEST-05 | TBD | Pending |
| INGEST-06 | TBD | Pending |
| INGEST-07 | TBD | Pending |
| EVENT-01 | TBD | Pending |
| EVENT-02 | TBD | Pending |
| EVENT-03 | TBD | Pending |
| EVENT-04 | TBD | Pending |
| EVENT-05 | TBD | Pending |
| EVENT-06 | TBD | Pending |
| TIME-01 | TBD | Pending |
| TIME-02 | TBD | Pending |
| TIME-03 | TBD | Pending |
| TIME-04 | TBD | Pending |
| TIME-05 | TBD | Pending |
| TIME-06 | TBD | Pending |
| DETAIL-01 | TBD | Pending |
| DETAIL-02 | TBD | Pending |
| DETAIL-03 | TBD | Pending |
| DETAIL-04 | TBD | Pending |
| SEARCH-01 | TBD | Pending |
| SEARCH-02 | TBD | Pending |
| SEARCH-03 | TBD | Pending |
| SEARCH-04 | TBD | Pending |
| SEARCH-05 | TBD | Pending |
| THEME-01 | TBD | Pending |
| THEME-02 | TBD | Pending |
| THEME-03 | TBD | Pending |
| THEME-04 | TBD | Pending |
| THEME-05 | TBD | Pending |
| VERIFY-01 | TBD | Pending |
| VERIFY-02 | TBD | Pending |
| VERIFY-03 | TBD | Pending |
| VERIFY-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 0
- Unmapped: 42 ⚠

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 after initial definition*
