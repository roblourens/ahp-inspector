# Roadmap: AHP Inspector

**Created:** 2026-05-06
**Current milestone:** v1.2 (in progress)
**Archives:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.1-ROADMAP.md`

## Vision

Make AHP traffic understandable at a glance while preserving fast access to exact raw event details.

## Milestones

- ✅ **v1.0 Initial MVP** — shipped 2026-05-08. Standalone local viewer, JSONL ingestion, virtualized timeline, detail/search/filtering, live discovery/tail/persistence, three themes, full verification.
- ✅ **v1.1 Reducer-backed State Snapshots** — shipped 2026-05-10. Protocol sync, deterministic replay engine, lazy state-at-index API, state inspector UI, pinned comparison, VS Code extension webview, search-rather-than-filter UX, `npx ahp-inspector` publishing, and hardening pass.
- 🚧 **v1.2 (in progress)** — opened 2026-05-10, last updated 2026-05-13. Phases 15–17 landed (extension stabilization, wire-time timestamps, drag-and-drop). Phases 18–21 queued for small UX polish and discovery fixes.

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

### 🚧 v1.2 (in progress)

- [ ] Phase 15: VS Code extension stabilization — 4/5 plans (UAT pending)
  **Goal:** Pivot the webview from a postMessage bridge to a singleton in-extension `LogServer` (Hono on 127.0.0.1) reached via `WebviewOptions.portMapping`. Reverses Phase 11's EXT-03 / postMessage decisions. The webview now uses the same HTTP+SSE transport as the standalone CLI build, fixing the bug class where UI components that bypass the bridge silently fail in the webview. Replaces the original "thread `AhpViewerClient`" plan set (archived under `_superseded/`).
  **Requirements:** STAB-15-A, STAB-15-CSP, STAB-15-CORS, STAB-15-B, STAB-15-API-BASE, STAB-15-EXT, STAB-15-LIFECYCLE, STAB-15-CLEANUP, STAB-15-UAT
  **Plans:**
    - [x] 15-01-PLAN.md — Server CORS middleware + extend `renderWebviewHtml` with `loopbackOrigin` + `apiBaseUrl` options
    - [x] 15-02-PLAN.md — UI `apiUrl(path)` helper + route all transport callsites through it
    - [x] 15-03-PLAN.md — Singleton `extensionServer.ts` lifecycle + rewrite `extension.ts` to use `portMapping`, drop bridge wiring, seed initial log via `sessions.open`
    - [x] 15-04-PLAN.md — Delete dead bridge code (`viewerSession.ts`, `messageProtocol.ts`, `webview-client.ts`) and simplify `main.tsx`
    - [ ] 15-05-PLAN.md — Manual UAT (checkpoint): local + remote-dev panel, row click, search, state, log switch, reconnect, no orphan processes

Further v1.2 phases will be added as scope emerges. Lean milestone open — defer broader scoping until needed.

## Progress

| Milestone | Phases | Plans | Status | Completed |
|-----------|--------|-------|--------|-----------|
| v1.0 Initial MVP | 6/6 | 37/37 | Shipped | 2026-05-08 |
| v1.1 Reducer-backed State Snapshots | 9/9 | 29/29 | Shipped | 2026-05-10 |
| v1.2 (in progress) | 4/7 | 9/10 | Phases 16–18 landed; Phase 15 manual UAT pending; Phases 19–21 queued | — |

## Next

Phase 15 plans 01–04 are landed and committed (1104 tests pass; both bundles build). Plan 15-05 is a manual UAT in real VS Code (local + remote-dev) — run those scenarios, capture screenshots under `screenshots/phase15/`, and write `.planning/phases/15-vs-code-extension-stabilization/15-05-UAT.md`.

### Phase 16: Fix timestamp column to show real event time from JSONL, not render time

**Goal:** Timeline timestamp column displays the wire time recorded in each JSONL event's `_ahpLog.ts` sidecar instead of the server-side ingest time, with graceful fallback when the sidecar is absent.
**Requirements**: TBD
**Depends on:** Phase 15
**Plans:** 1 plan

Plans:
- [x] 16-01-PLAN.md — Add `extractWireMeta` parser helper and wire it into the server ingest loop (with tests)

### Phase 17: Add drag-and-drop support for opening JSONL files

**Goal:** Standalone web UI accepts a JSONL file dropped anywhere in the window and opens it as the active log, using `text/uri-list` to recover a real filesystem path so the existing tail-by-path pipeline is reused unchanged.
**Requirements**: TBD
**Depends on:** Phase 16
**Plans:** 3/3 plans complete

Plans:
- **Wave 1**
- [x] 17-01-PLAN.md — Pure `parseDroppedUri` helper (text/uri-list → path | typed error) with unit tests (D-02, D-04)
- [x] 17-02-PLAN.md — Presentational `DropOverlay` + `MultiFileToast` components per UI-SPEC (locked copy, tokens only)
- **Wave 2** *(blocked on Wave 1 completion)*
- [x] 17-03-PLAN.md — `useDropZone` hook, AppShell mount, shared ERROR_COPY extraction, Playwright E2E (D-01, D-03, D-05)

Cross-cutting constraints:
- All visible strings come from the locked UI-SPEC copy table — no ad-hoc copy in components or hook.
- All visual values use existing `var(--*)` tokens; `no-hex-in-components.test.ts` must continue to pass.
- Error responses never echo the dropped path or `file://` URI — only the basename appears in the toast (Phase 11 trust posture).

### Phase 18: Refresh v1.2 milestone timestamp in ROADMAP.md ✅

**Goal:** Fix mojibake on v1.2 milestone bullets and refresh the stale "opened lean / one stabilization phase" footer to reflect actual progress through Phase 21.
**Requirements**: N/A (doc-only)
**Depends on:** Phase 17
**Plans:** 0 plans (trivial inline fix, no plan needed)

Done inline 2026-05-13: replaced `�` glyphs with 🚧, refreshed milestone bullet + footer date.

### Phase 19: Remove colored dots from theme picker

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 18
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 19 to break down)

### Phase 20: Discover logs in both .vscode-oss-dev and .vscode-oss-agents-dev roots

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 19
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 20 to break down)

### Phase 21: Show response below request in detail side pane

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 20
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 21 to break down)

---
*Roadmap reorganized after v1.1 milestone archive: 2026-05-10*
*v1.2 opened 2026-05-10; last updated 2026-05-13 (phases 18–21 added)*
