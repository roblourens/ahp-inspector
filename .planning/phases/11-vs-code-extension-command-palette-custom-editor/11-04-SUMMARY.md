# Plan 11-04 — Packaging, Guardrails, and Docs — Summary

## What was built

- `packages/extension/src/extension.test.ts` — 3 Vitest tests covering
  command registration, panel creation with HTML/initialLog, and panel
  disposal. Uses a per-test fake `vscode` namespace via `vi.mock`.
- `vitest.config.ts` — aliases `vscode` to a stub source file so tests
  in the extension package resolve at import time before `vi.mock`
  intercepts.
- `packages/extension/src/__test__/vscode-stub.ts` — empty stub.
- `test/boundary.test.ts` — adds `vscode` and `@ahp-inspector/extension`
  to the forbidden-imports lists for portable packages and the UI, and
  introduces a server-package boundary that forbids the same.
- `test/security.test.ts` — adds two new gates: no `startLogServer` /
  `open` import in extension runtime sources, and a CSP / no-CDN check
  that exercises `renderWebviewHtml` directly.
- `packages/extension/package.json` — `build` now invokes
  `scripts/copy-ui-dist.cjs` after `tsup`. Adds workspace `devDep`
  on `@ahp-inspector/ui` so `pnpm -r build` orders UI before extension.
- `packages/extension/scripts/copy-ui-dist.cjs` — copies
  `packages/ui/dist` → `packages/extension/ui-dist` and renames the
  hashed `index-*.{js,css}` outputs to `main.js` / `main.css` so the
  webview can load them at stable paths.
- `packages/extension/README.md` — local development, command flow,
  build output, security model.
- `USER_GUIDE.md` — adds an "Inside VS Code (extension)" section.
- `SECURITY.md` — documents the extension's local-only model: no
  loopback server, strict CSP, typed `postMessage`, paths kept in the
  extension host.

## Verification

- `pnpm typecheck` clean (10 packages).
- `pnpm test` clean: 89 files / 1083 tests.
- `pnpm build` clean. `packages/extension/dist/extension.cjs` and
  `packages/extension/ui-dist/assets/{main.js,main.css}` exist after a
  fresh build.

(Written by Copilot)
