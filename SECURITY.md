# Security

AHP Log Viewer handles local protocol traffic logs that may include prompts,
tokens, file paths, model output, and other sensitive data.

## Supported versions

This repository is pre-release. Security fixes should target `main`.

## Reporting a vulnerability

Because this is a private repository, report vulnerabilities directly through the
private GitHub issue tracker or to the repository owner. Do not include real log
payloads, credentials, tokens, or other sensitive data in reports unless the
owner explicitly asks for a scrubbed reproduction.

## Local-only expectations

- The app should not send log contents to third-party services.
- The local server should bind to loopback only.
- UI metadata should avoid exposing absolute paths unless the user explicitly
  provided a path for manual open.
- Fixture logs committed to the repo must be synthetic or scrubbed.

## VS Code extension (`packages/extension`)

When the viewer runs inside VS Code, the loopback HTTP server is **not**
started. Instead the extension host hosts a `ViewerSessionBridge` per
webview panel and the React UI uses a typed `postMessage` transport.

- The webview is created with `enableScripts: true` and
  `localResourceRoots` pinned to the extension's `ui-dist/` folder, so
  `webview.asWebviewUri` only resolves bundled local assets.
- A strict CSP is injected into the webview HTML:
  `default-src 'none'`, `script-src 'nonce-<random>'`,
  `connect-src ${webview.cspSource}`. Inline scripts without a matching
  nonce are blocked, and there is no allowlist for outbound network
  origins.
- Webview ↔ extension messages are typed `WebviewRequest` /
  `ExtensionNotification` envelopes from `@ahp-viewer/shared`. Unknown
  message kinds are ignored; invalid payloads return coded error
  responses.
- Absolute file paths only appear inside the extension host (for the
  initial open hint and `path/openSession` requests). Paths are not put
  into stream metadata frames, and discovery responses use opaque
  candidate ids.

The boundary is enforced by automated tests:
`test/boundary.test.ts` forbids `vscode` imports and
`@ahp-viewer/extension` imports outside `packages/extension`, and
`test/security.test.ts` asserts that the extension runtime never imports
`startLogServer` and that `renderWebviewHtml` emits the strict CSP with
no external URLs.
