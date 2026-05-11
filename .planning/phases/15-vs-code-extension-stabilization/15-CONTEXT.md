---
phase: 15
phase_name: vs-code-extension-stabilization
milestone: v1.2
created: 2026-05-10
revised: 2026-05-10
mode: discuss
---

# Phase 15 — VS Code Extension Stabilization (REVISED)

## Pivot Note

This CONTEXT was rewritten on 2026-05-10. The original direction (route 5 components through `useAhpViewerClient()` + boundary test) is preserved under `_superseded/`. The user chose a deeper architectural fix: the extension now hosts the same `LogServer` (Hono) the standalone CLI ships, and the webview talks to it over loopback HTTP/SSE via VS Code's `WebviewOptions.portMapping`. This **reverses Phase 11's EXT-03 decision** ("the extension does NOT spawn the loopback HTTP server") in exchange for one transport path everywhere.

Read [`15-RESEARCH.md`](./15-RESEARCH.md) before planning — it has the architecture diff, CSP shift, lifecycle, and pitfalls.

## Domain

Stabilize the VS Code extension by replacing the postMessage bridge with a loopback HTTP/SSE server hosted in the extension host. The webview uses the SAME browser HTTP/SSE transport the standalone `npx ahp-inspector` viewer uses. There is one transport path, period.

In scope:

- Lazy-start a singleton `LogServer` on first `ahpInspector.open` invocation; close it on `deactivate`.
- Mount the bundled `ui-dist` and the `/api/*` routes on the loopback server (same call shape the CLI uses).
- Wire the panel's `WebviewOptions.portMapping` to the bound port.
- Update `webviewHtml.ts` CSP to allow `connect-src http://localhost:{port}` (and matching CORS middleware on the server allowing the webview origin).
- Replace `ViewerSessionBridge`-based panel wiring in `extension.ts` with: `await sessions.open({ path })` directly against the server's session manager, then create the panel.
- Delete now-dead code: `packages/extension/src/viewerSession.ts`, `packages/extension/src/messageProtocol.ts` (or trim to only what extension ↔ webview still needs for non-transport messages — likely nothing for v1), `packages/ui/src/transport/webview-client.ts`, the runtime selection in `packages/ui/src/main.tsx` that picks browser vs webview client (always pick browser), the `<AhpViewerClientProvider>` machinery if no longer needed.
- All five components flagged in the original CONTEXT (`DetailPanel`, `StateInspectorPanel`, `useSearch`, `AppShell`, `TimelineRegion`) automatically work because their existing imports of `transport/(http|sse|search|state|sessions)-client.js` now resolve against a real, reachable HTTP server in the webview context.
- Verify end-to-end in a Code OSS / VS Code Insiders dev session: row click, search, state inspector, log switch, reconnect — and a remote-dev sanity check (Codespaces or `code --remote ssh`).

Out of scope (deferred):

- One-server-per-panel isolation. Singleton server, shared session — matches standalone CLI behavior.
- Cancellation parity is not a separate concern in this design: the browser HTTP client already honors `AbortSignal` natively.
- Phase 11's 7 manual UAT scenarios still parked from v1.1 deferred items.
- Webview runtime detection robustness (`isVsCodeWebviewRuntime` becomes obsolete; remove its callsites).
- Folding the standalone `*-client.js` modules into a single `AhpViewerClient` interface. The interface itself probably becomes dead code after this phase since there's only one implementation; either delete it or leave it as documentation. Defer the cleanup decision to a follow-up.
- Any UI-side refactor beyond removing the dead webview-client/provider code.

## Reversed from Phase 11

This phase **explicitly reverses** the following Phase 11 carry-forward decisions:

- ❌ **EXT-03 (no loopback server in extension)** — REVERSED. Extension now starts the loopback server.
- ❌ **Direct postMessage bridge** — REMOVED. `ViewerSessionBridge` is deleted.
- ✅ **CSP `default-src 'none'`, per-load nonce on the single bundled script** — KEPT, but `connect-src` widens to include `http://localhost:{port}`.
- ✅ **Trust posture: webview only sees basenames + opaque `logKey`s, never absolute `fsPath`** — KEPT (the server response shapes already enforce this; see `session-routes.ts` line 53).
- ✅ **Standalone parity (EXT-06)** — KEPT and STRENGTHENED. The webview now uses the exact same code path as the standalone viewer.
- ❌ **Webview runtime detection (`isVsCodeWebviewRuntime`)** — OBSOLETE. There is one runtime now.

## Decisions

### Server lifecycle: singleton, lazy, extension-scoped

- One `LogServerHandle` per extension activation, stored in a module-level (or `ExtensionContext`-attached) reference.
- Lazy-start on first `openViewer()`; subsequent panels reuse it.
- `deactivate()` `await`s `server.close()`.
- Bind `port: 0` (ephemeral). Use the resolved port for both `webviewPort` and `extensionHostPort` in `portMapping`.
- Acknowledged behavior change: opening a second `AHP Inspector: Open` panel shares the active log session (same as standalone). Documented, not a bug.

### Server bootstrap: server-first

- `await startLogServer({ sessions, port: 0, version, uiDistDir })` BEFORE creating the webview panel.
- This is the only sequence that lets us know the bound port at panel-creation time, which is required because `portMapping` and the CSP `connect-src` URL must both reference the port.

### CSP: add loopback origin to connect-src

- `connect-src ${cspSource} http://localhost:{port}` — minimal addition.
- All other CSP directives unchanged (`default-src 'none'`, `script-src 'nonce-...'`, etc.).

### CORS: permissive but loopback-only

- Add a small CORS middleware to the server (or extend `cspMiddleware`) that responds with `Access-Control-Allow-Origin: *` (or echoes the requesting origin) for requests passing the existing `hostGuardMiddleware`.
- Justification: `hostGuardMiddleware` already constrains access to loopback `Host:` headers, and the bind is `127.0.0.1`-only. CORS is the only remaining browser-side gate, and the webview's `vscode-webview://...` origin is the only realistic caller.
- Verify during execution that the existing `cspMiddleware` does not already set restrictive CORS headers; adjust if so.

### Initial-log injection

- Replace `bridge.notifyInitialLog(path) + bridge.openInitialLogPath(path)` with a direct call into the server's session manager: `await server.sessions.open({ path })` (or whatever accessor `LogServerHandle` exposes; if it doesn't expose `sessions`, expand the handle return shape OR keep a reference to the `sessions` instance the extension passed in).
- The webview's existing browser bootstrap then calls `/api/log/meta` and discovers the active log naturally — no message envelope required.

### UI runtime selection: collapse to one path

- `packages/ui/src/main.tsx` no longer needs to choose between browser/webview clients. Always create the browser HTTP/SSE client.
- The `<AhpViewerClientProvider>` machinery is KEPT (Option B). Reason: `App.tsx` calls `useAhpViewerClient()` directly today, and removing it would force a refactor of App.tsx and App.test.tsx that's not in this phase's scope. The provider is unconditionally fed `createBrowserAhpViewerClient()`. The webview-client-vs-browser-client switch is what gets deleted.

### Verification approach

- Standard automated tests: per-package `pnpm test` + `pnpm typecheck` + `pnpm exec biome check` clean.
- New extension-host integration test asserting `startLogServer` is called once, the panel options carry a `portMapping` whose `webviewPort === extensionHostPort === server.port`, and the webview HTML's CSP includes `http://localhost:{port}` in `connect-src`.
- Deletion verification: `grep -r "ViewerSessionBridge\|webview-client" packages/` finds nothing in non-`_superseded` paths.
- Manual extension verification (covers the bug class CONTEXT.md called out): row click, search, state inspector, log switch, reconnect — exactly the scenarios the original 15-07 plan listed. PLUS a remote-dev sanity check (Codespaces / SSH-remote).

## Deferred Ideas

- **Per-panel isolation** — currently shared session across panels. Add only if a real workflow needs it.
- **Folding `*-client.ts` modules into `AhpViewerClient`** — this interface was the bridge's seam; with one implementation it can be flattened or deleted. Defer to follow-up.
- **Phase 11 deferred manual UAT (7 scenarios)** — left parked.
- **Reveal-in-Editor and other VS Code-native UX** — would re-introduce `postMessage` for those NARROW commands only (extension ↔ webview chrome), not for transport. Out of scope.
- **Authentication / multi-machine remote** — the loopback bind + portMapping + CSP combo handles single-user remote scenarios. Anything else is out of scope.

## Canonical Refs

Downstream agents (planner, executor) MUST read these:

- [`15-RESEARCH.md`](./15-RESEARCH.md) — full architecture diff, CSP/CORS analysis, pitfalls, validation strategy.
- `packages/server/src/log-server.ts` — `startLogServer` factory; the API the extension will call.
- `packages/server/src/host-guard.ts` — DNS-rebinding guard (existing).
- `packages/server/src/csp.ts` — CSP middleware (extend or sit alongside CORS middleware).
- `packages/server/src/session-routes.ts` — confirms path-scrubbing already lives in routes (see line 53 comment).
- `packages/cli/src/index.ts` — reference implementation: how the standalone CLI bootstraps the server (`locateUiDist`, `startLogServer({ port: 0, ... })`).
- `packages/extension/src/extension.ts` — current panel creation flow; entry point for the rewrite.
- `packages/extension/src/webviewHtml.ts` — CSP + nonce generation; needs `connect-src` widening.
- `packages/extension/src/viewerSession.ts` — bridge to be DELETED (preserve in git history).
- `packages/extension/src/messageProtocol.ts` — protocol types to be DELETED or trimmed to non-transport uses (likely none for v1).
- `packages/extension/package.json` — already declares `@ahp-inspector/server` as a runtime dependency; tsup `noExternal` already bundles it.
- `packages/ui/src/main.tsx` — runtime selection between browser/webview clients to be COLLAPSED.
- `packages/ui/src/transport/webview-client.ts` — to be DELETED.
- `packages/ui/src/transport/transport-context.tsx` and `client.ts` — review for deletion under Decision "UI runtime selection".
- `.planning/milestones/v1.1-REQUIREMENTS.md` — EXT-01..EXT-07 contract; EXT-03 is being explicitly reversed.
- `.planning/milestones/v1.1-ROADMAP.md` (lines 138–152) — Phase 11 plan summaries (historical context for what's being undone).

## Code Context

### Today's bridge surface (to be deleted)

| File | Role | After |
|------|------|-------|
| `packages/extension/src/viewerSession.ts` | `ViewerSessionBridge` class — owns one `LogSessionManager`, translates `WebviewRequest` ↔ `ExtensionNotification` | DELETE |
| `packages/extension/src/messageProtocol.ts` | Request/notification type unions for the bridge | DELETE (or trim to nothing) |
| `packages/ui/src/transport/webview-client.ts` | `createWebviewAhpViewerClient` — postMessage implementation of the transport | DELETE |
| `packages/ui/src/transport/transport-context.tsx` | `<AhpViewerClientProvider>` + `useAhpViewerClient()` | KEEP (Option B — App.tsx still uses the hook) |
| `packages/ui/src/transport/client.ts` | The `AhpViewerClient` interface | KEEP (still the contract for the browser client) |
| `packages/ui/src/main.tsx` | Runtime switch between browser/webview clients | Simplify to always-browser bootstrap |

### Today's bypass components (now non-issues)

These five files (the original CONTEXT's main concern) need ZERO changes if Option A is chosen — they call `transport/*-client.js` functions, which now hit a real server:

- `packages/ui/src/components/detail/DetailPanel.tsx`
- `packages/ui/src/components/detail/StateInspectorPanel.tsx`
- `packages/ui/src/components/filters/useSearch.ts`
- `packages/ui/src/components/shell/AppShell.tsx`
- `packages/ui/src/components/timeline/TimelineRegion.tsx`

Their tests do NOT need migration off `vi.mock("../../transport/*")` either — that pattern remains valid because the tests mock at the transport-module boundary, which is still where the seam lives.

### New extension surface (to be added)

- `packages/extension/src/extensionServer.ts` (new) — owns the singleton `LogServerHandle`, exposes `getOrStart(context): Promise<LogServerHandle>` and `closeIfRunning()`.
- `packages/extension/src/extension.ts` (rewrite) — `activate` registers command + `deactivate` hook; `openViewer` awaits the server, creates the panel with `portMapping`, opens the initial log via the server's session manager.
- `packages/extension/src/webviewHtml.ts` (extend) — accept `loopbackOrigin: string` and inject it into `connect-src`.
- `packages/server/src/log-server.ts` (extend) — expose the `LogSessionManager` on the returned handle so the extension can call `sessions.open({ path })` directly. (Today the caller passes `sessions` IN; the extension can just keep its own reference, no server change required. Verify during planning.)
- `packages/server/src/cors.ts` (new, ~10 lines) — minimal CORS middleware allowing webview origin.

## Next Steps

`/clear` then:

`/gsd-plan-phase 15`

The planner will produce ~3-4 plans (server bootstrap + extension rewrite, dead-code deletion, manual UAT). Far smaller surface than the original 7-plan refactor because nothing in the UI components needs touching.
