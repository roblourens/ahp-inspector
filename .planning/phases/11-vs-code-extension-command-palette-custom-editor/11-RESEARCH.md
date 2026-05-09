# Phase 11 Research: VS Code Extension Command Palette Webview

**Date:** 2026-05-08
**Purpose:** Identify implementation constraints needed to plan Phase 11 well.

## User Decisions To Preserve

- Build a command-created VS Code webview, not a `CustomEditorProvider`.
- Use direct webview `postMessage` transport instead of starting the loopback server inside VS Code.
- Open the webview immediately. If the active editor is an AHP JSONL log, preselect that log; otherwise show the existing discovery/open UI.
- Shape the extension as publishable, while keeping final marketplace presentation work outside the critical path.

## Existing Architecture

- The standalone viewer currently runs as `packages/cli/src/index.ts`, which creates a `NodeHostAdapter`, creates a `LogSessionManager`, starts the Hono loopback server, and opens the default browser.
- `packages/server/src/log-server.ts` composes all HTTP routes and static UI serving. The server is valuable for standalone browser mode but is not the desired VS Code runtime.
- `packages/server/src/session-manager.ts` owns the single active log lifecycle and can be reused by an extension-host bridge because it already abstracts `open`, `close`, `current`, `onChange`, and `dispose`.
- `packages/server/src/app-state.ts` exposes `snapshot`, `subscribe`, `eventAt`, `correlatorDataFor`, `searchIndex`, and `stateAtIndex`, which are enough to mirror the existing HTTP/SSE feature surface through messages.
- `packages/host-node/src/host-adapter.ts` and `packages/shared/src/host-protocol.ts` already preserve a host adapter boundary. This is the right seam for local file discovery/open/tail behavior.
- The UI currently imports concrete browser transport functions from `packages/ui/src/transport/*` and assumes `fetch('/api/...')` plus `EventSource('/api/log/stream')`.

## Planning Implications

1. Add a new `packages/extension` workspace package rather than putting VS Code APIs into portable packages.
2. Keep `vscode` imports isolated to `packages/extension`; existing boundary tests should grow to enforce this.
3. Add a small UI transport facade so `App.tsx` and feature components call a runtime-selected client instead of importing `fetch`/`EventSource` helpers directly.
4. Keep browser mode as the default transport for the standalone CLI; extension mode registers a webview transport at bootstrap.
5. Mirror existing server route payloads rather than inventing new UI data shapes. This keeps browser and extension runtimes behaviorally aligned.
6. The extension host bridge should reuse `createLogSessionManager`, `NodeHostAdapter`, and `classifyDirection`, then translate session/app-state events into webview messages.
7. Webview HTML must use local bundled assets, a nonce-bearing CSP, `webview.asWebviewUri`, and restricted `localResourceRoots`.

## Risks and Mitigations

- **Transport drift:** Browser and webview runtimes could diverge if separate client logic grows. Mitigation: shared transport interfaces and contract tests for message shapes.
- **Path leakage:** Extension messages could accidentally expose absolute paths to the webview. Mitigation: keep UI-visible metadata basename/logKey-only and test message payloads.
- **Bundling VS Code APIs into browser code:** Avoid importing `vscode` outside `packages/extension`; add boundary tests.
- **CSP regressions:** Vite emits assets that must be loaded through webview URIs. Generate HTML in extension code and test for a restrictive CSP.
- **Lifecycle leaks:** Webview panels need to dispose session manager subscriptions and active file watchers when closed.

## Recommended Plan Shape

- Wave 1: Extension package/webview shell and UI transport abstraction can proceed independently.
- Wave 2: Direct `postMessage` bridge depends on the package shell and UI transport contracts.
- Wave 3: Packaging, docs, security guards, and end-to-end validation depend on all implementation work.