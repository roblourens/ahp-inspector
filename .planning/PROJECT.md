# AHP Log Viewer

## What This Is

AHP Log Viewer is a local-first GUI for discovering, watching, searching, and understanding Agent Host Protocol traffic logs. It starts as a standalone local web app launched from the CLI, with architecture kept compatible with a future VS Code extension/webview. It helps developers quickly digest VS Code-to-agent-host communication by turning raw JSONL protocol traffic into a fast, information-dense, polished timeline with expandable details.

## Core Value

Make AHP traffic understandable at a glance while preserving fast access to exact raw event details.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Discover likely VS Code / Copilot AHP log files automatically and support manual file selection.
- [ ] Parse and watch real JSONL AHP log files emitted by VS Code, while using current human-readable logs as shape guidance during development.
- [ ] Display an information-dense traffic timeline where requests, responses, notifications, actions, errors, timing, direction, method/type, session, turn, and relevant IDs are easy to scan.
- [ ] Correlate request/response pairs and make failures, latency, and unmatched events visually obvious.
- [ ] Provide fast search and filtering across methods, action types, sessions, turns, status/error state, direction, time range, and payload text.
- [ ] Let users expand an individual event to inspect formatted details and raw JSON.
- [ ] Keep the UI responsive on large and actively growing logs through incremental parsing, virtualization, and efficient indexing.
- [ ] Provide polished light, dark, and hacker themes with a distinctive, attractive visual style.
- [ ] Preserve a clean boundary between log ingestion/parsing, analysis state, and UI so the standalone app can later be hosted inside a VS Code extension.

### Out of Scope

- Editing or replaying protocol traffic — v1 is an observer, not a protocol manipulator.
- Full VS Code extension packaging — the architecture should prepare for it, but the initial deliverable is the standalone local web app.
- Building or modifying the AHP protocol itself — this project consumes AHP schemas/types and logs.
- Remote multi-user hosting — the app is local developer tooling.

## Context

The Agent Host Protocol (AHP) is a JSON-RPC 2.0 protocol used by clients such as VS Code to communicate with agent hosts. The protocol defines client-to-server requests such as `initialize`, `listSessions`, `createSession`, `fetchTurns`, resource operations, authentication, and session configuration; client-to-server notifications such as `dispatchAction`; and server-to-client notifications/actions such as `action` and `notification`. Protocol details, TypeScript types, and JSON schemas live in `../agent-host-protocol`.

VS Code is logging AHP traffic to files. A current sample at `~/agenthost.2a22cea9-b08d-4287-83ca-fe6817470628.log` is human-readable and timestamped, with entries such as `>> dispatch`, `<< listSessions`, `!! listSessions`, and `** onDidAction`; future VS Code output can be changed to emit real JSONL. The viewer should use the current sample to understand useful fields and UX needs, but v1 should target a stable JSONL event format.

The primary user is a developer debugging or exploring VS Code-to-agent-host behavior. They need to identify what happened, what failed, what changed state, which events belong together, and what payload details matter without scrolling through raw logs.

## Constraints

- **Runtime**: Start as a standalone local web app launched from the CLI — fastest path to development and local file access.
- **Future compatibility**: Keep a host abstraction for file discovery, file watching, and file reading so the same UI can later run in a VS Code webview.
- **Protocol source**: Use `../agent-host-protocol` as the reference for AHP concepts, method names, action/notification types, and schemas.
- **Log format**: Design for real JSONL even though the current sample is formatted for humans.
- **Performance**: Large and growing logs must remain responsive; avoid rendering or reparsing the whole file on every update.
- **Security/privacy**: Logs can contain tokens, prompts, file paths, model output, and other sensitive content; the app should run locally and avoid sending log content to external services.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build standalone local web app first | Faster iteration and easier development; extension packaging can follow once the core viewer is useful | — Pending |
| Keep VS Code extension as a later host | The user wants eventual in-editor use, but not at the cost of delaying the core viewer | — Pending |
| Target real JSONL logs | The current sample is useful but human-readable; VS Code can be changed to emit proper JSONL for reliable parsing | — Pending |
| Support auto-discovery plus manual open | Auto-discovery reduces friction, manual open handles unknown log locations and samples | — Pending |
| Include light, dark, and hacker themes in v1 | Visual polish and theme variety are part of the product vision, not optional decoration | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-06 after initialization*
