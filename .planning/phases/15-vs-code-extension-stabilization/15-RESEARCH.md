# Phase 15 Research — Server-in-Extension Approach

**Date:** 2026-05-10
**Status:** Synthesized; planner-ready
**Pivot:** This research replaces the original "route components through `AhpViewerClient`" plan set (now under `_superseded/`). The user chose to pursue architectural consistency: the extension hosts the same `LogServer` as the standalone CLI, the webview talks HTTP/SSE to it via VS Code's `portMapping` API.

## Question

> "What do we need to know to plan an extension that runs the existing `LogServer` on a loopback port and serves the webview through it, instead of using the postMessage bridge?"

## Summary recommendation

**Feasible. Lower long-term complexity than the bridge.** All the heavy lifting already exists:

- `@ahp-inspector/server` is a clean `startLogServer({ sessions, port: 0, version, uiDistDir })` factory that returns `{ url, port, close() }`. It binds to `127.0.0.1` only, has DNS-rebinding protection (`hostGuardMiddleware`), CSP middleware, and serves the same UI bundle via `registerStaticUi`.
- The extension already declares `@ahp-inspector/server` as a runtime dependency and bundles it (`tsup` `noExternal: [/^@ahp-inspector\//]`), so no new dependency surface.
- VS Code's `WebviewOptions.portMapping` is the canonical mechanism for "give the webview HTTP access to a port owned by the extension host." It works in remote/SSH/Codespaces because VS Code tunnels the connection back to the host machine — the webview always thinks it's hitting `localhost`.
- Path scrubbing already happens in the server layer (`session-routes.ts` line 53 comment: `T-04-03-02: never include the original path in the response body`). The current bridge re-implements this; the server route already does it correctly.

The main delta vs today: a port lifecycle + CSP `connect-src` widening to `http://localhost:{webviewPort}`.

## Architecture diff

### Today (Phase 11 bridge)
```
┌──────────────┐   postMessage    ┌────────────────────┐   in-process    ┌──────────────────┐
│   Webview    │ ◄──────────────► │ ViewerSessionBridge│ ◄─────────────► │ LogSessionManager│
│ (UI bundle)  │   onDidReceive   │  (re-implements    │                 │  + AppState      │
│              │                  │   sessions/log/    │                 │                  │
│  webview-    │                  │   detail/state/    │                 │                  │
│  client.ts   │                  │   search/stream)   │                 │                  │
└──────────────┘                  └────────────────────┘                 └──────────────────┘
                                  Plus: 5 components in packages/ui/src/components/**
                                  STILL bypass the bridge by importing transport/*-client.js
                                  directly → 403 in webview (the bug).
```

### Proposed (server-in-extension)
```
┌──────────────┐   HTTP / SSE     ┌────────────────────┐   in-process    ┌──────────────────┐
│   Webview    │ ◄──────────────► │   LogServer (Hono) │ ◄─────────────► │ LogSessionManager│
│ (UI bundle)  │  http://localhost│   on ephemeral     │                 │  + AppState      │
│              │   :{port}/api/.. │   loopback port    │                 │                  │
│  browser-    │                  │ (registered as     │                 │                  │
│  client.ts   │                  │  webview port-     │                 │                  │
│  (the SAME   │                  │  mapping)          │                 │                  │
│ standalone   │                  │                    │                 │                  │
│   uses)      │                  │                    │                 │                  │
└──────────────┘                  └────────────────────┘                 └──────────────────┘
                                  Standalone CLI path is byte-identical.
                                  All UI components use ONE transport with no bypass class.
```

## Key facts

### VS Code `portMapping`

- `WebviewOptions.portMapping?: WebviewPortMapping[]`, where each entry is `{ webviewPort: number; extensionHostPort: number }`.
- The webview makes requests to `http://localhost:{webviewPort}/...`; VS Code rewrites them to `extensionHostPort` on the extension-host machine.
- **Remote-safe:** in SSH/Codespaces/web, VS Code tunnels through; the user's browser never directly opens a localhost socket on the host. This is the canonical pattern (Vite dev servers, language server proxies, doc servers).
- Mappings are static at panel-creation time. If the server picks an ephemeral port (binds `0`), we register the mapping AFTER `startLogServer` resolves with the assigned port.
- The `webviewPort` and `extensionHostPort` can be the same number — we pick the actual bound port from `startLogServer({ port: 0 })` and use it for both.
- `WebviewOptions` is set when the panel is created; if the server isn't up yet, the panel HTML can be a tiny "starting…" splash that gets replaced once the server is ready, OR (simpler) we start the server BEFORE creating the panel.

### Existing server invariants we get for free

From [`packages/server/src/log-server.ts`](packages/server/src/log-server.ts#L23) and [`host-guard.ts`](packages/server/src/host-guard.ts):

- `HOSTNAME = "127.0.0.1"` is hard-coded; tests forbid env/argv overrides (Phase 2 regression guard).
- `hostGuardMiddleware` rejects any `Host:` header that isn't `127.0.0.1` or `localhost` (with optional port) → 421. Mitigates DNS rebinding.
- `cspMiddleware` adds CSP, X-Content-Type-Options, Referrer-Policy headers to every response.
- `port: 0` → ephemeral port assigned by the OS, returned in the resolved handle.
- `LogSessionManager` + `AppState` are the same instances used by the bridge today, so all reducer/replay/state-at-index work continues unchanged.

### CSP shift required

Current webview CSP (from [`packages/extension/src/webviewHtml.ts`](packages/extension/src/webviewHtml.ts#L65)):
```
default-src 'none';
img-src ${cspSource} data:;
font-src ${cspSource};
style-src ${cspSource} 'unsafe-inline';
script-src 'nonce-${nonce}';
connect-src ${cspSource}
```

Required change: `connect-src` must allow the loopback URL the webview will hit.

```
connect-src ${cspSource} http://localhost:{port} ws://localhost:{port}
```

(`ws://` only if SSE-over-WebSocket is involved — current server uses native EventSource over HTTP, so plain `http://localhost:{port}` should suffice; verify against `sse-routes.ts` during execution.)

The CSP is rendered at panel-creation time, so the port must be known then. Two patterns:

1. **Server-first** (recommended): `await startLogServer({ port: 0 })` → get `{ port }` → create panel with `portMapping: [{ webviewPort: port, extensionHostPort: port }]` and CSP that includes `http://localhost:{port}`. Single code path, no HTML reload.
2. **Splash-then-rewrite**: create panel immediately with a "loading" page, start server, then `panel.webview.html = renderWebviewHtml(...)` once port is known. More code, no real benefit.

Use server-first.

### Trust posture

The `localhost` widening sounds scary but is constrained:

- `hostGuardMiddleware` already rejects requests that arrive with a non-loopback `Host:` header, defending against DNS rebinding from a malicious page.
- The port is **ephemeral** — chosen at activation, not predictable to other processes on the machine. Combined with VS Code's `portMapping`, the actual extensionHostPort is not directly exposed to anything except the webview iframe (the webview's "localhost" is virtualized in remote scenarios; in local desktop scenarios it's a real loopback bind on `127.0.0.1` only).
- All response bodies already scrub paths (`session-routes.ts` line 53 comment). LogMeta returns `basename` + `logKey`, never absolute `fsPath`.
- The CLI-shipped server has been the standalone product since v1.0; this is a thoroughly-exercised attack surface.

What we lose vs the bridge: the bridge's per-request `requestId` filtering (the bridge ignores unknown `kind`s; HTTP routes 404 unknown URLs — equivalent). The bridge's path-length clamp at 4096 bytes is server-side already enforced in `session-manager`.

What we GAIN: the bypass class (5 components importing `transport/*-client.js`) becomes a non-bug — they all hit the loopback server now, identically to the standalone case. **The bug is resolved by deletion, not refactor.**

### Lifecycle

| Event | Today (bridge) | Proposed (server) |
|-------|----------------|-------------------|
| `activate` | nothing | nothing extra (keep light) |
| First `ahpInspector.open` | Create panel + bridge per panel | Lazy-start the singleton server (await), then create panel with portMapping |
| Second `ahpInspector.open` | New panel + new bridge | Reuse the running server; new panel with same portMapping |
| Panel disposed | Bridge.dispose() | Decrement panel refcount; if 0, OPTION A: keep server running until deactivate (simple); OPTION B: shut down server (saves a port). Recommend A for v1. |
| `deactivate` | nothing | `await server.close()` |

**Sessions:** today each bridge instance owns its own `LogSessionManager` (one log open at a time per panel). The server has the same constraint — it has ONE active session at a time. Two panels currently can each own their own log; with one shared server, two panels would share the active session. **This is a behavior change that must be acknowledged.** Options:
1. Accept the constraint: opening a second panel re-uses the existing session (most users only ever open one panel — the standalone CLI has worked this way forever).
2. One server per panel: more port consumption, full per-panel isolation. Adds a small lifecycle complication. Recommend deferring unless we have a real use case.

Recommendation: **one server per extension activation (singleton)**. Document that opening multiple panels shares the active log; matches standalone behavior.

### Webview-runtime detection becomes simpler

Currently `packages/ui/src/main.tsx` selects between `createBrowserAhpViewerClient()` and `createWebviewAhpViewerClient()` based on `acquireVsCodeApi` presence. After the pivot:

- The webview client + `webview-client.ts` + `transport-context.tsx` provider machinery + `ViewerSessionBridge` + `messageProtocol.ts` all become dead code.
- `main.tsx` constructs the browser HTTP/SSE client unconditionally. The standalone case and the webview case use the SAME bootstrap.
- The `acquireVsCodeApi` shim is no longer needed for transport. (May still be useful if/when we add VS Code-specific UX like "Reveal in Editor" that posts back to the host — those would be the only `postMessage` users, narrow and additive.)

### What must change in the extension

1. **`extension.ts`** — own a singleton `LogServerHandle`, lazy-start on first `openViewer` call, close on `deactivate`.
2. **Panel creation** — set `WebviewPanelOptions.portMapping: [{ webviewPort, extensionHostPort }]` to the bound port.
3. **`webviewHtml.ts`** — add `http://localhost:{port}` to `connect-src`. Renderer needs to accept an optional `loopbackOrigin` parameter.
4. **Initial-log injection** — currently the extension calls `bridge.notifyInitialLog(path)` and `bridge.openInitialLogPath(path)` after panel creation. Equivalent in server mode: call `await sessions.open({ path })` directly on the server's `sessions` (the `LogSessionManager` reference returned alongside the server, OR exposed via the server handle). After that, the webview's existing browser bootstrap probes `/api/log/meta` and gets a hit.
5. **Delete bridge code** — `viewerSession.ts`, `messageProtocol.ts` (or trim), `webview-client.ts` in the UI, the provider switching logic in `main.tsx`. The boundary is now "anything that imports `transport/*-client.js` at runtime is fine — it works in both contexts."

### What must change in the UI

Almost nothing. The browser HTTP/SSE clients already exist and are exercised by the standalone build. The 5 bypass components in CONTEXT.md become a non-issue — they're already calling the right API; we're just making the API actually reachable from the webview.

Possible-to-want additions:
- Configurable base URL: today `http-client.ts` likely uses relative URLs (`/api/...`) which resolve against the page origin (`http://localhost:{port}` in webview). That's exactly what we want — verify, no change needed.
- Drop the entire `packages/ui/src/transport/webview-client.ts` and the provider — but only after verifying main.tsx no longer needs the conditional.

## Standard stack (existing — unchanged)

- HTTP: `Hono` + `@hono/node-server` (server)
- Browser fetch: native `fetch` + `EventSource` (UI)
- Extension API: `vscode.window.createWebviewPanel`, `WebviewPanelOptions.portMapping`
- Bundling: `tsup` (extension), `vite` (UI)

## Common pitfalls

1. **CSP must include the loopback port literally.** `connect-src 'self'` does NOT cover `http://localhost:1234` from a webview origin (`vscode-webview://...`). Test the CSP by opening webview devtools — the network panel will show blocked requests if the CSP is wrong.
2. **`portMapping` is set on panel creation.** If you change the bound port across activations, each panel uses the port that was current at its creation. Using a singleton server avoids this drift.
3. **`port: 0` resolves AFTER the listen callback.** Cannot set CSP / portMapping until the promise resolves. Server-first lifecycle (await before panel) is the simplest path.
4. **Static UI mount path.** The standalone CLI passes `uiDistDir` to `startLogServer`; the extension must do the same, pointing at `path.join(context.extensionUri.fsPath, "ui-dist")`. Otherwise the UI loads via `webview.asWebviewUri` (the current path) and only the API is on `localhost:{port}` — fine, but mixing origins for HTML vs API is a CSP headache. Cleaner: serve UI AND API from the loopback server; webview HTML becomes a tiny redirect to `http://localhost:{port}/`.
   - Actually verify: VS Code may not let `<iframe src="http://localhost:{port}">` work without additional CSP frame-src directives. The simpler shape may be: keep webview HTML serving the bundled assets via `webview.asWebviewUri` (no change), and only the API/SSE goes to `localhost:{port}`. This is the **cross-origin model** — webview origin is `vscode-webview://...`, API origin is `http://localhost:{port}`. CORS must allow the webview origin.
   - **Pitfall:** the existing server has no CORS middleware. We'd need to add one that allows the webview's origin (which is dynamic per VS Code session). Alternative: serve UI from the loopback server and use a meta-refresh / iframe to redirect the webview content; needs `frame-src http://localhost:{port}` in CSP.
   - **Recommended path:** add a permissive-but-loopback-only CORS middleware (`Access-Control-Allow-Origin: vscode-webview://*` or `*` since loopback + host-guard already constrain access). Keep webview HTML serving the bundled UI via `asWebviewUri` (no change to that path); only `connect-src` changes to allow the API origin.
5. **Remote development.** Confirmed safe — VS Code tunnels the portMapping back to the extension host; user's browser never sees the loopback port directly. No code change needed; just don't bind to anything other than `127.0.0.1`.
6. **Session sharing across panels.** Surface as documented behavior, not a bug.

## Architectural Responsibility Map

| Concern | Owner | Today | After |
|---------|-------|-------|-------|
| Open log file | LogSessionManager | bridge calls it | extension calls it directly via server's manager |
| Serve `/api/*` | LogServer routes | bridge re-implements per request kind | LogServer (unchanged) |
| Stream events to webview | bridge.post + ExtensionNotification | server SSE route + EventSource in UI |
| Path scrubbing | bridge clamps + LogSessionManager scrubs | LogSessionManager scrubs (already correct) |
| CSP | webviewHtml | webviewHtml (add `connect-src` entry) |
| Webview ↔ extension routing | postMessage | `WebviewPanelOptions.portMapping` |
| Trust boundary (DNS rebinding, etc.) | bridge whitelist of `kind`s | hostGuardMiddleware (existing) |

## Validation strategy (lightweight)

- **Unit/integration tests already cover the server.** No new tests of the server itself are needed.
- **New extension test:** activate the extension in the Mocha-style extension-test harness (or vitest with mocked `vscode`), confirm `startLogServer` is invoked once and the returned port appears in the panel's `portMapping` and the webview HTML's CSP.
- **Manual UAT:** the same six scenarios from `_superseded/15-07-PLAN.md`, plus a remote-dev sanity check (open in Codespaces or `code --remote ssh-remote+host`, confirm the webview still works because portMapping tunnels).

## Validation Architecture

| Dimension | What we validate | How |
|-----------|------------------|-----|
| 1. Functional | All 6 webview interactions work end-to-end | Manual UAT (Plan 15-07-style checklist) |
| 2. Trust | Loopback bind only; no fsPath in responses; DNS-rebinding rejected | Existing server tests cover this; no extension-side regression possible |
| 3. CSP | webview can connect to `http://localhost:{port}`; cannot connect anywhere else | Devtools network panel during UAT; CSP unit test on `webviewHtml.ts` output |
| 4. Lifecycle | Server starts on first open, survives multiple panels, closes on deactivate, no port leak | Extension-host integration test with mocked vscode + spy on `startLogServer` / `close()` |
| 5. Remote dev | Webview works in SSH/Codespaces | Manual UAT (Codespaces session); no automated coverage practical |
| 6. Standalone parity | `npx ahp-inspector` continues to work unchanged | Standalone CLI tests already cover this; no regression risk because the server is unchanged |
| 7. Cleanup | Bridge code deleted (no dead webview-client.ts, viewerSession.ts) | Dead-code grep + bundle-size check |
| 8. (Nyquist) | Server-in-extension path is the ONLY path; no fallback to bridge | Boundary check: extension does not import `ViewerSessionBridge` |

## Out of scope (deferred)

- One-server-per-panel isolation. Defer.
- Cancellation parity beyond what `AbortSignal` already gives the browser client. (`http-client.ts` already honors it natively.)
- Phase 11's 7 deferred manual UAT scenarios. Still parked.
- Any refactor of the standalone CLI startup. It already does this exactly.

## Glossary

- **portMapping** — `WebviewOptions.portMapping`: `{ webviewPort, extensionHostPort }[]`. VS Code routes webview localhost requests on `webviewPort` to `extensionHostPort` on the host machine.
- **cspSource** — `webview.cspSource`: a `vscode-webview-resource://...` origin that grants the webview access to its bundled assets.
- **LogServer** — `startLogServer({ sessions, port, version, uiDistDir })`. The Hono server already used by the standalone CLI.
- **Bridge** — `ViewerSessionBridge` (today's postMessage transport). Will be deleted by this work.
