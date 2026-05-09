# Plan 13-03 Summary — Release script + publish workflow + docs

**Plan:** 13-03-PLAN.md
**Status:** complete
**Commits:** `5a9da39` (feat), `96471c7` (fix)

## What shipped

### `scripts/release.sh`

Versioned release flow with `--dry-run` support:

- Optional positional `<version>` (validated semver). When omitted, prompts for confirmation using the version already in `packages/cli/package.json`.
- Pre-flight: clean tree assertion, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, UI build, CLI build.
- `pnpm pack` (not `npm pack` — workspace:* protocol requires pnpm to rewrite to literal versions).
- Smoke installs the tarball into a `mktemp -d` and asserts `npx ahp-inspector --version` matches.
- `--dry-run`: prints `Dry run — would now run: npm publish --access public` and exits 0.
- Real publish: `npm publish --access public` then `git tag v${VERSION}` (push left to operator).
- `trap` cleans the `.tgz` and tmpdir on success or failure.

### `.github/workflows/publish.yml`

`workflow_dispatch`-triggered publish workflow:

- Inputs: `version` (optional bump) + `dry_run` (default `true`).
- Uses `pnpm/action-setup@v4` and `actions/setup-node@v4` with npmjs registry-url and node 22.
- Runs the same pre-flight chain (typecheck, test, UI build, CLI build) then `pnpm pack` + smoke install.
- Real publish path adds `--provenance` (requires `id-token: write`); dry-run just prints a notice.

### Docs

- **`README.md`** — new **Quickstart** section documents `npx ahp-inspector` (auto) and `npx ahp-inspector path/to/log.jsonl`, the auto-discovery rule (newest mtime, non-empty, AHP-shape probe; opens picker on miss), the `--port` / `--no-open` / `--no-auto-discover` flags, and the local-only privacy posture. License section now reflects the MIT-licensed CLI package vs. unlicensed repo.
- **`USER_GUIDE.md`** — npx install path documented as the default first step; the original "from source" instructions are kept for contributors.
- **`packages/cli/README.md`** (NEW) — short npmjs.com-ready landing page. This file is now actually shipped in the tarball (Plan 13-02 listed it in `files` but it didn't exist yet).

### Packaging bug fix (surfaced by the rehearsal — commit `96471c7`)

The Plan 13-02 cli `package.json` had:

```json
"main": "./src/index.ts",
"types": "./src/index.ts",
"exports": { ".": "./src/index.ts" }
```

This forced npm to bundle `src/index.ts` into the published tarball regardless of the `files` allowlist, and would have pointed any `require`/`import` consumer of the package at a TypeScript source file that won't run under bare node. The CLI is `bin`-only — those fields were removed entirely. Re-verified: tarball is the intended 12-file shape (`dist/index.{js,d.ts}` + `ui-dist/{index.html,assets/*,fonts/*}` + `package.json` + `README.md`). All 1091 tests still pass, typecheck still clean.

## Verification

`scripts/release.sh --dry-run 0.1.0` end-to-end:

- ✅ Working tree clean
- ✅ `pnpm install --frozen-lockfile` ok
- ✅ `pnpm typecheck` ok
- ✅ `pnpm test` → 91 files / 1091 tests passed
- ✅ UI build + CLI build produced expected artifacts
- ✅ `pnpm pack` produced `ahp-inspector-0.1.0.tgz` (12 files)
- ✅ Smoke install in tmpdir + `npx ahp-inspector --version` → `0.1.0`
- ✅ Final stdout: `Dry run — would now run: npm publish --access public`
- ✅ Exit 0; trap cleaned tarball + tmpdir; clean `git status` after

## Deviations from plan

1. **Plan said `npm pack`; used `pnpm pack`.** Same reason as Plan 13-02 lessons: `npm pack` errors on `workspace:*` protocol; `pnpm pack` rewrites to literal versions. The plan text recommended `npm pack`; this was overridden by the 13-02 lesson. Workflow inherits the same change.

## Requirements coverage

- **NPX-05** — release automation (script + GitHub Actions workflow): covered.
- **NPX-06** — npx documentation in README + USER_GUIDE + npmjs landing page: covered.

(Written by Copilot)
