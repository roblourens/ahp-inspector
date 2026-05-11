# Plan 15-03 SUMMARY — Extension hosts singleton LogServer + portMapping

## What landed

- `packages/extension/src/extensionServer.ts` — new module owning the lifecycle of one `LogServer` per extension activation. Lazy-starts on first `getOrStartLogServer(context)`, dedupes concurrent starts via an in-flight `starting` promise, exposes `closeLogServerIfRunning()` (idempotent), and a test-only `__resetForTest()` reset. Bootstraps `createLogSessionManager({ host: NodeHostAdapter, resolveCandidateId })` exactly the way the standalone CLI does (minus `directionInference`, intentionally omitted for v1 — matches what the bridge did).
- `packages/extension/src/extensionServer.test.ts` — 6 cases: lazy start, sequential reuse, concurrent dedupe, close idempotency, restart after close, version + uiDistDir derived from `ExtensionContext`. All pass.
- `packages/extension/src/extension.ts` — rewritten. No more `ViewerSessionBridge` import. `openViewer` is now `async`:
  1. `await getOrStartLogServer(context)` to ensure the server is up.
  2. Detects active log; if present, `await sessions.open({ path })` BEFORE creating the panel so the webview's first `/api/log/meta` probe lands on a populated session.
  3. Creates the webview panel with `portMapping: [{ webviewPort: server.port, extensionHostPort: server.port }]` (works in remote dev because VS Code rewrites loopback URLs through the SSH tunnel).
  4. `buildPanelHtml` now takes a `port` and passes both `loopbackOrigin` and `apiBaseUrl` (= `http://localhost:${port}`) into `renderWebviewHtml`. The webview HTML carries the right CSP directive AND the inline `window.__AHP_API_BASE__` script the UI's `apiUrl()` helper consumes.
  5. `deactivate` is now `async` and awaits `closeLogServerIfRunning()`.
- `packages/extension/src/extension.test.ts` — replaced bridge-based tests with 8 new cases covering: command registration, portMapping carrying the bound port, CSP + apiBase script in the HTML, sessions.open seeding when a log is active, no seeding when none, server reuse across two openViewer calls, command handler invokes openViewer, deactivate closes the server. All pass.

## Verification

- `pnpm test packages/extension` — 5 files, 32 tests passing (including 14 new across extensionServer + extension).
- `pnpm -F @ahp-inspector/extension typecheck` — clean.
- `pnpm -F @ahp-inspector/extension build` — succeeds; `dist/extension.cjs` produced (260.09 KB).
- `grep -c "ViewerSessionBridge" packages/extension/src/extension.ts` → 0.
- `grep -c "ViewerSessionBridge" packages/extension/dist/extension.cjs` → 0 (tree-shaken out — bridge file remains on disk for Plan 04 to delete).
- `grep -c "getOrStartLogServer\|portMapping" packages/extension/src/extension.ts` → 4.
- `viewerSession.test.ts` (10 tests) still passes — bridge file is dead but its existing test suite still works against the file. Plan 04 will delete both.

## Deviations

- The PLAN's Task 2 verification mentioned "tree-shaking will drop it once nothing imports it." Confirmed in the built bundle: `grep -c "ViewerSessionBridge" dist/extension.cjs` → 0. The source file remains untouched (Plan 04 owns the deletion).
- The `panel.onDidDispose` callback was removed entirely (the previous bridge cleanup was the only thing in it). VS Code does not require an explicit subscription here when nothing needs cleanup — the panel + extension lifecycles are independent.

## Self-Check: PASSED

- All Task 1 + Task 2 acceptance criteria met.
- All plan-level `<verification>` commands pass.
- Bug class CONTEXT.md called out is now resolved at the architecture level: every UI component that imports `transport/*-client.js` hits a real, reachable HTTP server in BOTH standalone and webview contexts (subject to manual UAT in Plan 05).
