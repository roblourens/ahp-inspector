# Phase 13 Context — npx publishing and auto-open latest log

**Goal:** Ship the standalone AHP Inspector as a published npm package so a single `npx ahp-inspector` invocation downloads the package, starts the loopback HTTP server, opens the browser, and immediately streams the most-recently-modified AHP JSONL log under the standard VS Code log roots.

## Why now

Phase 11 added a VS Code extension entry point. The standalone CLI still requires cloning the repo (`pnpm exec tsx packages/cli/src/index.ts ...`). For users who just want to peek at their latest AHP log we need the lowest-friction path: `npx ahp-inspector`. Publishing also pressure-tests the bundled output (UI dist + protocol/server/host-node) we already produce for the extension's `ui-dist/` flow.

## Locked decisions (from /gsd-discuss-phase 13)

### 1. Package shape — single bundled binary
One published package, `ahp-inspector` (unscoped), with a `bin` entry that boots the existing CLI/server flow. The published tarball ships prebuilt `packages/cli/dist` and `packages/ui/dist` together. Workspace deps (`@ahp-inspector/{core,host-node,parser,protocol,server,shared}`) are inlined into the CLI bundle so the tarball has zero workspace runtime dependencies.

Rationale: lowest friction (`npx ahp-inspector` vs. `npx @scope/cli`), one version to track, one publish step.

### 2. Package name — `ahp-inspector` (unscoped)
Matches the renamed workspace (commit `6dd93f5`). No scope; keeps the `npx` invocation short.

### 3. Auto-discovery selection rule — newest mtime, non-empty, AHP-shape verified
When `npx ahp-inspector` is invoked with no path argument:

1. Run `discoverVsCodeLogs()` to enumerate candidates across all VS Code log roots.
2. Filter out files with size 0 (just-created, no events yet).
3. For each remaining candidate (newest mtime first), probe the first non-empty line and verify it parses as an AHP JSONL event (existing parser shape check; cheap and bounded).
4. The first candidate that passes is the active log; open the browser pointing at that log streaming live.
5. If no candidate passes, open the UI in **empty state** with the discovery list visible so the user can pick manually — do NOT exit with an error. Print a friendly stderr note like `No AHP logs found under VS Code log roots; opened picker UI.`

Rationale: robust against the common cases (empty placeholder files, unrelated `.jsonl` files in log dirs) without surprising the user. Keeping the UI open on miss matches the "low-friction inspection tool" framing.

## Scope

- **Auto-discovery**: implement the selection rule above as a small, testable function in `@ahp-inspector/host-node` (or `@ahp-inspector/cli`), reusing existing `discoverVsCodeLogs()` and the parser's first-line shape probe.
- **Packaging**: configure `package.json` for `ahp-inspector` with `bin`, `files`, prepublish build hook, and inline-bundle workspace deps via tsup/esbuild. Verify with `npm pack` + install-into-temp-dir smoke test.
- **Release**: scripted release flow (version bump → typecheck → test → build → `npm pack` smoke → `npm publish`). Decide tag-push vs manual workflow dispatch during planning.
- **Docs**: README + USER_GUIDE call out the `npx ahp-inspector` command, the auto-open rule, headless behavior, and the local-only privacy posture.

## Out of scope (for this phase)

- Changing how the VS Code extension ships (Phase 11 already handles that).
- Adding new viewer features.
- Cross-platform installer flavors (homebrew, scoop, etc.).
- Telemetry or update-check behavior.
- Renaming anything (already done in commit `6dd93f5`).

## Dependencies

- **Project rename** — DONE (commit `6dd93f5`). All package names, command ids, display strings now use `ahp-inspector` / `ahpInspector` / `AHP Inspector`.
- **Phase 4** — existing `discoverVsCodeLogs()` API in `@ahp-inspector/host-node`.
- **Phase 11** — UI build + bundled assets pattern already exercised by `packages/extension/scripts/copy-ui-dist.cjs`; the CLI publish flow can reuse the same approach.

## Open questions for `/gsd-plan-phase 13`

- npm-name availability check for `ahp-inspector` (assume available; verify before first publish).
- Headless detection: should `npx ahp-inspector` skip the browser-open step in CI / non-TTY environments? Default behavior + `--no-open` flag.
- CI publish trigger: tag push vs manual `workflow_dispatch`.
- Bundling strategy for native deps (if any sneak in via `chokidar` etc. on `host-node`).

## Success criteria

- `npx ahp-inspector` (no args) opens the browser to the most-recent non-empty AHP JSONL log under VS Code log roots, streaming live, on a fresh machine with no clone.
- If no AHP-shape log is found, the UI opens in empty state with the discovery picker; no crash, no error exit.
- `npx ahp-inspector path/to/file.jsonl` matches today's CLI behavior.
- The published tarball is self-contained (verified via `npm pack` + install in a temp dir, then run).
- Release process is documented and reproducible (dry-run + actual publish).
- Local-only posture remains: loopback bind, no telemetry, no outbound calls.
