# Plan 15-02 SUMMARY — apiUrl helper for UI transport

## What landed

- `packages/ui/src/transport/api-base.ts` — new `apiUrl(path)` helper. Reads `window.__AHP_API_BASE__` (with type augmentation), strips trailing slash on the base, returns input unchanged when unset.
- `packages/ui/src/transport/api-base.test.ts` — 4 vitest cases (unset path-through, set prefixes, trailing-slash normalised, SSE stream path).
- `packages/ui/src/transport/http-client.ts:76` — `fetch(\`/api/log/event/${idx}\`, init)` → `fetch(apiUrl(...), init)`.
- `packages/ui/src/transport/sse-client.ts:51` — default URL `"/api/log/stream"` → `apiUrl("/api/log/stream")`. Explicit `opts.url` overrides still bypass the helper (test injection unaffected).
- `packages/ui/src/transport/search-client.ts:19` — wrapped in `apiUrl(...)`.
- `packages/ui/src/transport/state-client.ts:99` — wrapped.
- `packages/ui/src/transport/sessions-client.ts:41,89` — both `discover` and `open` wrapped.
- `packages/ui/src/transport/browser-client.ts:21` — `probeLogMeta` `fetch("/api/log/meta")` wrapped.

## Verification

- `pnpm test packages/ui` — 50 files, 339 tests passing (4 new). Existing tests unmodified — `apiUrl` is a no-op when `window.__AHP_API_BASE__` is unset (vitest does not set it).
- `pnpm -F @ahp-inspector/ui typecheck` — clean.
- `grep -rE 'fetch\\([\"`]/api/' packages/ui/src --include='*.ts' | grep -v test | grep -v api-base` — empty (no raw /api/ fetches remain in production code).
- `grep -c 'apiUrl(' packages/ui/src/transport/*.ts` — 8 usages across 6 transport files (one per callsite + helper definition).

## Deviations

None. Plan executed exactly as written.

## Self-Check: PASSED

- All Task 1 + Task 2 acceptance criteria met (helper exists, all six files routed, suite green).
- All plan-level `<verification>` commands pass.
- Standalone CLI behavior preserved (relative URL path-through when global is unset).
