# Plan 11-02 — UI transport abstraction

**Phase:** 11 (VS Code extension command palette webview)
**Status:** complete
**Wave:** 1

## What changed

- New `packages/ui/src/transport/client.ts` defines the shared
  `AhpViewerClient` contract (probe, candidates, open-by-id/path, live
  stream, event detail, search, state-at-index) and the
  `LogStreamHandle` shape. Re-exports the response/option types from the
  existing transport modules so callers don't need to know which file
  each type lives in.
- New `packages/ui/src/transport/browser-client.ts` implements
  `createBrowserAhpViewerClient` by composing the existing transport
  helpers. The previously-inline `/api/log/meta` probe logic moves up
  into `probeLogMeta`, which returns a typed
  `"no-log" | "no-server" | "ready"` result.
- New `packages/ui/src/transport/transport-context.tsx` exposes
  `AhpViewerClientProvider` and `useAhpViewerClient`. The hook throws
  with a clear message when used outside a provider.
- `App.tsx` now reads its transport from `useAhpViewerClient()`. The
  probe effect, candidate refresh, open-by-candidate, open-by-path, and
  stream replacement all go through the typed client. The component no
  longer imports concrete transport functions or `fetch` directly.
- `main.tsx` wires `createBrowserAhpViewerClient()` as the default
  runtime. Plan 11-03 will swap this for the webview client when running
  inside VS Code.
- `App.test.tsx` was rewritten to provide a fake client through
  `AhpViewerClientProvider` instead of stubbing `globalThis.fetch`. New
  cases assert the `no-log` and `no-server` probe paths.
- New `browser-client.test.ts` covers the four `probeLogMeta`
  branches (204 no-log, 200 JSON ready, network error → no-server,
  non-JSON 200 → no-server, 5xx → no-server) and a smoke check that the
  browser client exposes the bound methods.

## Verification

- `pnpm -F @ahp-viewer/ui typecheck` — clean.
- `pnpm exec vitest run packages/ui/src/transport/browser-client.test.ts
  packages/ui/src/transport/sessions-client.test.ts
  packages/ui/src/transport/http-client.test.ts
  packages/ui/src/transport/search-client.test.ts
  packages/ui/src/transport/state-client.test.ts
  packages/ui/src/App.test.tsx` — 44 tests pass across 6 files.

## Threat model dispositions

| Threat ID | Disposition |
|-----------|-------------|
| T-11-02-01 | Mitigated — the transport contract is fully typed in
  `client.ts`; UI callers only see the existing typed response shapes
  from `sessions-client`/`http-client`/`search-client`/`state-client`. |
| T-11-02-02 | Mitigated — `LogMeta`/`SafeCandidate` retain their
  basename/logKey-only shape; no absolute-path field was added to the UI
  contracts. |
| T-11-02-03 | Mitigated — `App.replaceLogStream` continues to call
  `previous?.close()` before opening a new handle, and the probe effect
  cleans up its handle on unmount. |
