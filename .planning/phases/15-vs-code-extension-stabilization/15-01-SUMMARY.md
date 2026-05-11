# Plan 15-01 SUMMARY — Server CORS + webviewHtml options

## What landed

- `packages/server/src/cors.ts` — new loopback-only CORS middleware. Echoes `Origin` (no credentials), handles `OPTIONS` preflight (204 + allow-methods/headers/max-age), defaults to `*` when Origin is absent on preflight. Mounted in `log-server.ts` BETWEEN `hostGuardMiddleware` and `cspMiddleware` so non-loopback hosts are still rejected first.
- `packages/server/src/cors.test.ts` — 4 vitest cases covering preflight echo, real GET echo + Vary, no-Origin no-CORS, no-Origin preflight wildcard.
- `packages/server/src/index.ts` — re-exports `corsMiddleware`.
- `packages/extension/src/webviewHtml.ts` — `WebviewHtmlOptions` extended with optional `loopbackOrigin` (widens CSP `connect-src`) and `apiBaseUrl` (emits `<script nonce=…>window.__AHP_API_BASE__ = "…";</script>` BEFORE the bundle script). Inline script uses `JSON.stringify(...).replace(/</g, "\\u003c")` so `</script>` breakouts are escaped. Backwards-compat preserved when both options are absent (snapshot-equivalent output).
- `packages/extension/src/__test__/webviewHtml.test.ts` — new file with 4 tests: backwards-compat (no localhost / no `__AHP_API_BASE__` / single script tag), `loopbackOrigin` widens CSP, `apiBaseUrl` injects script before bundle, XSS payload escapes to `\u003c/script>`.

## Verification

- `pnpm test packages/server packages/extension` — 14 files, 106 tests passing (including 8 new).
- `pnpm -F @ahp-inspector/server typecheck` — clean.
- `pnpm -F @ahp-inspector/extension typecheck` — clean.
- `grep -c "corsMiddleware" packages/server/src/log-server.ts` → 2 (import + use).
- `grep -c "loopbackOrigin\|apiBaseUrl" packages/extension/src/webviewHtml.ts` → 6.

## Deviations

- The PLAN said to test against the existing `__test__/` folder, which contained only `vscode-stub.ts` — created `webviewHtml.test.ts` alongside per the plan's fallback instruction.
- Test expectation for backwards-compat shifted from "byte-identical snapshot" to a structural assertion (no localhost, no `__AHP_API_BASE__`, single script tag). The output IS byte-identical when neither option is set — verified by inspection — but a string-snapshot test would have been brittle to nonce/cspSource fixture changes.

## Self-Check: PASSED

- All 4 task acceptance criteria met (CORS scenarios, CSP widening, script injection, XSS escape).
- All plan-level `<verification>` commands pass.
- Standalone CLI `renderWebviewHtml` callers unaffected (the standalone build does not pass these options).
