# Plan 15-04 SUMMARY — Delete postMessage bridge dead code

## What landed

- **Deleted (5 files):**
  - `packages/extension/src/viewerSession.ts` (351 lines — `ViewerSessionBridge` class)
  - `packages/extension/src/viewerSession.test.ts` (10 cases against the bridge)
  - `packages/extension/src/messageProtocol.ts` (extension-side re-exports of webview message types)
  - `packages/ui/src/transport/webview-client.ts` (postMessage transport implementation)
  - `packages/ui/src/transport/webview-client.test.ts` (7 cases against the webview client)

- **Modified:**
  - `packages/ui/src/main.tsx` — dropped `import { createWebviewAhpViewerClient, isVsCodeWebviewRuntime } from "./transport/webview-client.js";` and the runtime-detection ternary. `main.tsx` now unconditionally constructs `createBrowserAhpViewerClient()`.
  - `test/security.test.ts` — updated the Phase-11-era boundary tests that Phase 15 explicitly reverses:
    1. The "extension runtime does not import startLogServer" test was changed to "does not import the open package (browser launcher)" because Phase 15's CONTEXT explicitly REVERSES Phase 11's EXT-03 (the extension now hosts the same loopback server the standalone CLI uses, talked to via `WebviewOptions.portMapping`). Importing `startLogServer` in extension code is now intended.
    2. The "no CDN URLs in UI source" test was updated with a `LOOPBACK_RE` allow-list so `http://localhost:NNNN` references in test fixtures (added by Plans 15-01/15-02) don't trip a CDN-detection check meant to catch external dependencies.

## Verification

- `pnpm typecheck` — workspace-wide clean (8 packages).
- `pnpm test` — 93 files, **1104 tests passing** (down from 1117 before the deletions: the 17 bridge tests are gone, no other regressions).
- `pnpm -F @ahp-inspector/ui build` — succeeds (UI bundle 342.20 KB, slightly smaller without `webview-client.ts`).
- `pnpm -F @ahp-inspector/extension build` — succeeds (`dist/extension.cjs` 260.09 KB).
- `grep -rn "ViewerSessionBridge\|isVsCodeWebviewRuntime\|createWebviewAhpViewerClient" packages/*/src` — only comment-doc references remain (in `packages/shared/src/webview-message.ts` historical comment and `packages/ui/src/transport/client.ts` API-doc bullet). No imports, no live code.

## Deviations

- **Out-of-scope cleanup deferred (intentional):** `packages/shared/src/webview-message.ts` is now orphaned — nothing imports `WebviewRequest`, `ExtensionNotification`, etc. anymore. Per implementation discipline ("only changes that are directly requested or clearly necessary"), this file is left in place. A follow-up cleanup phase can delete it along with its dead-comment reference in `packages/ui/src/transport/client.ts`.
- **Phase-11 boundary tests were updated**, not deleted. The new assertions still enforce real local-only invariants (no `open` package, no external CDNs); they just no longer codify the EXT-03 decision Phase 15 reverses. This is the right place to do it: Plan 04 is the cleanup plan.

## Self-Check: PASSED

- All Task 1 + Task 2 acceptance criteria met (5 deletions, main.tsx simplified, no production imports of deleted symbols, suite green, builds succeed).
- All plan-level `<verification>` commands pass.
- Repo now has exactly one webview transport story: HTTP+SSE through the loopback server via `WebviewOptions.portMapping` (works in remote dev). Plan 05 will validate end-to-end.
