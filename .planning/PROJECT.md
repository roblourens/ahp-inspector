# AHP Log Viewer

## What This Is

AHP Log Viewer is a shipped local-first GUI for discovering, watching, searching, and understanding Agent Host Protocol JSONL traffic logs. It runs as a standalone CLI-launched local web app and keeps the architecture compatible with a future VS Code extension/webview host. It turns raw VS Code-to-agent-host JSON-RPC traffic into a fast, information-dense, polished timeline with expandable details.

## Core Value

Make AHP traffic understandable at a glance while preserving fast access to exact raw event details.

## Current State

**v1.0 Initial MVP shipped:** 2026-05-08

The v1.0 milestone delivered:

- Local CLI/server/UI workflow for opening AHP JSONL logs.
- Canonical event normalization sourced from `../agent-host-protocol`, legacy sample support, scrubbed fixtures, and robust parser/correlation tests.
- Virtualized timeline with row summaries, ID-first scan layout, pair highlighting, error annotations, grouping, keyboard navigation, and large-log responsiveness.
- Detail view with AHP field highlights, correlation metadata, expanded Pretty JSON, raw JSON, truncation, and copy actions.
- Search and filtering across payloads, methods/actions, IDs, session/turn, status/error, and time ranges.
- Auto-discovery, manual open, live tail, pause/resume, log switch, rotation/watch-error handling, and per-log preference persistence.
- Polished dark, light, and hacker themes through design tokens, responsive detail layouts, browser UAT screenshots, and Playwright E2E coverage.

Final gate passed: `pnpm test`, UI build, CLI build, typecheck, lint, E2E, state validation, roadmap analysis, and milestone integration re-audit.

## Requirements

### Validated

- ✓ FOUND-01 through FOUND-04 — install/run, package boundaries, AHP source-of-truth usage, local-only security posture — v1.0
- ✓ INGEST-01 through INGEST-07 — CLI open, discovery, manual open, live tail, pause/resume, parse errors, legacy adapter — v1.0
- ✓ EVENT-01 through EVENT-06 — canonical model, classification, correlation, latency/status updates, visual distinguishability, gap/auth surfacing — v1.0
- ✓ TIME-01 through TIME-06 — virtualized timeline, scan fields, visual encoding, selection, grouping, states — v1.0
- ✓ DETAIL-01 through DETAIL-04 — detail inspector, normalized metadata, Pretty/Raw JSON, truncation, copy, AHP field highlights — v1.0
- ✓ SEARCH-01 through SEARCH-05 — free-text search, facets, non-blocking updates, clear filters, per-log persistence — v1.0
- ✓ THEME-01 through THEME-05 — dark/light/hacker themes, token architecture, persistence, responsive layout — v1.0
- ✓ VERIFY-01 through VERIFY-04 — parser/unit coverage, UI coverage, E2E coverage, scrubbed fixtures — v1.0

### Active

Fresh requirements for the next milestone should be created with `/gsd-new-milestone`.

### Future Candidates

- VS Code extension/webview host using the same UI and core model.
- Multi-log comparison, saved searches/filter presets, bookmarks/annotations, filtered exports, aggregate dashboards, advanced filter DSL, session/range diffing, and full AHP schema validation.

### Out of Scope for v1.0

- Editing or replaying protocol traffic — v1 is an observer/debugger, not a protocol mutator.
- Remote hosted log viewing — logs can contain sensitive tokens, prompts, paths, and model output.
- Telemetry, analytics, CDN fonts, or external AI explanations — violates local-only privacy posture.
- Full VS Code extension packaging — standalone app shipped first; extension compatibility remains architectural.
- Custom filter DSL and multi-file workspace — single-log excellence came first.

## Context

The Agent Host Protocol (AHP) is a JSON-RPC 2.0 protocol used by clients such as VS Code to communicate with agent hosts. The protocol defines requests, notifications, actions, session/resource flows, authentication, and state updates. Protocol details, TypeScript types, and JSON schemas live in `../agent-host-protocol`.

VS Code can emit AHP traffic as JSONL logs. AHP Log Viewer treats the real JSONL shape as canonical while keeping a legacy adapter for old human-readable sample logs. The primary user is a developer debugging or exploring VS Code-to-agent-host behavior who needs to identify what happened, what failed, what changed state, and which events belong together without reading raw JSONL line by line.

## Constraints

- **Runtime:** Standalone local web app launched from the CLI.
- **Future compatibility:** Host abstraction for discovery, watching, and reading so the same UI can later run in a VS Code webview.
- **Protocol source:** Use `../agent-host-protocol` for AHP concepts, method/action/notification names, and schemas.
- **Log format:** Target real JSONL.
- **Performance:** Large and growing logs must remain responsive through incremental parsing, indexing, and virtualization.
- **Security/privacy:** Logs stay local; no telemetry, CDN assets, or outbound viewing dependencies.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build standalone local web app first | Fastest route to useful local file tooling | ✓ Good |
| Keep VS Code extension as future host | Preserves direction without delaying v1 | ✓ Good |
| Target real JSONL logs | Reliable parsing and testing beat human-readable log scraping | ✓ Good |
| Use `../agent-host-protocol` types | Prevents protocol drift and hand-rolled schemas | ✓ Good |
| Keep local-only privacy posture | AHP logs may contain secrets, prompts, paths, and outputs | ✓ Good |
| Use design tokens for themes | Dark/light/hacker polish and future VS Code theme integration share one system | ✓ Good |
| Use lazy server endpoints for raw detail/search | Keeps SSE rows compact and large-log rendering fast | ✓ Good |
| Insert Phase 04.1 before theme work | Real-shaped row information needed to be correct before visual polish | ✓ Good |
| Run milestone integration audit before archive | Caught and fixed paused-buffer, detail-cache, rotation, and pair-metadata gaps | ✓ Good |

## Archives

- v1.0 roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- v1.0 requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- v1.0 audit: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`
- milestone index: `.planning/MILESTONES.md`

---
*Last updated: 2026-05-08 after v1.0 milestone*
