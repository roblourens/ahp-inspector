# `@ahp-inspector/extension`

VS Code extension that opens the AHP Inspector inside a webview. The same
React UI that ships in browser mode runs inside the webview; the extension
host owns log discovery, file watchers, and the in-memory `EventStore` and
talks to the webview over typed `postMessage` requests — no loopback HTTP
server is started.

## Command

- **AHP Inspector: Open** (`ahpInspector.open`) — opens or focuses the viewer
  panel in the active editor column. If a `.jsonl` file (or any file with
  `ahp` / `ahp-log` / `ahp_log` in its name) is the active editor, that
  file is preselected as the initial log.

## Local development

```sh
pnpm install
pnpm -F @ahp-inspector/ui build         # produces packages/ui/dist
pnpm -F @ahp-inspector/extension build  # produces dist/extension.cjs + ui-dist/
```

The extension build copies `packages/ui/dist` into `ui-dist/` and renames
the hashed `index-*.{js,css}` outputs to `main.js` / `main.css` so the
webview HTML can load them at stable paths. `pnpm build` from the repo
root runs both builds in topological order.

To try the extension end to end, point a VS Code instance at this repo
folder via `code --extensionDevelopmentPath=packages/extension`. Run the
`AHP Inspector: Open` command from the command palette.

## Build output

- `dist/extension.cjs` — bundled extension entrypoint (CommonJS, `vscode`
  external, `@ahp-inspector/*` packages bundled in).
- `ui-dist/` — copied UI assets served via `webview.asWebviewUri`.

## Security model

- `enableScripts: true` with `localResourceRoots` pinned to `ui-dist/`.
- A strict CSP is injected by `webviewHtml.ts`: `default-src 'none'`,
  `script-src 'nonce-<random>'`, `connect-src ${webview.cspSource}` (no
  outbound network).
- Webview ↔ extension messages are `WebviewRequest` /
  `ExtensionNotification` envelopes from `@ahp-inspector/shared`. Unknown
  message kinds are ignored.
- The extension does not start the loopback HTTP server (`startLogServer`)
  or open a system browser — that path is reserved for the standalone
  CLI.
