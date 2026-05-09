# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Initial MVP

**Shipped:** 2026-05-08  
**Phases:** 6 | **Plans:** 37

### What Was Built

- Local CLI-launched AHP Inspector with loopback server, CSP/host guard, static UI serving, and no outbound viewing dependencies.
- JSONL parser/normalizer, canonical event model, legacy sample adapter, scrubbed fixtures, and request/response correlation.
- Virtualized timeline with search, filters, grouping, live tail, pause/resume, row summaries, pair highlighting, and robust empty/error states.
- Detail inspector with AHP fields, pair metadata, expanded Pretty JSON, raw JSON, truncation, copy actions, and privacy captions.
- Three polished token-driven themes, responsive detail layouts, Playwright E2E coverage, UAT screenshots, and full milestone audit.

### What Worked

- Phase-by-phase vertical slices kept the app usable throughout: CLI/server/timeline first, then detail/search, then live-tail/persistence, then polish.
- The inserted Phase 04.1 prevented theme polish from hiding row-information problems and produced a better final timeline contract.
- Cross-phase milestone audit was valuable; it found real integration bugs that isolated phase tests missed.

### What Was Inefficient

- Some generated milestone accomplishments were noisy and needed manual cleanup before archive.
- Several validation/UAT metadata files stayed stale after implementation even though the tests passed, which added archive friction.
- Rotation behavior needed both server-side index reset and host watcher coalescing; the first fix was not sufficient until exercised by the full vertical slice.

### Patterns Established

- `AppState` owns ingest, projection, correlation, search indexing, and fan-out; route handlers stay transport-only.
- UI rows are compact projections; raw event detail/search stays behind bounded server endpoints.
- Design tokens are the single source of truth for color/theme behavior, guarded by tests.
- Per-log persistence is keyed by opaque `logKey`, never by raw path.
- Real logs are used only structurally unless scrubbed; committed fixtures remain synthetic or privacy-reviewed.

### Key Lessons

1. Run cross-phase audits before archive; they catch bugs at subsystem boundaries that phase-local gates can miss.
2. Keep validation and UAT metadata updated as part of phase completion, not only code/tests.
3. Test log rotation with non-empty replacement files; truncate-to-zero is not enough to validate tail/reset contracts.
4. Scope browser caches by log identity whenever row indexes can be reused across active logs.

### Cost Observations

- Sessions: multiple disconnected/resumed sessions across v1.0 planning and execution.
- Notable: background GSD executors kept phase execution moving while main context handled audit and lifecycle orchestration.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 6 | Established full GSD loop: plan, execute, UAT, audit-fix, archive |

### Cumulative Quality

| Milestone | Tests | Coverage |
|-----------|-------|----------|
| v1.0 | 562 Vitest tests + 1 Playwright E2E | Parser, server, UI, live-tail, themes, E2E, fixture scrub |

### Top Lessons

1. Prefer end-to-end verification for lifecycle flows that cross host-node, server, SSE, store, and UI.
2. Treat privacy/scrub checks as release gates because AHP logs can contain sensitive content.
