# Plan 11-03 — Webview Bridge & Protocol — Summary

## What was built

A bidirectional, requestId-correlated message bridge between the VS Code
extension host and the React UI running inside a webview, plus the
protocol types they share.

- `packages/extension/src/viewerSession.ts` — `ViewerSessionBridge` owns
  one `NodeHostAdapter` + `LogSessionManager` per panel and translates
  webview `WebviewRequest` → `WebviewResponse`. It also subscribes to
  session changes and emits `{kind:"stream", payload:"log-reset"}`
  notifications, so a switching log triggers the same UI reset path the
  SSE transport uses.
- `packages/extension/src/extension.ts` — wires a fresh bridge per panel
  with `panel.webview.postMessage` and disposes on `onDidDispose`.
- `packages/ui/src/transport/webview-client.ts` — implements
  `AhpViewerClient` over `acquireVsCodeApi().postMessage` /
  `window.addEventListener('message', ...)`. RequestId-keyed pending map
  with a 30-second timeout per call.
- `packages/ui/src/main.tsx` — selects the webview client when
  `acquireVsCodeApi` is present, otherwise falls back to the browser
  client.

## Deviation: protocol types live in shared, not extension

The plan listed `packages/extension/src/messageProtocol.ts` as the home
for `WebviewRequest` / `WebviewResponse` / `ExtensionNotification`, but
the next plan (11-04) tightens the boundary tests to forbid the UI
package from depending on `@ahp-inspector/extension`. To satisfy both:

- The canonical types live in
  `packages/shared/src/webview-message.ts` (a `WebviewStatus` alias is
  duplicated locally to avoid `shared → core`).
- `packages/extension/src/messageProtocol.ts` is preserved as a
  re-export shim so the planning artifact still lists exactly where to
  look.

This is the "push the type to the right shape, don't build a workaround"
move from Rob's preferences.

## Tests

- `packages/extension/src/viewerSession.test.ts` — 10 tests covering
  request/response correlation, parse-error responses, stream snapshot
  framing, log-reset on session change, dispose cleanup, search /
  state/at projections.
- `packages/ui/src/transport/webview-client.test.ts` — 7 tests covering
  postMessage shape, response correlation, ok=false → coded `Error`,
  stray-message tolerance, probeLogMeta branches, snapshot frames
  flowing into the store, and request timeout.

`pnpm typecheck` and `pnpm test` are clean (1061 tests).

## Out of scope (next plan)

- Boundary test extensions to forbid `vscode` outside
  `packages/extension` and `@ahp-inspector/extension` inside the UI.
- Build wiring to copy `packages/ui/dist` → `packages/extension/ui-dist`.
- Documentation updates in `USER_GUIDE.md` and `SECURITY.md`.

(Written by Copilot)
