# Security

AHP Inspector handles local protocol traffic logs that may include prompts,
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

The extension owns a singleton loopback `LogServer` and exposes it to the
webview through VS Code port mapping. The React UI uses the same HTTP and SSE
transport as the standalone application.

- The server binds to `127.0.0.1`.
- The webview allows scripts and limits local resources to the bundled
  `ui-dist` directory.
- Webview HTML uses a restrictive CSP with a per-load script nonce and an
  explicit loopback `connect-src`.
- Discovery responses and normal metadata use opaque identifiers and
  basenames rather than absolute paths.
- Extension deactivation must close the server and dispose the active session,
  including file watchers, timers, streams, and temporary uploads.

The boundary is enforced by `test/boundary.test.ts`, `test/security.test.ts`,
and the server CORS, origin, host-guard, and CSP tests.
