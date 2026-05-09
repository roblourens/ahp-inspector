---
plan: 13-02
phase: 13-npx-publishing-and-auto-open-latest-log
status: complete
requirements: [NPX-01, NPX-04]
key-files:
  created:
    - packages/cli/scripts/copy-ui-dist.cjs
    - packages/cli/.npmignore
  modified:
    - packages/cli/package.json
    - packages/cli/src/index.ts
    - packages/cli/src/cli-errors.test.ts
    - test/security.test.ts
    - test/phase4-vertical-slice.test.ts
    - .planning/REQUIREMENTS.md
    - pnpm-lock.yaml
---

## What was built

The CLI package is now a publishable, self-contained npm package called
`ahp-inspector` (top-level, unscoped):

- **package.json**: renamed; added MIT license, description, keywords,
  repository/homepage/bugs URLs; `files` allow-list of `dist`, `ui-dist`,
  `README.md`; `prepublishOnly` rebuilds typecheck + UI + CLI; engines
  `node>=22` matches the workspace root.
- **Workspace deps moved to devDependencies**: tsup's `noExternal` already
  inlines all `@ahp-inspector/*` into the bundle, so they MUST NOT appear in
  the published `dependencies` (npm would try to fetch them from the registry
  on user install). The runtime `dependencies` are now just `commander` and
  `open`.
- **Postbuild script** `scripts/copy-ui-dist.cjs` copies `packages/ui/dist`
  into `packages/cli/ui-dist` (no asset-name rename — the CLI serves the UI's
  own HTML which references its own hashed asset filenames).
- **`locateUiDist()`** got a new candidate (`cliPackageDir/ui-dist`) so the
  packaged tarball layout is found at runtime.
- **`.npmignore`** as a belt-and-suspenders complement to `files`.
- **`--no-auto-discover` flag**: opt-out for tests/scripts that need the
  no-active-log launch state (used by phase4-vertical-slice + cli-errors
  Case A tests, both of which would otherwise trip Phase 13's auto-open
  behavior on the synthetic AHP fixtures).

## Smoke test (Task 3 — checkpoint)

1. `pnpm -F @ahp-inspector/ui build && pnpm -F ahp-inspector build` — clean.
2. `pnpm pack` (used `pnpm pack` not `npm pack` so workspace:* protocol is
   rewritten to literal versions; npm pack would fail on workspace:*).
3. Tarball contents (11 files, 852 KB):
   ```
   package/dist/index.d.ts
   package/dist/index.js
   package/package.json
   package/ui-dist/assets/index-*.{js,css,map}
   package/ui-dist/fonts/{inter,jetbrains-mono}/{*.woff2,LICENSE.txt}
   package/ui-dist/index.html
   ```
   No `src/`, no `tsconfig.json`, no `.test.ts`. README.md is in the
   allow-list but not yet present (created by Plan 13-03).
4. `npm i ahp-inspector-0.1.0.tgz` in a clean tmpdir → installed cleanly.
5. `npx ahp-inspector --version` → `0.1.0`.
6. `npx ahp-inspector --no-open --port 0 path/to/log.jsonl` → server starts,
   `Watching <path>` printed, UI HTML served on the bound port. No
   "UI dist not found" warning.

## Deviations from plan

- The plan called for `npm pack` but workspace:* protocol fails under
  `npm pack`. Used `pnpm pack` instead — it rewrites workspace deps to
  literal versions in the published manifest. The `scripts/release.sh` in
  Plan 13-03 will use `pnpm pack` for the same reason.
- Plan said to add `banner: { js: "#!/usr/bin/env node" }` to tsup.config —
  but the source file already has the shebang and tsup preserves it, so the
  banner produced a duplicate shebang that broke `node`'s module loader.
  Removed the banner; relied on the existing source-level shebang.
- Plan also listed workspace deps under `dependencies` with a single
  `devDependency` for `@ahp-inspector/ui` — but as noted above, leaving the
  inlined workspace deps in `dependencies` breaks `npm install` of the
  published tarball. Moved them all to `devDependencies` (which npm ignores
  for transitive packages).
- Added `--no-auto-discover` CLI flag (not in the original plan) so the
  pre-existing phase 4 vertical slice + CLI errors tests stay deterministic
  after Phase 13's auto-open-latest-log behavior shipped.

## Tests

`npx vitest run` — 1091/1091 pass (no regressions). All workspace
typechecks clean.

## Self-Check: PASSED

- Build pipeline produces `dist/index.js` (with shebang) + `ui-dist/index.html`.
- Tarball contents minimal and correct (no src/tests).
- Smoke install in clean tmpdir works end-to-end.
- All workspace tests pass; typecheck clean.
- Auto-discovery flag covers the test cases that conflict with Phase 13
  default behavior.
