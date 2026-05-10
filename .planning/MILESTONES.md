# Milestones

## v1.1 Reducer-backed State Snapshots (Shipped: 2026-05-10)

**Status:** shipped
**Phases completed:** 9 phases (06–14), 29 plans
**Audit:** `.planning/milestones/v1.1-MILESTONE-AUDIT.md` — passed (re-audited 2026-05-10)
**Archive:** `.planning/milestones/v1.1-ROADMAP.md`, `.planning/milestones/v1.1-REQUIREMENTS.md`

### What Shipped

- **Protocol sync foundation (Phase 6):** Generated `@ahp-inspector/protocol` workspace package with deterministic sync from sibling `../agent-host-protocol`, recorded source commit, reducer parity fixtures, and migrated all consumers off the stale file dependency.
- **Deterministic replay engine (Phase 7):** Pure `replayToIndex()` API reconstructing root/session/terminal state from snapshots and server action envelopes, with diagnostics for malformed payloads, missing baselines, unknown actions, sequence gaps, and ignored client intent; reducer-derived `Date.now()` made deterministic.
- **Server state-at-index API (Phase 8):** `StateReplayIndex` lifecycle alongside EventStore/Correlator/SearchIndex with bounded LRU cache; lazy `/api/state-at` endpoint with confidence and diagnostics; SSE row payloads stay free of replay fields.
- **State inspector UI (Phase 9):** Explicit "State at this point" action, root/session/terminal resource selector, Summary/Pretty JSON/Raw JSON views, confidence badge, diagnostics panel, and copy actions — all themed across dark/light/hacker.
- **Pinned comparison (Phase 10):** Memory-only two-pin state model with top-level changed-path comparison, confidence-aware incomplete-comparison warning, Playwright E2E for pinning/comparison, and large-log responsiveness verification.
- **VS Code extension webview (Phase 11):** Command palette entry, active-`.jsonl` preselect, typed `postMessage` transport replacing loopback HTTP/SSE, CSP-safe webview HTML, boundary + security gates, and standalone CLI mode preserved.
- **Search rather than filter (Phase 12):** Free-text search highlights and navigates matches instead of filtering; faceted filters remain row-narrowing; volatile match metadata sanitized at persist/hydrate boundaries.
- **`npx ahp-inspector` publishing (Phase 13):** Bounded VS Code log-roots walker auto-opens the most recent JSONL; publishable CLI package with bundled UI assets; `release.sh --dry-run` and `workflow_dispatch` publish workflow with `--provenance`.
- **Hardening pass (Phase 14):** State diagnostics scroll/wrap, row-highlight precedence (selected > pair > search), smarter notification summaries extracting `state`/`status`/`message`, and Enter/Shift+Enter search navigation with scroll-to-current-match.

### Quality Gates

- `pnpm test` — 91 files / 1095 tests passed
- `pnpm -F @ahp-inspector/ui build` — passed
- `pnpm -F @ahp-inspector/cli build` — passed
- `pnpm -F @ahp-inspector/extension build` — passed
- `pnpm -r typecheck` — passed (10 packages)
- `pnpm lint` — passed (biome)
- E2E specs `phase10`, `phase12`, `phase14` — passed
- Milestone audit re-run — passed; 38/38 v1.1 requirements satisfied; 9/9 phases verified; all 9 phases Nyquist compliant.

### Audit Remediation (before close)

- Backfilled missing rolled-up `VERIFICATION.md` for phases 11, 12, 14.
- Backfilled `VALIDATION.md` (Nyquist) for phases 11, 12, 13, 14, marked `backfilled: true`.
- Renamed phase 13 `VERIFICATION.md` → `13-VERIFICATION.md` to match repo convention.
- Backfilled phase 10 plan summaries 10-01 and 10-02.
- Committed phase 14 e2e spec, UAT.md, and screenshot that had been left untracked locally.

### Known deferred items at close

3 items recorded in `STATE.md` Deferred Items table — 2 phase UAT scripts that were never marked off (covered by automated tests) and 3 phase-13 CONTEXT.md questions that were resolved in execution but never moved to the resolved section.

---

## v1.0 Initial MVP (Shipped: 2026-05-08)

**Status:** shipped  
**Phases completed:** 6 phases, 37 plans  
**Audit:** `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — passed  
**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

### What Shipped

- A standalone local CLI-launched AHP Inspector with loopback-only server, CSP/host guard, static UI serving, and no outbound viewing dependencies.
- A tolerant JSONL ingestion pipeline with canonical AHP event normalization, legacy sample adapter, scrubbed fixtures, and JSON-RPC-safe request/response correlation.
- A fast virtualized timeline with search, faceted filters, grouping, keyboard navigation, parse-error rows, row summaries, and request/response pair highlighting.
- A detail inspector with AHP-specific field strip, correlation metadata, expanded Pretty JSON, raw JSON, truncation handling, and copy actions.
- Live log discovery/open/switch/tail behavior with pause/resume, rotation/watch-error/log-reset handling, per-log preference persistence, and safe browser-visible errors.
- Polished dark, light, and hacker themes through design tokens, responsive desktop/drawer layouts, Playwright E2E coverage, and committed UAT screenshots.

### Quality Gates

- `pnpm test` — 45 files / 562 tests passed
- `pnpm -F @ahp-inspector/ui build` — passed
- `pnpm -F @ahp-inspector/cli build` — passed
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm e2e` — passed
- Milestone integration re-audit — passed, 12/12 integration and 7/7 flows

### Audit Fixes Closed Before Archive

- F-01: patched paused live-tail buffers so correlation updates survive resume.
- F-02: scoped detail-cache entries by active log key to prevent stale cross-log details.
- F-03: reset server/search/detail indexes on non-empty rotation and coalesced tail writes during rotation.
- F-04: surfaced pair/correlation metadata in the detail UI and copy summary.

### Deferred

No v1 blockers or accepted tech debt remain. v2 candidates remain in the archived requirements: VS Code extension packaging, multi-log comparison, saved filters/bookmarks/export, dashboards, advanced filter DSL, diffing, and schema validation.

---
