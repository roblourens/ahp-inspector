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

## Milestone: v1.1 — Reducer-backed State Snapshots

**Shipped:** 2026-05-10
**Phases:** 9 (06–14) | **Plans:** 29

### What Was Built

- Generated `@ahp-inspector/protocol` workspace package with deterministic sync from `../agent-host-protocol`, reducer parity fixtures, source-commit metadata, and full consumer migration off the stale file dependency.
- Pure `replayToIndex()` reducer engine reconstructing root/session/terminal state from snapshots and server action envelopes, with deterministic `Date.now()` and confidence diagnostics for missing baselines, gaps, and unknown actions.
- `StateReplayIndex` + lazy `/api/state-at` server endpoint backed by bounded LRU cache; SSE rows never inflate with replay payloads.
- State inspector UI: "State at this point" entry, resource selector, Summary/Pretty/Raw views, confidence badge, diagnostics panel, copy actions, themed across dark/light/hacker.
- Memory-only two-pin comparison with top-level changed-path diff and confidence-aware incomplete-comparison warning.
- VS Code extension command palette + webview using typed `postMessage` transport (no loopback in extension mode), CSP-safe asset loading, boundary + security gates against forbidden imports.
- Search-rather-than-filter UX: highlights and navigates matches, Enter/Shift+Enter cycles, scroll-to-current-match; faceted filters remain row-narrowing.
- `npx ahp-inspector` publishing with bounded VS Code log-roots walker, bundled UI assets, `release.sh --dry-run`, and `workflow_dispatch` publish workflow with `--provenance`.
- Hardening pass: state diagnostics scroll/wrap, row-highlight precedence cleanup, smarter notification summaries, search keyboard ergonomics.

### What Worked

- The protocol sync foundation (Phase 6) being first made every downstream phase a thin layer over canonical types — replay, server API, and UI inspector never had to invent state shapes.
- The strict `state-at-index` lazy cache plus SSE-payload non-inflation contract held under large-log integration tests on the first try.
- Inserting Phase 12 (search-rather-than-filter) and Phase 14 (hardening) mid-milestone as scope additions was cheap because the GSD discuss/plan/execute chain still applied — they just skipped some of the heavier upfront context artifacts.
- The boundary + security tests added in Phase 11 codified the local-only privacy posture as repository invariants instead of process discipline.
- The const-enum issue in `event-narrow.ts` was caught and fixed in a small follow-up commit (3be5e0b) without touching the milestone scope.

### What Was Inefficient

- Three phases (11, 12, 14) shipped without rolled-up `VERIFICATION.md` artifacts and four phases (11, 12, 13, 14) without `VALIDATION.md` — the audit had to backfill them later. Pattern: in-flight scope additions skipped the rolled-up artifacts even when per-plan SUMMARY.md were produced.
- Phase 13's verification file shipped as `VERIFICATION.md` instead of `13-VERIFICATION.md`, breaking the filename convention. Caught at audit, not at execution.
- Phase 10 plans 10-01 and 10-02 never got their own `SUMMARY.md` — the wave-1 and wave-2 work was rolled into 10-03's summary, leaving the per-plan artifact tree incomplete.
- Phase 14's e2e spec, UAT.md, and screenshot were created locally but never committed; the audit discovered them as untracked files.
- The 13-CONTEXT.md open questions ("npm name availability", "headless detect", "publish trigger") were resolved during execution but never moved out of the "Open questions" section, so the artifact audit flagged them at close.
- Auto-generated milestone "accomplishments" from `milestone.complete` included stub strings ("Plan:", "Phase:", "1. [Rule 1 - Bug] ...") that had to be hand-edited before archive.

### Patterns Established

- **Generated protocol package as the single source of truth.** `pnpm sync:ahp` regenerates `@ahp-inspector/protocol` deterministically; consumers import from it; nobody hand-rolls reducer logic.
- **Lazy replay through bounded indexes.** State-at-index uses an LRU cache scoped to AppState; SSE row payloads stay free of replay state; rotation/log-switch/dispose reset the cache.
- **Confidence as a first-class field.** Every reconstructed state result carries `complete | partial | unknown` with diagnostics explaining missing baselines, gaps, and ignored intent.
- **Boundary tests as architectural guardrails.** `test/boundary.test.ts` forbids `vscode`/`@ahp-inspector/extension` imports in portable packages and the UI; `test/security.test.ts` forbids extension-side loopback server imports and validates CSP.
- **Typed message protocol per host.** Both the extension webview transport and the HTTP/SSE transport ride on the same shared contract; only the wire layer differs.
- **Backfill missing audit artifacts at milestone close.** When the audit shows gaps, the right move is to backfill (and annotate `backfilled: true`) rather than wave them through as tech debt.

### Key Lessons

1. **Rolled-up `VERIFICATION.md` and `VALIDATION.md` are not optional for scope-inserted phases.** Build a workflow tripwire: a phase is not "complete" if those two files are missing, regardless of plan-level SUMMARY.md completeness.
2. **Filename conventions matter.** A single `13-` prefix dropped silently is invisible until audit; consider a gsd-sdk check that enforces `<NN>-VERIFICATION.md`.
3. **CONTEXT.md "Open questions" need a lifecycle.** Resolved questions should move to a "Resolved" section or get linked to the SUMMARY that answered them, otherwise audits flag them indefinitely.
4. **Don't trust auto-generated accomplishments.** `milestone.complete` extracts noisy strings; budget 5 minutes to clean the MILESTONES.md entry before archive.
5. **Untracked local artifacts decay.** Phase 14's e2e spec sitting untracked is a near-miss; consider a `git status --porcelain` check inside `/gsd-verify-work`.

### Cost Observations

- Sessions: one long continuous session covering 5 UI fixes → typed-handler refactor → repo-wide biome cleanup → audit → close. Subsequent prompts replayed compaction summaries successfully.
- Notable: the same session was used end-to-end for both audit-and-remediate and milestone-close, which kept context coherent. Splitting at the audit boundary would have lost the why behind backfilled artifacts.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 6 | Established full GSD loop: plan, execute, UAT, audit-fix, archive |
| v1.1 | 9 | Added mid-milestone scope insertion (Phases 12/13/14) on top of the v1.0 loop; surfaced the need to harden VERIFICATION/VALIDATION artifact discipline when scope grows in-flight |

### Cumulative Quality

| Milestone | Tests | Coverage |
|-----------|-------|----------|
| v1.0 | 562 Vitest tests + 1 Playwright E2E | Parser, server, UI, live-tail, themes, E2E, fixture scrub |
| v1.1 | 1095 Vitest tests + 4 Playwright specs | + Protocol package, replay engine, state-at-index API, state inspector UI, pinned comparison, VS Code extension, search/filter separation, npx publishing, hardening |

### Top Lessons

1. Prefer end-to-end verification for lifecycle flows that cross host-node, server, SSE, store, and UI.
2. Treat privacy/scrub checks as release gates because AHP logs can contain sensitive content.
3. Rolled-up `VERIFICATION.md` and `VALIDATION.md` are mandatory for every phase, including scope-inserted phases; per-plan SUMMARY.md is not a substitute.
4. CONTEXT.md "Open questions" need an explicit close lifecycle so they do not drift into milestone-close artifact audits.
5. Don't trust auto-generated accomplishments from `milestone.complete` — always hand-edit before archive.
