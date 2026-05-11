# Roadmap: AHP Inspector

**Created:** 2026-05-06
**Current milestone:** v1.2 (in progress)
**Archives:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.1-ROADMAP.md`

## Vision

Make AHP traffic understandable at a glance while preserving fast access to exact raw event details.

## Milestones

- ✅ **v1.0 Initial MVP** — shipped 2026-05-08. Standalone local viewer, JSONL ingestion, virtualized timeline, detail/search/filtering, live discovery/tail/persistence, three themes, full verification.
- ✅ **v1.1 Reducer-backed State Snapshots** — shipped 2026-05-10. Protocol sync, deterministic replay engine, lazy state-at-index API, state inspector UI, pinned comparison, VS Code extension webview, search-rather-than-filter UX, `npx ahp-inspector` publishing, and hardening pass.
- � **v1.2 (in progress)** — opened lean. Seeded with one stabilization phase; further phases will be added as scope emerges.

## Phases

<details>
<summary>✅ v1.0 Initial MVP (Phases 1–5 + Phase 04.1) — SHIPPED 2026-05-08</summary>

- [x] Phase 1: Core Foundations — 3/3 plans
- [x] Phase 2: Vertical Slice — CLI, Server, Timeline — 7/7 plans
- [x] Phase 3: Detail, Search, and Filtering — 7/7 plans
- [x] Phase 4: Live Tail, Discovery, and Persistence — 8/8 plans
- [x] Phase 04.1: Timeline row information polish and real-log validation — 6/6 plans
- [x] Phase 5: Themes, Polish, and Verification — 6/6 plans

Full phase details: `.planning/milestones/v1.0-ROADMAP.md`.

</details>

<details>
<summary>✅ v1.1 Reducer-backed State Snapshots (Phases 6–14) — SHIPPED 2026-05-10</summary>

- [x] Phase 6: Protocol reducer sync foundation — 3/3 plans
- [x] Phase 7: Deterministic replay engine — 3/3 plans
- [x] Phase 8: Server state-at-index API and cache integration — 3/3 plans
- [x] Phase 9: State inspector UI — 3/3 plans
- [x] Phase 10: Pinned comparison and milestone verification — 3/3 plans
- [x] Phase 11: VS Code extension command palette webview — 4/4 plans
- [x] Phase 12: Search rather than filter — 3/3 plans
- [x] Phase 13: npx publishing and auto-open latest log — 3/3 plans
- [x] Phase 14: Hardening pass — 4/4 plans

Full phase details: `.planning/milestones/v1.1-ROADMAP.md`.

</details>

### � v1.2 (in progress)

- [ ] Phase 15: VS Code extension stabilization — 0/5 plans
  **Goal:** Pivot the webview from a postMessage bridge to a singleton in-extension `LogServer` (Hono on 127.0.0.1) reached via `WebviewOptions.portMapping`. Reverses Phase 11's EXT-03 / postMessage decisions. The webview now uses the same HTTP+SSE transport as the standalone CLI build, fixing the bug class where UI components that bypass the bridge silently fail in the webview. Replaces the original "thread `AhpViewerClient`" plan set (archived under `_superseded/`).
  **Requirements:** STAB-15-A, STAB-15-CSP, STAB-15-CORS, STAB-15-B, STAB-15-API-BASE, STAB-15-EXT, STAB-15-LIFECYCLE, STAB-15-CLEANUP, STAB-15-UAT
  **Plans:**
    - [ ] 15-01-PLAN.md — Server CORS middleware + extend `renderWebviewHtml` with `loopbackOrigin` + `apiBaseUrl` options
    - [ ] 15-02-PLAN.md — UI `apiUrl(path)` helper + route all transport callsites through it
    - [ ] 15-03-PLAN.md — Singleton `extensionServer.ts` lifecycle + rewrite `extension.ts` to use `portMapping`, drop bridge wiring, seed initial log via `sessions.open`
    - [ ] 15-04-PLAN.md — Delete dead bridge code (`viewerSession.ts`, `messageProtocol.ts`, `webview-client.ts`) and simplify `main.tsx`
    - [ ] 15-05-PLAN.md — Manual UAT (checkpoint): local + remote-dev panel, row click, search, state, log switch, reconnect, no orphan processes

Further v1.2 phases will be added as scope emerges. Lean milestone open — defer broader scoping until needed.

## Progress

| Milestone | Phases | Plans | Status | Completed |
|-----------|--------|-------|--------|-----------|
| v1.0 Initial MVP | 6/6 | 37/37 | Shipped | 2026-05-08 |
| v1.1 Reducer-backed State Snapshots | 9/9 | 29/29 | Shipped | 2026-05-10 |
| v1.2 (in progress) | 0/1 | 0/5 | Phase 15 planned (server-in-extension pivot) | — |

## Next

Run `/gsd-execute-phase 15` to execute the 5 plans (server-in-extension pivot).

---
*Roadmap reorganized after v1.1 milestone archive: 2026-05-10*
*v1.2 opened lean with Phase 15 seed: 2026-05-10*
