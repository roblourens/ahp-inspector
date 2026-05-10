---
phase: 13
slug: npx-publishing-and-auto-open-latest-log
status: backfilled
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
backfilled: true
backfill_note: "Retroactively created during v1.1 milestone audit; phase already executed and verified."
---

# Phase 13 — Validation Strategy

> Per-phase Nyquist validation contract for `npx ahp-inspector` publishing and auto-open-latest-log.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | root `vitest.config.ts`, `packages/cli/tsup.config.ts`, `scripts/release.sh`, `.github/workflows/release.yml` |
| **Quick run command** | `pnpm test -- packages/cli` |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm lint && pnpm -F @ahp-inspector/cli build` |
| **Estimated runtime** | repo-standard; release dry-run is opt-in |

## Sampling Rate

- After every task commit: `pnpm test -- packages/cli` and (if host changes) `pnpm test -- packages/host-node`.
- After every plan wave: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- Before `/gsd-verify-work`: full suite green + `bash scripts/release.sh --dry-run` succeeds.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | NPX-02 | n/a (read-only filesystem walker) | Walker is bounded, uses real `parseLine` + `normalize`, rejects parse errors, never reads outside known VS Code log roots | unit | `pnpm test -- packages/host-node/src/findLatestAhpLog.test.ts` | ✅ | ✅ green |
| 13-01-02 | 01 | 1 | NPX-02, NPX-03 | n/a | CLI no-arg branch wires walker correctly with documented stderr; explicit path argument bypasses walker; `--no-auto-discover` flag bypass | unit | `pnpm test -- packages/cli/src/cli-autodiscovery.test.ts packages/cli/src/cli-launch.test.ts` | ✅ | ✅ green |
| 13-02-01 | 02 | 2 | NPX-01, NPX-04 | n/a | `package.json` is publish-clean: no `main`/`types`/`exports`; workspace deps in devDependencies; postbuild copies UI dist; files allow-list ships only `dist`, `ui-dist`, `README.md` | static | `node -e "const p=require('./packages/cli/package.json'); if(p.main||p.types||p.exports) process.exit(1)"` and `pnpm -F @ahp-inspector/cli build` | ✅ | ✅ green |
| 13-02-02 | 02 | 2 | NPX-04 | n/a | Postbuild copies `packages/ui/dist` → `packages/cli/ui-dist` so binary runs without post-install build | build | `pnpm -F @ahp-inspector/cli build && test -f packages/cli/ui-dist/index.html` | ✅ | ✅ green |
| 13-03-01 | 03 | 3 | NPX-05 | n/a | `release.sh` is executable, supports `--dry-run`, uses `pnpm pack`, smoke-installs, and prints documented dry-run line | static | `bash scripts/release.sh --dry-run` | ✅ | ✅ green |
| 13-03-02 | 03 | 3 | NPX-05 | n/a | Release CI is `workflow_dispatch` with `dry_run` defaulting true and `--provenance` on real publish | static | `grep -nE 'workflow_dispatch\|provenance' .github/workflows/release.yml` | ✅ | ✅ green |
| 13-03-03 | 03 | 3 | NPX-06 | n/a | README, USER_GUIDE, and `packages/cli/README.md` document npx flow, auto-discovery rule, and local-only privacy posture | static | `grep -nE "npx ahp-inspector\|loopback\|no telemetry" README.md USER_GUIDE.md packages/cli/README.md` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Phase 13 plans did not include explicit STRIDE threat tables. The dominant threat surface is publishing-related (supply-chain), and is mitigated through:

- workspace deps moved to `devDependencies` so published `package.json` does not pull workspace protocols at install time;
- `files` allow-list ensures only `dist`, `ui-dist`, and `README.md` ship;
- release workflow is opt-in (`workflow_dispatch`) and uses `--provenance` for real publishes;
- `release.sh --dry-run` is the documented preflight.

## Wave 0 Requirements

- [x] `packages/host-node/src/findLatestAhpLog.ts` — bounded walker.
- [x] `packages/cli/src/index.ts` — CLI no-arg wiring + `--no-auto-discover`.
- [x] `packages/cli/package.json` — publish-clean manifest.
- [x] `packages/cli/scripts/copy-ui-dist.cjs` — postbuild UI assets copy.
- [x] `scripts/release.sh` — release pipeline with `--dry-run`.
- [x] `.github/workflows/release.yml` — workflow_dispatch publish.

## Manual-Only Verifications

- Real `npm publish` (gated to maintainer; the dry-run path exercises everything but the upload).
- A one-time clean `npx ahp-inspector` smoke from a published version (re-runs each release).

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all baseline references
- [x] No watch-mode flags
- [x] Feedback latency controlled through focused package commands
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** backfilled and approved 2026-05-09 during v1.1 milestone audit.
