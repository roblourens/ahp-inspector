---
phase: 01
plan: 01
subsystem: foundation
tags: [workspace, tooling, vitest, biome, boundary, security, fixtures]
requirements: [FOUND-02, FOUND-04, VERIFY-04]
threats_mitigated: [T-01-01, T-01-02, T-01-03, T-01-04]
dependency_graph:
  requires: []
  provides:
    - "@ahp-inspector/shared (empty stub)"
    - "@ahp-inspector/parser (empty stub)"
    - "@ahp-inspector/core (empty stub)"
    - "@ahp-inspector/host-node (empty stub)"
    - "@ahp-inspector/server (empty stub)"
    - "@ahp-inspector/cli (empty stub)"
    - "Wave 0 test harness (boundary, security, fixture-scrub)"
    - "Wave 0 synthetic fixtures (tiny, malformed, crlf, bom, legacy)"
  affects: ["all subsequent plans depend on this scaffold"]
tech_stack:
  added:
    - typescript@5.9.3 (^5.6.0 requested; lock to 5.x — research Assumption A1)
    - vitest@4.1.5
    - "@biomejs/biome@2.4.14"
    - tsup@8.5.1
    - "@types/node@22.x"
    - commander@14.0.3 (declared in @ahp-inspector/cli; not yet installed runtime)
    - chokidar@5.0.0 (declared in @ahp-inspector/host-node; not yet installed runtime)
    - pnpm@9.15.0 (workspace manager)
  patterns:
    - "pnpm workspace with packages/* glob"
    - "Strict TS base (noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax)"
    - "Biome noRestrictedImports overrides for portable packages"
    - "Synthetic fixtures generated from in-memory shapes (never copied from real captures)"
    - "Test-as-authority for boundary/security guardrails (Biome warns; tests fail builds)"
key_files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml
    - tsconfig.base.json
    - biome.json
    - vitest.config.ts
    - .gitignore
    - .nvmrc
    - packages/shared/{package.json,tsconfig.json,src/index.ts}
    - packages/parser/{package.json,tsconfig.json,src/index.ts}
    - packages/core/{package.json,tsconfig.json,src/index.ts}
    - packages/host-node/{package.json,tsconfig.json,src/index.ts}
    - packages/server/{package.json,tsconfig.json,src/index.ts}
    - packages/cli/{package.json,tsconfig.json,src/index.ts}
    - test/fixtures/generate.ts
    - test/fixtures/tiny.jsonl
    - test/fixtures/malformed.jsonl
    - test/fixtures/crlf.jsonl
    - test/fixtures/bom.jsonl
    - test/fixtures/legacy.sample.log
    - test/boundary.test.ts
    - test/security.test.ts
    - test/fixture-scrub.test.ts
  modified: []
decisions:
  - "TypeScript pinned to ^5.6 (resolves to 5.9.x); TS 6 explicitly excluded by allow-list and locked decision."
  - "Biome 2.x file scope uses `includes` with negation (`!path`); .github/ and .planning/ excluded from lint to keep the build green."
  - "Fixtures are generated at test-module-load time so Vitest can register one `it` per fixture."
  - "Dropped `tsx` devDependency in favor of in-test fixture generation, keeping the security allow-list minimal."
  - "Per-package `noRestrictedImports` is best-effort in Biome 2.x; `test/boundary.test.ts` is the authoritative guard."
metrics:
  duration: ~10 minutes
  tasks_completed: 2
  tests_passing: 18
  test_files: 3
  packages_scaffolded: 6
  completed: "2026-05-07"
---

# Phase 01 Plan 01: Workspace + Wave 0 Guardrails Summary

Scaffolds a pnpm workspace with six TypeScript 5.x packages (shared, parser, core, host-node, server, cli), Vitest 4 / Biome 2 tooling, and the Wave 0 boundary/security/fixture-scrub tests plus synthetic JSONL fixtures that every later plan in Phase 1 depends on.

## What Was Built

### Workspace shell

- pnpm 9.15 workspace with `packages/*` glob, Node 22 LTS pinned via `.nvmrc` and `engines.node`.
- Strict TypeScript 5.9.3 base config (`tsconfig.base.json`) — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, ESNext modules with Bundler resolution.
- Six empty package skeletons (`@ahp-inspector/shared|parser|core|host-node|server|cli`), each with its own `tsconfig.json`, `package.json`, and `src/index.ts` stub. `pnpm typecheck` runs `tsc --noEmit` across all six.
- `@ahp-inspector/cli` declares `bin: { "ahp-inspector": "./dist/index.js" }` and depends on `commander`, `@ahp-inspector/host-node`, `@ahp-inspector/server` (workspace links).
- `@ahp-inspector/host-node` depends on `chokidar@^5.0.0` (sole runtime dep needed for Plan 02 file watching).
- Biome 2.4.14 lint+format with per-package `noRestrictedImports` overrides for portable packages.
- Vitest 4.1.5 root config covering `test/**` and `packages/*/{src,test}/**/*.test.ts`.

### Wave 0 test harness

| Test file | Purpose | Mitigates |
|-----------|---------|-----------|
| `test/boundary.test.ts` | Regex-walks `packages/{shared,parser,core}/src` and rejects `node:*`, `fs`, `fs/*`, `path`, `chokidar`, `react`, `react-dom`, `vite`, `hono`, `@ahp-inspector/host-node`. Verified by injecting a forbidden import and confirming failure. | T-01-03 |
| `test/security.test.ts` | Reads every `package.json` in the workspace and asserts every dep/devDep is in the allow-list (see below). | T-01-02 |
| `test/fixture-scrub.test.ts` | Generates fixtures, then scans `test/fixtures/**` for Bearer/sk-/ghp_/JWT/password/api_key patterns. Also asserts on-disk fixtures match generator output (idempotency check). | T-01-01 |

### Synthetic fixtures (`test/fixtures/`)

All built in-memory by `generate.ts`; nothing is copied from `~/agenthost.*.log`.

| File | Contents |
|------|----------|
| `tiny.jsonl` | 8 lines, one per EventKind: c2s request, s2c response (success), c2s notification, s2c action, s2c protocol notification, s2c response (error), c2s request with string id, c2s request with null id. |
| `malformed.jsonl` | 5 lines: valid, truncated JSON, non-JSON, empty, valid. |
| `crlf.jsonl` | `tiny.jsonl` re-joined with `\r\n` and trailing CRLF. |
| `bom.jsonl` | Leading U+FEFF + 3 valid lines (verified `efbbbf` magic). |
| `legacy.sample.log` | Synthesized blocks demonstrating `>>`, `<<`, `**`, `!!` markers from RESEARCH §"Legacy adapter" — placeholder payloads only. |

## Dependency Allow-List (Phase 1)

Plan 03 must extend this when it adds Hono.

```
typescript, @biomejs/biome, vitest, tsup, @types/node,
commander, chokidar,
@ahp-inspector/{shared, parser, core, host-node, server, cli}
```

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | feat(01-01): scaffold pnpm workspace and tooling | `c63a3c4` |
| 2 | test(01-01): add Wave 0 boundary, security, and fixture-scrub tests | `cd0cd0d` |

## Verification

| Command | Result |
|---------|--------|
| `pnpm install` | exit 0; lockfile generated |
| `pnpm typecheck` | exit 0 across all 6 packages |
| `pnpm vitest run` | 18 passed (boundary 4, security 8, fixture-scrub 6) in <100 ms |
| `pnpm lint` | 0 errors (7 warnings in test infra; non-blocking) |
| Boundary smoke (forbidden import injected) | test failed as expected; restored |
| `head -c 3 test/fixtures/bom.jsonl \| xxd` | `efbbbf` (BOM present) |
| `grep -U $'\r' test/fixtures/crlf.jsonl` | CRLF present |
| `wc -l test/fixtures/tiny.jsonl` | 8 |
| `grep -RE 'Bearer \|sk-\|ghp_\|eyJ' test/fixtures/` | empty |

## Acceptance Criteria

All criteria from both tasks satisfied:

- ✅ `pnpm install` exits 0; `pnpm-lock.yaml` committed.
- ✅ `pnpm typecheck` exits 0.
- ✅ Vitest harness boots (Task 1 verified with `--passWithNoTests`; Task 2 with real tests).
- ✅ TypeScript devDep is `^5.6.0`, NOT `^6.x`.
- ✅ ≥6 workspace package self-references found in `packages/*/package.json`.
- ✅ `.gitignore` contains `agenthost.*.log`.
- ✅ `pnpm-workspace.yaml` includes `packages/*`.
- ✅ All three Wave 0 test files report 1+ tests, all green.
- ✅ Five expected fixture files present.
- ✅ `tiny.jsonl` is 8 lines; BOM and CRLF fixtures verified by hex/grep.
- ✅ No tokens in fixtures.
- ✅ Boundary detector catches a deliberate `import 'node:fs'` (smoke-tested then reverted).

## Deviations from Plan

### [Rule 3 — Blocker] Biome 2.x config schema migration

**Found during:** Task 2 (running `pnpm lint` for the verification block).
**Issue:** Plan referenced Biome `files.ignore` and `overrides[].include` (1.x schema). Biome 2.x renamed these to `files.includes` / `overrides[].includes` with `!`-prefix negation; the original config was rejected at startup with `"unknown key"` errors.
**Fix:** Migrated `biome.json` to the 2.x schema and excluded `.github/` and `.planning/` from lint scope (otherwise GSD's own JS tooling triggered hundreds of lint errors unrelated to this repo's source).
**Files modified:** `biome.json`
**Commit:** rolled into `cd0cd0d`.

### [Rule 3 — Blocker] Dropped `tsx` to keep allow-list minimal

**Found during:** Task 2.
**Issue:** Plan suggested running `tsx test/fixtures/generate.ts` to seed fixtures. Adding `tsx` would require listing it in the security allow-list, expanding the trust surface.
**Fix:** `test/fixture-scrub.test.ts` calls `generateAll()` at module-load time; no extra binary needed.
**Files modified:** `package.json` (removed devDep), `test/fixture-scrub.test.ts`.
**Commit:** rolled into `cd0cd0d`.

### [Rule 2 — Critical functionality] `host-node`/`server`/`cli` need `@types/node`

**Found during:** Task 1 typecheck.
**Issue:** Without `"types": ["node"]` in their tsconfigs, the Node-side packages would silently lose `process`, `Buffer`, etc. once Plan 02 starts adding code.
**Fix:** Added `"types": ["node"]` to `packages/{host-node,server,cli}/tsconfig.json`. Portable packages (shared/parser/core) intentionally do NOT include node types.
**Files modified:** three tsconfigs.
**Commit:** rolled into `c63a3c4`.

## Authentication Gates

None.

## Known Stubs

All six `packages/*/src/index.ts` files contain only `export {};`. This is intentional — Phase 1 Plans 02 and 03 fill them with real types and modules. Tracked in PLAN files for those plans.

## Threat Flags

None — no new attack surface beyond what the threat model already enumerates.

## Notes for Plan 03

The dependency allow-list in `test/security.test.ts` must be extended to include `hono` (and any Hono middleware) when Plan 03 lands the local server. The test currently fails fast if any new dep slips in.

## Self-Check: PASSED

- ✅ FOUND: package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.base.json, biome.json, vitest.config.ts, .gitignore, .nvmrc
- ✅ FOUND: packages/{shared,parser,core,host-node,server,cli}/{package.json,tsconfig.json,src/index.ts} (18 files)
- ✅ FOUND: test/fixtures/{generate.ts,tiny.jsonl,malformed.jsonl,crlf.jsonl,bom.jsonl,legacy.sample.log}
- ✅ FOUND: test/{boundary,security,fixture-scrub}.test.ts
- ✅ FOUND commit: c63a3c4 (Task 1)
- ✅ FOUND commit: cd0cd0d (Task 2)
