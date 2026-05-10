# AHP Inspector

## What This Is

AHP Inspector is a shipped local-first GUI for discovering, watching, searching, and understanding Agent Host Protocol JSONL traffic logs. It runs both as a standalone CLI-launched local web app (`npx ahp-inspector`) and inside VS Code as a webview-backed extension command (`AHP Inspector: Open`). It turns raw VS Code-to-agent-host JSON-RPC traffic into a fast, information-dense, polished timeline with expandable details and reconstructed reducer-backed state at any point in the log.

## Core Value

Make AHP traffic understandable at a glance while preserving fast access to exact raw event details and reconstructed state.

## Current State

**v1.1 Reducer-backed State Snapshots shipped:** 2026-05-10

The v1.1 milestone delivered:

- **Protocol sync foundation:** Generated `@ahp-inspector/protocol` workspace package syncing canonical reducers/actions/state from sibling `../agent-host-protocol`, with recorded source commit and fixture parity tests.
- **Deterministic replay engine:** Pure `replayToIndex()` reconstructing root/session/terminal state from snapshots and server action envelopes, with diagnostics for missing baselines, unknown actions, sequence gaps, and ignored client intent.
- **Lazy state-at-index API + UI inspector:** `/api/state-at` endpoint backed by `StateReplayIndex` LRU cache; detail-panel "State at this point" action, resource selector, Summary/Pretty/Raw views, confidence badge, diagnostics panel, copy actions — themed across dark/light/hacker.
- **Pinned comparison:** Memory-only two-pin state model with top-level changed-path comparison and confidence-aware incomplete-comparison warning.
- **VS Code extension webview:** Command-palette entry, active-`.jsonl` preselect, typed `postMessage` transport replacing loopback HTTP/SSE inside VS Code, CSP-safe webview HTML, boundary and security gates.
- **Search rather than filter:** Free-text search now highlights and navigates matches with Enter/Shift+Enter while faceted filters remain the row-narrowing mechanism.
- **`npx ahp-inspector` publishing:** Bounded VS Code log-roots walker auto-opens the most-recently-modified JSONL; CLI package publishable to npm with bundled UI assets, `release.sh --dry-run`, and `workflow_dispatch` publish workflow with `--provenance`.
- **Hardening pass:** State diagnostics scroll/wrap, row-highlight precedence cleanup, smarter notification summaries, scroll-to-current-match search ergonomics.

Final gates: 91 vitest files / 1095 tests, `pnpm -r typecheck`, biome lint, E2E specs `phase10`/`phase12`/`phase14`, UI/CLI/extension builds — all green. Milestone audit re-run passed; 38/38 v1.1 requirements satisfied; all 9 phases Nyquist compliant. See `.planning/milestones/v1.1-MILESTONE-AUDIT.md`.

## Next Milestone

v1.2 is undefined. Run `/gsd-new-milestone` to scope and plan. Open candidates (from v1.1 deferred and `Future Candidates`): continuous scrub-through state, deep semantic diff for nested paths, multi-log state comparison, snapshot/diff export, saved searches and bookmarks, advanced filter DSL.

## Requirements

### Validated

- ✓ FOUND-01..04, INGEST-01..07, EVENT-01..06, TIME-01..06, DETAIL-01..04, SEARCH-01..05, THEME-01..05, VERIFY-01..04 — v1.0 (full list in `.planning/milestones/v1.0-REQUIREMENTS.md`)
- ✓ SYNC-01..04 — Protocol sync foundation — v1.1
- ✓ REPLAY-01..06 — Deterministic replay engine — v1.1
- ✓ CONF-01..03 — State confidence and diagnostics — v1.1
- ✓ STATE-01..05 — State inspector UI — v1.1
- ✓ COMPARE-01..03 — Pinned comparison with local-only privacy — v1.1
- ✓ VERIFY-01..04 (v1.1 scope) — Parity fixtures, integration tests, browser E2E, large-log responsiveness — v1.1
- ✓ EXT-01..07 — VS Code extension command palette + webview, transport abstraction, CSP-safe assets, no-loopback in extension mode — v1.1
- ✓ NPX-01..06 — `npx ahp-inspector` publishing, auto-discovery, dry-run release script, docs — v1.1

### Active

(None — next milestone scope to be defined by `/gsd-new-milestone`.)

### Future Candidates

- Continuous scrub-through timeline with live state updates (FUTURE-01).
- Deep semantic diff for arbitrary nested state paths (FUTURE-02).
- Reconstructed state comparison across multiple log files (FUTURE-03).
- Export selected state snapshots or diffs (FUTURE-04).
- Saved searches, filter presets, bookmarks/annotations, advanced filter DSL, aggregate dashboards, session/range diffing, and full AHP schema validation.

### Out of Scope (carried forward)

- Editing or replaying protocol traffic — viewer remains an observer/debugger, not a mutator.
- Treating partial reconstructed state as authoritative truth — confidence must remain explicit.
- Remote hosted log viewing — logs can contain sensitive tokens, prompts, paths, and outputs.
- Telemetry, analytics, CDN fonts, or external AI explanation — violates local-only privacy posture.
- Full semantic diff for every protocol field — useful but larger than v1.1's top-level comparison.

## Context

The Agent Host Protocol (AHP) is a JSON-RPC 2.0 protocol used by clients such as VS Code to communicate with agent hosts. The protocol defines requests, notifications, actions, session/resource flows, authentication, and state updates. Protocol details, TypeScript types, and JSON schemas live in `../agent-host-protocol`.

VS Code can emit AHP traffic as JSONL logs. AHP Inspector treats the real JSONL shape as canonical while keeping a legacy adapter for old human-readable sample logs. The primary user is a developer debugging or exploring VS Code-to-agent-host behavior who needs to identify what happened, what failed, what changed state, and which events belong together without reading raw JSONL line by line.

## Constraints

- **Runtime:** Standalone local web app launched from the CLI.
- **Future compatibility:** Host abstraction for discovery, watching, and reading so the same UI can later run in a VS Code webview.
- **Protocol source:** Use `../agent-host-protocol` for AHP concepts, method/action/notification names, and schemas.
- **Reducer source:** Use copied/generated protocol reducer files with source commit tracking rather than hand-rolled reducer logic.
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
| Reconstruct state by replaying AHP reducers server-side | AHP state is defined by snapshots plus pure reducers, and logs contain the ordered traffic needed to replay them | ✓ Good |
| Treat client dispatch requests as intent until server echo | Prevents rejected or unobserved client actions from corrupting reconstructed host state | ✓ Good |
| Generate `@ahp-inspector/protocol` from sibling repo with a sync script | Single source of truth for actions/reducers/state; sync commit recorded in diagnostics | ✓ Good |
| Cap pinned state points at exactly two in v1.1 | Forced focus on a useful, shippable diff surface; full multi-pin and deep semantic diff stay in FUTURE-02/03 | ✓ Good |
| Lazy `/api/state-at` with bounded LRU cache | Keeps SSE row payloads compact; large-log state lookup remains responsive | ✓ Good |
| Typed `postMessage` transport for VS Code extension instead of loopback server | Avoids any port-binding in extension mode and lets the same UI run unchanged | ✓ Good |
| Search highlights+navigates rather than filters | Preserves user mental model; faceted filters remain the row-narrowing mechanism | ✓ Good |
| Publish `ahp-inspector` unscoped on npm with bundled UI assets | Single `npx` command, no install step; release behind `workflow_dispatch` + `--provenance` | ✓ Good |
| Backfill missing VERIFICATION/VALIDATION at milestone-audit time | Preserves documentation integrity even when in-flight scope insertions skipped the rolled-up artifacts | ✓ Good |

## Archives

- v1.0 roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- v1.0 requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- v1.0 audit: `.planning/milestones/v1.0-MILESTONE-AUDIT.md`
- v1.1 roadmap: `.planning/milestones/v1.1-ROADMAP.md`
- v1.1 requirements: `.planning/milestones/v1.1-REQUIREMENTS.md`
- v1.1 audit: `.planning/milestones/v1.1-MILESTONE-AUDIT.md`
- milestone index: `.planning/MILESTONES.md`

---
*Last updated: 2026-05-10 after v1.1 milestone close*
