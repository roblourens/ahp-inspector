# Milestones

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
