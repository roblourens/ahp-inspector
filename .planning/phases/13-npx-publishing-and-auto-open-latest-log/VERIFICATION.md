---
phase: 13-npx-publishing-and-auto-open-latest-log
verified: 2026-05-09T00:00:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 13: npx publishing and auto-open latest log — Verification Report

**Phase Goal:** Ship the standalone AHP Inspector as a published npm package so a single `npx ahp-inspector` invocation downloads the package, starts the loopback HTTP server, opens the browser, and immediately streams the most-recently-modified AHP JSONL log under the standard VS Code log roots.

**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                          | Status     | Evidence |
|----|------------------------------------------------------------------------------------------------|------------|----------|
| 1  | NPX-01: User can run `npx ahp-inspector` without cloning the repo (unscoped, top-level package) | ✓ VERIFIED | [packages/cli/package.json](packages/cli/package.json#L2) name `ahp-inspector`; [bin entry](packages/cli/package.json#L24-L26); MIT license + repo/homepage/bugs URLs ([L11-L20](packages/cli/package.json#L11-L20)) |
| 2  | NPX-02: No-arg invocation auto-discovers newest non-empty AHP-shape log and streams it         | ✓ VERIFIED | [find-latest-ahp-log.ts](packages/host-node/src/find-latest-ahp-log.ts#L42-L72) bounded walker + mtime sort + AHP probe; [cli/src/index.ts](packages/cli/src/index.ts#L141-L162) wires `findLatestAhpLog()` and prints `Watching <path>` on hit, friendly stderr on miss; tested by [cli-autodiscovery.test.ts](packages/cli/src/cli-autodiscovery.test.ts#L107-L138) |
| 3  | NPX-03: Explicit path argument bypasses auto-discovery (matches prior CLI behavior)             | ✓ VERIFIED | [cli/src/index.ts](packages/cli/src/index.ts#L120-L142) takes the explicit-path branch when `file` is truthy; auto-discovery only runs in the `else` branch; covered by [cli-autodiscovery.test.ts](packages/cli/src/cli-autodiscovery.test.ts#L168-L181) |
| 4  | NPX-04: Published tarball bundles prebuilt UI assets (no post-install build needed)             | ✓ VERIFIED | [copy-ui-dist.cjs](packages/cli/scripts/copy-ui-dist.cjs#L11-L23) copies `packages/ui/dist → packages/cli/ui-dist`; [package.json files allow-list](packages/cli/package.json#L27-L31) ships `dist`, `ui-dist`, `README.md`; [locateUiDist()](packages/cli/src/index.ts#L56-L83) finds `cliPackageDir/ui-dist` at runtime; build artifacts present (`dist/index.js`, `ui-dist/index.html`) |
| 5  | NPX-05: Release automation — script + CI workflow with documented dry-run mode                  | ✓ VERIFIED | [scripts/release.sh](scripts/release.sh#L60-L106) — clean tree assertion, frozen install, typecheck, test, builds, `pnpm pack`, smoke install, `--dry-run` prints `Dry run — would now run: npm publish --access public`; [.github/workflows/publish.yml](.github/workflows/publish.yml#L1-L57) workflow_dispatch with `dry_run` default true, `--provenance` on real publish, `id-token: write` |
| 6  | NPX-06: README/USER_GUIDE documents npx invocation + auto-discovery rule + privacy posture      | ✓ VERIFIED | [README.md Quickstart](README.md#L23-L66) covers `npx ahp-inspector`, flags, auto-discovery rule, privacy posture; [USER_GUIDE.md](USER_GUIDE.md#L1-L18) leads with npx install path; [packages/cli/README.md](packages/cli/README.md#L1-L29) is the npmjs landing page |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact                                            | Expected                                                                 | Status     | Details |
|-----------------------------------------------------|--------------------------------------------------------------------------|------------|---------|
| [packages/host-node/src/find-latest-ahp-log.ts](packages/host-node/src/find-latest-ahp-log.ts) | Bounded walker, mtime sort, AHP-shape probe via `parseLine` + `normalize`, rejects `kind === 'parse-error'` | ✓ VERIFIED | All elements present: time/stat caps ([L22-L26](packages/host-node/src/find-latest-ahp-log.ts#L22-L26)), mtime sort ([L65](packages/host-node/src/find-latest-ahp-log.ts#L65)), `parseLine` + `normalize` probe ([L122-L132](packages/host-node/src/find-latest-ahp-log.ts#L122-L132)), parse-error rejection ([L132](packages/host-node/src/find-latest-ahp-log.ts#L132)) |
| [packages/cli/src/index.ts](packages/cli/src/index.ts) | No-arg branch wires `findLatestAhpLog()`; explicit path bypass; `--no-auto-discover` flag | ✓ VERIFIED | `findLatestAhpLog` import [L17](packages/cli/src/index.ts#L17); `--no-auto-discover` option [L107-L110](packages/cli/src/index.ts#L107-L110); branch logic [L120-L162](packages/cli/src/index.ts#L120-L162); stderr message text matches CONTEXT verbatim |
| [packages/cli/package.json](packages/cli/package.json) | Name `ahp-inspector`, MIT, `bin`, `files`, workspace deps in devDependencies, `prepublishOnly`, NO `main`/`types`/`exports` | ✓ VERIFIED | All confirmed; `grep` for `main\|types\|exports` returns no matches; workspace deps under `devDependencies` ([L37-L44](packages/cli/package.json#L37-L44)); `prepublishOnly` runs typecheck + UI build + CLI build ([L34](packages/cli/package.json#L34)) |
| [packages/cli/scripts/copy-ui-dist.cjs](packages/cli/scripts/copy-ui-dist.cjs) | Postbuild copies `packages/ui/dist → packages/cli/ui-dist`         | ✓ VERIFIED | Source/dest paths correct ([L11-L12](packages/cli/scripts/copy-ui-dist.cjs#L11-L12)); fails fast if UI not built; wired via `build` script in [package.json L33](packages/cli/package.json#L33) |
| [packages/cli/README.md](packages/cli/README.md) | Short, npmjs-ready landing page                                          | ✓ VERIFIED | 29 lines, MIT license, npx examples, flags, privacy posture |
| [scripts/release.sh](scripts/release.sh) | Executable, `--dry-run`, uses `pnpm pack`, smoke install, dry-run notice  | ✓ VERIFIED | `-x` bit set; `--dry-run` parsing [L25-L27](scripts/release.sh#L25-L27); `pnpm pack` [L82](scripts/release.sh#L82); smoke install [L91-L101](scripts/release.sh#L91-L101); dry-run line [L104-L106](scripts/release.sh#L104-L106) |
| [.github/workflows/publish.yml](.github/workflows/publish.yml) | `workflow_dispatch`, `dry_run` default true, `--provenance` on real publish | ✓ VERIFIED | All present ([L3-L14](.github/workflows/publish.yml#L3-L14), [L51-L52](.github/workflows/publish.yml#L51-L52)); `id-token: write` for provenance |
| [README.md](README.md) | Quickstart + auto-discovery rule + privacy posture                       | ✓ VERIFIED | All three sections present ([L23-L66](README.md#L23-L66)) |
| [USER_GUIDE.md](USER_GUIDE.md) | Npx install path documented up front                                  | ✓ VERIFIED | First H2 is "Install and run" with `npx ahp-inspector` example ([L1-L18](USER_GUIDE.md#L1-L18)) |

### Key Link Verification

| From                              | To                              | Via                                                | Status   | Details |
|-----------------------------------|---------------------------------|----------------------------------------------------|----------|---------|
| `cli/src/index.ts`                | `findLatestAhpLog()`            | Import from `@ahp-inspector/host-node`             | ✓ WIRED  | [L17-L20](packages/cli/src/index.ts#L17-L20); call site [L144](packages/cli/src/index.ts#L144); result feeds `sessions.open()` [L147](packages/cli/src/index.ts#L147) |
| `find-latest-ahp-log.ts`          | `parseLine` + `normalize`       | Import from `@ahp-inspector/parser`                | ✓ WIRED  | [L11](packages/host-node/src/find-latest-ahp-log.ts#L11); used in `probeAhpShape` [L121-L132](packages/host-node/src/find-latest-ahp-log.ts#L121-L132); parser dep declared in [host-node/package.json L16](packages/host-node/package.json#L16) |
| `find-latest-ahp-log.ts`          | `discoverVsCodeLogs` filename regexes | Import `FILENAME_RE_AHP_*` from `./discovery.js` | ✓ WIRED  | [L13-L17](packages/host-node/src/find-latest-ahp-log.ts#L13-L17); used in `walk()` [L100-L102](packages/host-node/src/find-latest-ahp-log.ts#L100-L102) |
| `cli build`                       | `ui-dist/`                      | postbuild `node ./scripts/copy-ui-dist.cjs`        | ✓ WIRED  | `build` script chains both ([package.json L33](packages/cli/package.json#L33)); artifacts present on disk |
| Published tarball                 | runtime UI assets               | `locateUiDist()` checks `cliPackageDir/ui-dist`    | ✓ WIRED  | [cli/src/index.ts L67](packages/cli/src/index.ts#L67) |
| `scripts/release.sh`              | tarball                          | `pnpm pack` (not npm pack — workspace:* support)  | ✓ WIRED  | [L82](scripts/release.sh#L82) |

### Data-Flow Trace (Level 4)

| Artifact                          | Data Variable      | Source                                               | Produces Real Data | Status     |
|-----------------------------------|--------------------|------------------------------------------------------|--------------------|------------|
| `cli no-arg branch`               | `auto` path        | `findLatestAhpLog()` reads real FS via `defaultRoots()` | Yes (real walker, real probe) | ✓ FLOWING |
| `findLatestAhpLog`                | `collected[]`      | `walk()` over `defaultRoots()` w/ real `readdir`/`stat` | Yes               | ✓ FLOWING |
| `probeAhpShape`                   | `event`            | `parseLine` + `normalize` on real file bytes         | Yes               | ✓ FLOWING |

### Behavioral Spot-Checks

Skipped — orchestrator already ran the full test suite (1091/1091 pass) and `release.sh --dry-run 0.1.0` end-to-end (per 13-03 SUMMARY). The dry-run produced a 12-file tarball that smoke-installed and reported the correct version. No re-running required for read-only verification.

### Requirements Coverage

| Requirement | Source Plan       | Description                                                              | Status       | Evidence |
|-------------|-------------------|--------------------------------------------------------------------------|--------------|----------|
| NPX-01      | 13-02             | `npx ahp-inspector` (unscoped) without cloning                           | ✓ SATISFIED  | Truth #1 above |
| NPX-02      | 13-01             | No-arg auto-discovers newest AHP log and streams it                      | ✓ SATISFIED  | Truth #2 above |
| NPX-03      | 13-01             | Explicit path bypasses auto-discovery                                    | ✓ SATISFIED  | Truth #3 above |
| NPX-04      | 13-02             | Tarball bundles prebuilt UI assets                                       | ✓ SATISFIED  | Truth #4 above |
| NPX-05      | 13-03             | Release automation with dry-run mode                                     | ✓ SATISFIED  | Truth #5 above |
| NPX-06      | 13-03             | README/USER_GUIDE documents npx + auto-discovery + privacy               | ✓ SATISFIED  | Truth #6 above |

No orphaned requirements: REQUIREMENTS.md maps NPX-01..06 to Phase 13; all six are claimed across plans 13-01/13-02/13-03.

> Note: REQUIREMENTS.md still lists NPX-01..06 as `Planned` rather than `Done`. This is a tracking-table staleness, not an implementation gap — every requirement is fully satisfied in code. Worth a one-line bookkeeping update post-verification but does not block the phase.

### Anti-Patterns Found

None of significance. The CLI bundle (`packages/cli/dist/index.js`) opens with a single `#!/usr/bin/env node` shebang (no duplicate from a tsup banner — the documented deviation is correctly applied). Workspace deps are in `devDependencies` only (the documented packaging-bug fix from 13-03 is in place: no `main`/`types`/`exports` fields).

### Human Verification Required

None required for this phase. The remaining real-world steps (actual `npm publish`, fresh-machine `npx ahp-inspector` smoke) are operator actions that happen only when Rob chooses to publish; the dry-run rehearsal is fully automated and was executed end-to-end.

### Gaps Summary

No gaps. All six NPX requirements are implemented and wired:
- Auto-discovery walker exists, is bounded, uses real `parseLine` + `normalize`, and rejects parse errors.
- CLI no-arg branch wires it correctly with the exact stderr message from CONTEXT.
- Explicit path argument and `--no-auto-discover` flag both correctly bypass auto-discovery.
- `package.json` is publish-clean (no `main`/`types`/`exports`; workspace deps in devDependencies; postbuild copies UI dist; files allow-list ships only `dist`, `ui-dist`, `README.md`).
- `release.sh` is executable, supports `--dry-run`, uses `pnpm pack`, smoke-installs, and prints the documented dry-run line.
- GitHub Actions workflow is `workflow_dispatch` with `dry_run` default true and `--provenance` on real publish.
- README, USER_GUIDE, and `packages/cli/README.md` all document the npx flow, auto-discovery rule, and local-only privacy posture.

The three known deviations (pnpm pack vs npm pack; tsup banner removed; main/types/exports removed) are explicitly justified in the summaries and are correctly reflected in the code.

---

_Verified: 2026-05-09_
_Verifier: gsd-verifier_
