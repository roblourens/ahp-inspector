---
phase: 04-live-tail-discovery-and-persistence
plan: 01
subsystem: discovery
tags: [discovery, host-node, ingest-02, privacy, bounded-walk]
requires: [04-00]
provides:
  - "discoverVsCodeLogs(opts?): Promise<DiscoveryResult> — bounded walk of VS Code log roots"
  - "resolveCandidateId(id): string | null — server-side opaque id → absPath lookup for Wave 2"
  - "DiscoveryResult { candidates, truncated } shared type"
  - "LogCandidate.confidence (high|medium|low) + LogCandidate.contextLabel additive fields"
  - "HostMessageDiscoverResponse.result : DiscoveryResult"
affects:
  - "packages/shared/src/host-protocol.ts (LogCandidate, HostAdapter, HostMessage union)"
  - "packages/host-node/src/host-adapter.ts (NodeHostAdapter.discoverLogs return type)"
tech-stack:
  added: []
  patterns:
    - "Bounded filesystem traversal (≤50 launch dirs listed, top-10 descended, depth-3, ≤5000 stats, ≤1500 ms)"
    - "sha256(absPath).slice(0,32) opaque candidate ids — no path strings cross the trust boundary"
    - "Module-private id→absPath map rebuilt per call; latest discovery wins on collision"
    - "Confidence tiering with hard pin: legacy agenthost.*.log forced to 'low' regardless of bonuses"
    - "Optional now() injection seam for deterministic time-budget tests"
key-files:
  created:
    - packages/host-node/src/discovery.test.ts
    - test/fixtures/discovery/README.md
  modified:
    - packages/shared/src/host-protocol.ts
    - packages/host-node/src/discovery.ts
    - packages/host-node/src/host-adapter.ts
    - packages/host-node/src/host-adapter.test.ts
    - packages/host-node/src/index.ts
    - packages/server/src/app-state.test.ts
decisions:
  - "Legacy *.log files are pinned to confidence='low' even when other bonuses (recency, copilot path) push their score above the 'high' threshold — matches CONTEXT D-03 intent that JSONL is canonical."
  - "idToPath map is per-call (cleared at start of each discoverVsCodeLogs); Wave 2 must resolve a candidate before another discovery overwrites the map."
  - "contextLabel is built launch-dir-relative; tmp-root or home-dir prefix is never present, so it can ship to the browser."
  - "Symlinks: stat (not lstat) follows links once. Depth + stat caps make symlink loops safe; documented as accepted risk in the plan threat register (T-04-01-03)."
metrics:
  tasks_completed: 3
  tests_added: 6
  duration: ~12 min
  completed: 2026-04-08
---

# Phase 04 Plan 01: VS Code Log Discovery Walk Summary

Real `discoverVsCodeLogs()` implementation closes INGEST-02 at the host layer with a bounded, privacy-preserving walk of platform-specific VS Code log roots; opaque sha256 candidate ids and tier-based confidence labels are exposed to the browser while absolute paths stay server-side, gated by `resolveCandidateId(id)` for Wave 2 session routes.

## What Shipped

- **Shared contracts (Task 1)** — `LogCandidate` extended additively with `confidence: "high"|"medium"|"low"` and optional `contextLabel`; new `DiscoveryResult { candidates, truncated }`; `HostAdapter.discoverLogs(): Promise<DiscoveryResult>`; `HostMessageDiscoverResponse.result` carries `DiscoveryResult` (was `candidates`).
- **Discovery walk (Task 2)** — Platform-aware default roots (macOS / Linux / Windows). Bounded traversal: ≤50 launch dirs listed per root, top-10 by mtime descended, depth-3 below launch, ≤5000 stat ops, ≤1500 ms wall-clock. Filename matchers for canonical AHP JSONL, AHP-named JSONL, and legacy `agenthost.*.log`. Score → tier mapping per RESEARCH §1.3, with legacy-log pin to `low`. Opaque sha256 candidate ids; module-private id→absPath map rebuilt per call. Sort: confidence asc, then mtime desc; capped to 200 results; soft early-stop sets `truncated:true` when collected > 800.
- **Test harness (Task 3)** — `discovery.test.ts` builds two synthetic launch sessions (`window1/exthost/GitHub.copilot-chat`) per root with a JSONL + legacy `.log` + noise files. Six cases verify tier ordering, opaque-id format, label/contextLabel privacy (no `/`, no tmpRoot prefix), `resolveCandidateId` round-trip, `truncated:true` under maxStats and time-budget exhaustion, and silent skip of nonexistent roots.

## Verification

- `pnpm vitest run packages/host-node/src/discovery.test.ts` — 6 / 6 pass (104 ms).
- `pnpm test` — 33 files / 429 tests green (1.66 s).
- `pnpm typecheck` — all packages clean.
- `pnpm lint` — clean (biome organize-imports auto-applied to host-adapter.ts + app-state.test.ts).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 – Bug] Legacy `agenthost.*.log` could land in tier `high`**
- **Found during:** Task 3, first test run.
- **Issue:** Score for a legacy `.log` file in a `GitHub.copilot-chat` parent dir with recent mtime: 15 (legacy match) + 20 (copilot path) + 15 (recent) + 5 (size>0) = 55, which is `>=50` → `high`. Test expected `low`, and CONTEXT D-03 mandates legacy logs are fallbacks, not canonical AHP. Plus the same-launch `.log` (written after the `.jsonl`) had a later mtime, sorting it ahead of the `.jsonl` despite both being labeled `high`.
- **Fix:** In `discovery.ts`, after computing score/tier, force `confidence = "low"` whenever `FILENAME_RE_LEGACY_AGENTHOST.test(name)`.
- **Files modified:** `packages/host-node/src/discovery.ts`.
- **Commit:** `30a61b1`.

**2. [Rule 3 – Blocking] Existing fakes returned `LogCandidate[]`**
- **Found during:** Task 2 typecheck.
- **Issue:** `packages/server/src/app-state.test.ts` and `packages/host-node/src/host-adapter.test.ts` had fake `HostAdapter` impls returning `LogCandidate[]`; Phase-1 placeholder test asserted `discoverLogs()` returned `[]`.
- **Fix:** Updated mocks to return `{ candidates: [], truncated: false }`. Replaced the Phase-1 placeholder test with one that asserts the new `DiscoveryResult` shape.
- **Files modified:** `packages/server/src/app-state.test.ts`, `packages/host-node/src/host-adapter.test.ts`.
- **Commit:** `c88aa90`.

**3. [Style – auto-applied] Biome organize-imports**
- Triggered on `packages/host-node/src/host-adapter.ts` and `packages/server/src/app-state.test.ts` after the new `DiscoveryResult` import was added. Auto-fixed via `pnpm lint --write`.
- **Commit:** `30a61b1`.

## Authentication Gates

None — fully local filesystem operations.

## Threat Surface

All threats from the plan threat register (T-04-01-01 … T-04-01-05) are mitigated as planned:

- **T-04-01-01 (info disclosure):** Privacy assertions in test 2 verify `id` is exactly `[0-9a-f]{32}`, `label` contains no separator, `contextLabel` does not contain the tmp root prefix.
- **T-04-01-02 (DoS traversal):** Tests 4 and 5 confirm `truncated:true` under `maxStats:2` and `timeBudgetMs:0`.
- **T-04-01-03 (symlink loop):** Depth + stat caps; documented accepted risk.
- **T-04-01-04 (error log info disclosure):** All `readdir` / `stat` errors swallowed via `try/catch { continue }` — no stderr writes from discovery.
- **T-04-01-05 (huge file lists):** `MAX_RESULTS=200` final cap + `MAX_RESULTS*4` soft early stop with `truncated:true`.

No new surface introduced beyond the plan.

## Commits

- `410b223` feat(04-01): extend LogCandidate with confidence/contextLabel; add DiscoveryResult
- `c88aa90` feat(04-01): implement bounded discoverVsCodeLogs walk + scoring + opaque ids
- `30a61b1` test(04-01): synthetic VS Code log tree fixture covers ordering, privacy, truncation

## Self-Check: PASSED

- `packages/shared/src/host-protocol.ts` — modified ✓
- `packages/host-node/src/discovery.ts` — modified ✓
- `packages/host-node/src/discovery.test.ts` — created ✓
- `packages/host-node/src/host-adapter.ts` — modified ✓
- `packages/host-node/src/host-adapter.test.ts` — modified ✓
- `packages/host-node/src/index.ts` — modified ✓
- `packages/server/src/app-state.test.ts` — modified ✓
- `test/fixtures/discovery/README.md` — created ✓
- Commits `410b223`, `c88aa90`, `30a61b1` present in `git log` ✓
