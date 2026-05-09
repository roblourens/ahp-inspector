# Phase 13 Context — npx publishing and auto-open latest log

**Goal:** Ship the standalone AHP Inspector as a published npm package so a single `npx` invocation downloads the package, starts the loopback HTTP server, opens the browser, and immediately streams the most-recently-modified AHP JSONL log under the standard VS Code log roots.

## Why now

Phase 11 added a VS Code extension entry point. The standalone CLI still requires cloning the repo (`pnpm exec tsx packages/cli/src/index.ts ...`). For users who just want to peek at their latest AHP log we need the lowest-friction path: `npx <package>`. Publishing also pressure-tests the bundled output (UI dist + protocol/server/host-node) we already produce for the extension's `ui-dist/` flow.

## Scope

- Auto-discovery: when invoked with no path, pick the most-recently-modified candidate from `discoverVsCodeLogs()` and open it as the active log. If no candidate is found, fall back to today's "no active log" picker.
- Packaging: choose a public scope/name (suggest `@ahp-inspector/cli` if scope is acquired, otherwise `ahp-inspector-cli`), define `bin`, ship prebuilt `packages/cli/dist` and `packages/ui/dist`, and bundle workspace deps so the published tarball is self-contained.
- Release: a release script (or GH Actions workflow) bumps version, builds, runs typecheck/test, and publishes — with a documented dry-run / `npm pack` flow for safety.
- Docs: README + USER_GUIDE call out the `npx` command, the auto-open rule, and the local-only privacy posture.

## Out of scope (for this phase)

- Changing how the extension ships (Phase 11 already handles that).
- Adding new features to the viewer itself.
- Cross-platform installer flavors (homebrew, scoop, etc.).
- Telemetry or update-check behavior.

## Dependencies

- Phase 4 — existing `discoverVsCodeLogs()` API in `@ahp-inspector/host-node`.
- Phase 11 — UI build + bundled assets pattern already exercised by `packages/extension/scripts/copy-ui-dist.cjs`.

## Open questions for `/gsd-plan-phase 13`

- Final published package name + scope (need npm availability check).
- Whether to publish a single binary package or separate `@ahp-inspector/cli` + `@ahp-inspector/ui` packages.
- CI publish trigger: tag push vs manual workflow dispatch.
- Whether `npx` should default to `--no-open` in headless environments (CI), and how to detect headless.

## Success criteria

- `npx <published-name>` (no args) opens the browser to the most-recent AHP JSONL log under VS Code log roots, streaming live, on a fresh machine with no clone.
- `npx <published-name> path/to/file.jsonl` matches today's CLI behavior.
- The published tarball is self-contained (verified via `npm pack` install in a temp dir).
- Release process is documented and reproducible.
- Local-only posture remains: loopback bind, no telemetry, no outbound calls.
