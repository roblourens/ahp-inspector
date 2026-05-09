# Plan 11-01 — VS Code extension package and webview shell

**Phase:** 11 (VS Code extension command palette webview)
**Status:** complete
**Wave:** 1

## What changed

- Added `packages/extension` workspace package (`@ahp-inspector/extension`,
  `private: true`) with a VS Code manifest contributing the
  `ahpInspector.open` command in the AHP Inspector category, `engines.vscode
  ^1.95.0`, and CommonJS `tsup` build (`extension.cjs`) marking `vscode`
  as external.
- `tsconfig.json` extends the workspace base and pulls in `@types/vscode`
  via the `types` array.
- `packages/extension/src/activeLog.ts` exposes a pure
  `detectActiveAhpLog(state)` helper backed by a small abstract
  `ActiveLogWindowState` shape so unit tests don't need a VS Code stub.
  Detection prefers the active editor when log-like, falls back to a
  recently visible `.jsonl` editor, and accepts AHP-named files even
  without a `.jsonl` extension.
- `packages/extension/src/webviewHtml.ts` exposes `renderWebviewHtml` and
  `generateNonce`. HTML is CSP-safe (`default-src 'none'`, per-load nonce,
  `script-src 'nonce-…'`, `${cspSource}`-scoped img/font/style/connect),
  and never interpolates user-controlled file paths.
- `packages/extension/src/extension.ts` registers `ahpInspector.open`,
  creates the webview panel directly (not a `CustomEditorProvider`),
  loads bundled UI assets via `webview.asWebviewUri` with restricted
  `localResourceRoots`, and forwards an `initialLog` message that carries
  the detected absolute path. The Plan 11-03 bridge will eventually
  consume this and only expose basename/logKey to the webview.
- `test/security.test.ts`: `@types/vscode` added to the dependency
  allow-list.

## Verification

- `pnpm -F @ahp-inspector/extension typecheck` — clean.
- `pnpm exec vitest run packages/extension/src/activeLog.test.ts` — 4
  tests pass (active editor, untitled/non-file/non-log, recent visible
  editor fallback, AHP-named extension fallback).
- `pnpm exec vitest run test/boundary.test.ts test/security.test.ts` —
  263 tests pass; the new package does not break boundary or
  dependency-allow-list invariants.

## Threat model dispositions

| Threat ID | Disposition |
|-----------|-------------|
| T-11-01-01 | Mitigated — `detectActiveAhpLog` returns the absolute
  path only inside the extension host; the webview-bound `initialLog`
  message carries the same path today, but the Plan 11-03 bridge will
  swap that for basename/logKey before the webview ever observes it. |
| T-11-01-02 | Mitigated — `renderWebviewHtml` enforces `default-src
  'none'`, a per-load nonce, scoped `${cspSource}` directives, and HTML
  escaping for every interpolation point. No file paths are ever placed
  in HTML. |
| T-11-01-03 | Mitigated — `activate` only registers the single command
  and creates a webview; no shell/exec, no `vscode.env.openExternal`, no
  loopback server. |

## Notes

- Bundled UI assets are expected at `<extensionPath>/ui-dist/assets/`;
  Plan 11-04 will wire `pnpm build` to copy `packages/ui/dist` into that
  layout.
