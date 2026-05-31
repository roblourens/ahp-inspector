# Roadmap: AHP Inspector

**Created:** 2026-05-06
**Current milestone:** v1.2 (completed 2026-05-16; ready for archival when desired)
**Archives:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.1-ROADMAP.md`

## Vision

Make AHP traffic understandable at a glance while preserving fast access to exact raw event details.

## Milestones

- ✅ **v1.0 Initial MVP** — shipped 2026-05-08. Standalone local viewer, JSONL ingestion, virtualized timeline, detail/search/filtering, live discovery/tail/persistence, three themes, full verification.
- ✅ **v1.1 Reducer-backed State Snapshots** — shipped 2026-05-10. Protocol sync, deterministic replay engine, lazy state-at-index API, state inspector UI, pinned comparison, VS Code extension webview, search-rather-than-filter UX, `npx ahp-inspector` publishing, and hardening pass.
- ✅ **v1.2** — completed 2026-05-16. Extension stabilization, wire-time timestamps, drag-and-drop, UX/discovery polish, stacked response detail, and Phase 22 large-log/live-tail performance work are landed. Phase 15's old manual UAT checkpoint was explicitly dispositioned during closeout without retroactively claiming new evidence.

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

### ✅ v1.2 (completed 2026-05-16)

- [x] Phase 15: VS Code extension stabilization — implementation landed; stale manual UAT checkpoint explicitly dispositioned during v1.2 closeout
  **Goal:** Pivot the webview from a postMessage bridge to a singleton in-extension `LogServer` (Hono on 127.0.0.1) reached via `WebviewOptions.portMapping`. Reverses Phase 11's EXT-03 / postMessage decisions. The webview now uses the same HTTP+SSE transport as the standalone CLI build, fixing the bug class where UI components that bypass the bridge silently fail in the webview. Replaces the original "thread `AhpViewerClient`" plan set (archived under `_superseded/`).
  **Requirements:** STAB-15-A, STAB-15-CSP, STAB-15-CORS, STAB-15-B, STAB-15-API-BASE, STAB-15-EXT, STAB-15-LIFECYCLE, STAB-15-CLEANUP, STAB-15-UAT
  **Plans:**
    - [x] 15-01-PLAN.md — Server CORS middleware + extend `renderWebviewHtml` with `loopbackOrigin` + `apiBaseUrl` options
    - [x] 15-02-PLAN.md — UI `apiUrl(path)` helper + route all transport callsites through it
    - [x] 15-03-PLAN.md — Singleton `extensionServer.ts` lifecycle + rewrite `extension.ts` to use `portMapping`, drop bridge wiring, seed initial log via `sessions.open`
    - [x] 15-04-PLAN.md — Delete dead bridge code (`viewerSession.ts`, `messageProtocol.ts`, `webview-client.ts`) and simplify `main.tsx`
    - [x] 15-05-PLAN.md — Manual UAT checkpoint closed without retroactive execution on 2026-05-16; no new UAT evidence is claimed

Further v1.2 phases will be added as scope emerges. Lean milestone open — defer broader scoping until needed.

## Progress

| Milestone | Phases | Plans | Status | Completed |
|-----------|--------|-------|--------|-----------|
| v1.0 Initial MVP | 6/6 | 37/37 | Shipped | 2026-05-08 |
| v1.1 Reducer-backed State Snapshots | 9/9 | 29/29 | Shipped | 2026-05-10 |
| v1.2 | 7/7 | 10/10 + explicit Phase 15 checkpoint disposition | Completed; Phase 22 closed and stale Phase 15 UAT bookkeeping reconciled | 2026-05-16 |

## Next

v1.2 is closed for bookkeeping purposes. Phase 15 plans 01–04 remain the implementation record; the old 15-05 manual UAT checkpoint was explicitly dispositioned on 2026-05-16 without inventing retroactive screenshots or a UAT pass report.

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

### Phase 19: Remove colored dots from theme picker ✅

**Goal:** Drop the small accent-color swatch from the theme picker trigger button in `HeaderBar` so the control reads as a clean palette + chevron.
**Requirements**: N/A (UI polish)
**Depends on:** Phase 18
**Plans:** 0 plans (trivial inline fix)

Done inline 2026-05-13: removed the 8×8 `var(--color-accent)` swatch span from `HeaderBar.tsx`. UI tests still green (373/373).

### Phase 20: Discover logs in both .vscode-oss-dev and .vscode-oss-agents-dev roots ✅

**Goal:** Add `~/.vscode-oss-dev/logs` as a default discovery root alongside the existing `~/.vscode-oss-agents-dev/logs` so AHP JSONL logs from both OSS dev launch profiles surface in the picker.
**Requirements**: N/A (discovery coverage)
**Depends on:** Phase 19
**Plans:** 0 plans (trivial inline fix + unit test)

Done inline 2026-05-13: extracted `ossDevRoots` array in `defaultRoots()` and added a vitest assertion. Both roots share the `vscode-oss-dev` origin tag — the picker's `contextLabel` breadcrumb already disambiguates them. 7/7 host-node tests pass.

### Phase 21: Show response below request in detail side pane ✅

**Goal:** When a request/response pair is loaded in the detail side pane, render both JSON payloads stacked — request on top, response below — regardless of which row was clicked.
**Requirements**: ad-hoc UX improvement (no formal REQ).
**Depends on:** Phase 20
**Plans:** done inline (no PLAN.md)

Done inline 2026-05-13: added `orderedPair()` helper and `DetailJsonSection` component in `packages/ui/src/components/detail/DetailPanel.tsx`. The JSON tabpanel now renders two labelled sections (Request / Response) when `pairEvent` exists, sharing the single pretty/raw tab toggle. Unpaired events (notifications, pending requests, parse errors) still render a single section. New vitest assertion covers DOM ordering. 374/374 UI tests pass.

### Phase 22: Improve large-log loading and high-throughput live tail performance

**Goal:** Make large JSONL logs useful sooner and keep live-tail inspection responsive under append bursts through targeted patch locality, truthful progressive-load progress, bounded browser publication, and visible compact backlog state.
**Requirements**: TBD
**Depends on:** Phase 21
**Plans:** 6/6 plans complete

Plans:
**Wave 1**
- [x] 22-01-PLAN.md — Expose correlator changed-index locality for targeted metadata patching

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 22-02-PLAN.md — Replace AppState historical patch rescans with changed-index projection

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 22-03-PLAN.md — Carry truthful baseline progress and SSE backlog frames end to end

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 22-04-PLAN.md — Publish progressive rows and batched live updates through the browser store/client

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 22-05-PLAN.md — Render trustworthy loading status and compact transport backlog cues
- [x] 22-06-PLAN.md — Preserve persistence hydration timing and stable viewport/tail-follow behavior

### Phase 23: I want to improve the so-called hacker theme. Can we do something really crazy? Can we apply a CRT effect to the whole screen, kind of warp it?

**Goal:** Turn Hacker into a bold whole-screen curved-glass CRT identity across the shared standalone/webview app surface, with tube framing, layered analog artifacts, ambient-but-comfortable motion, static reduced-motion fallback, and fixture-backed interaction/parity evidence that preserves Phase 22 responsiveness posture.
**Requirements**: TBD
**Depends on:** Phase 22
**Plans:** 2/3 plans executed

Plans:
**Wave 1**
- [x] 23-01-PLAN.md — Prove the shared Hacker displacement filter surface and pointer/layout-safe placement.

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 23-02-PLAN.md — Overhaul Hacker CRT tokens, tube/glass/fringe overlays, ambient jolts, and static reduced-motion fallback.

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 23-03-PLAN.md — Capture fixture screenshots, interaction/responsiveness smoke, extension webview parity, and final visual review checkpoint.

### Phase 24: Improve search navigation and timeline scroll ergonomics

**Goal:** Make timeline search cycling and bottom-of-list navigation obvious and discoverable, with visible x-of-y feedback while pressing Enter/Shift+Enter and a manual scroll-to-bottom control when the timeline is no longer parked at the tail.
**Requirements**: TBD
**Depends on:** Phase 23
**Plans:** 0 plans (inline UI polish)

- [ ] Update the filter bar search status to show the currently focused result as `x of y`.
- [ ] Add a manual scroll-to-bottom control to the timeline shell.
- [ ] Rename the visible timeline/filter label from Session to Channel for the current AHP terminology.

### ✅ Phase 25: Row search filter, consistent dropdown defaults, and select/clear-all controls (shipped 2026-05-30)

**Goal:** Let users narrow visible timeline rows with an explicit projected-row text filter while preserving Search as full-event highlight/navigation, and make categorical filter menus truthful visibility checklists with uniform all/none controls and the existing default-hidden `ping` behavior.
**Requirements**: FILTER-25-01 (projected-row string filter independent of Search), FILTER-25-02 (checked-visible categorical defaults with `ping` hidden by default), FILTER-25-03 (Select all/Uncheck all menu actions), FILTER-25-04 (per-log durability, fixture-backed verification, and documented semantics)
**Depends on:** Phase 24
**Plans:** 5/5 plans + 2/2 gap-closure plans complete

Plans:
**Wave 1**
- [x] 25-01-PLAN.md — Define bounded row-text filtering and uniform hidden-value facet semantics with selector/timeline regressions.

**Wave 2** *(blocked on Wave 1 completion; plans may execute in parallel)*
- [x] 25-02-PLAN.md — Version and migrate per-log filter preferences without reversing old checkbox meaning.
- [x] 25-03-PLAN.md — Add Filter rows, consistent checked-visible menus, Select all/Uncheck all, and accurate chips.

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 25-04-PLAN.md — Prove the workflow with safe-fixture desktop/narrow browser evidence and documented semantics.

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 25-05-PLAN.md — Review the fixture-only desktop/narrow compact filter surface evidence before completion.

**Gap-closure plans** *(executed after 25-05 to resolve verification gaps)*
- [x] 25-06-PLAN.md — SearchPopover/SearchTrigger UI refactor: replace side-by-side Search/Filter with RowFilterInput (primary flex) + SearchTrigger button (compact 28px) + SearchPopover (raised popover). User rejection of visual density addressed with new layout.
- [x] 25-07-PLAN.md — Preserve v1 legacy hidden Method values during schema migration: fix migrateV1Filters() to read and preserve all categorical arrays (not just reset to defaults). Add regression test for custom hidden Method preservation.

---
*Roadmap reorganized after v1.1 milestone archive: 2026-05-10*
*v1.2 opened 2026-05-10; last updated 2026-05-30 (Phase 25 complete with gap-closure on UI composition and legacy migration)*
