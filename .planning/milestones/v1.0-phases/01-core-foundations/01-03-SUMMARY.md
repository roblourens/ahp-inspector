---
phase: 01
plan: 03
subsystem: core+host+server+cli
tags: [event-store, correlator, host-adapter, chokidar, hono, cli, loopback-only]
requirements: [FOUND-01, EVENT-03, FOUND-04]
threats_mitigated: [T-03-01, T-03-02, T-03-03, T-03-04, T-03-05]
dependency_graph:
  requires:
    - "@ahp-inspector/shared (Plan 01-02)"
    - "@ahp-inspector/parser (Plan 01-02)"
    - "test/fixtures/tiny.jsonl (Plan 01-01)"
  provides:
    - "@ahp-inspector/core: EventStore + Correlator + Status"
    - "@ahp-inspector/host-node: NodeHostAdapter, TailReader, NodeLogHandle, discoverVsCodeLogs (stub)"
    - "@ahp-inspector/server: startHealthServer (loopback-only Hono)"
    - "@ahp-inspector/cli: ahp-inspector entrypoint wiring host → parser → store/correlator → server"
  affects:
    - "test/security.test.ts (allow-list += hono, @hono/node-server, tsx)"
tech_stack:
  added:
    - "hono@^4.12.18 (server)"
    - "@hono/node-server@^1.13.7 (server)"
    - "tsx@^4.21 (root devDep, smoke-test runner)"
  patterns:
    - "RESEARCH Pattern 4 — direction-inverting correlation key (response.dir flipped before lookup)"
    - "RESEARCH Pattern 5 — append-only columnar EventStore + side indices + subscribe()"
    - "RESEARCH Pattern 6 — HostAdapter seam; Node lives in host-node, portable packages stay Node-free"
    - "RESEARCH §CLI scaffold — commander + adapter wiring + SIGINT shutdown"
    - "RESEARCH Pitfall 7 — hard-coded loopback bind; no --host knob"
key_files:
  created:
    - "packages/core/src/event-store.ts"
    - "packages/core/src/event-store.test.ts"
    - "packages/core/src/correlator.ts"
    - "packages/core/src/correlator.test.ts"
    - "packages/core/src/types.ts"
    - "packages/host-node/src/host-adapter.ts"
    - "packages/host-node/src/tail-reader.ts"
    - "packages/host-node/src/discovery.ts"
    - "packages/host-node/src/host-adapter.test.ts"
    - "packages/server/src/health-server.ts"
    - "packages/server/src/health-server.test.ts"
    - "packages/cli/src/cli.smoke.test.ts"
  modified:
    - "packages/core/src/index.ts (barrel)"
    - "packages/host-node/src/index.ts (barrel)"
    - "packages/host-node/package.json (+ @ahp-inspector/shared)"
    - "packages/server/src/index.ts (barrel)"
    - "packages/server/package.json (+ hono, @hono/node-server)"
    - "packages/cli/src/index.ts (full implementation, was stub)"
    - "packages/cli/package.json (+ workspace deps)"
    - "package.json (+ tsx devDep)"
    - "test/security.test.ts (allow-list += hono, @hono/node-server, tsx)"
    - "pnpm-lock.yaml"
decisions:
  - "NodeLogHandle extends LogHandle with path+size — HostAdapter.openLog returns the wider type (covariant); watchLog narrows handle back to NodeLogHandle since the adapter constructed it."
  - "TailReader copies Buffer chunks into freshly-allocated Uint8Array views before handing them to onChunk — Node stream buffers may be reused, so a downstream consumer could see torn data otherwise."
  - "Correlator stores Status['n/a'] for non-pairable kinds and Status['pending'] for unmatched requests; flush(now, timeoutMs=30_000) promotes stale 'pending' → 'unmatched'."
  - "startHealthServer hard-codes hostname='127.0.0.1'. No --host CLI flag, no env override — the test fails the build if server.address() ever reports anything other than 127.0.0.1."
  - "Smoke tests run the CLI through tsx instead of pre-building dist/; matches the plan's preference and keeps the suite under 1s."
  - "CLI defaults dir='c2s' for every line as a Phase-1 placeholder; real direction inference lands with the transport in Phase 2."
metrics:
  duration: ~30 minutes
  tasks_completed: 3
  tests_added: 22
  total_test_count: 100
  full_suite_runtime_ms: 663
  completed: "2026-05-07"
---

# Phase 01 Plan 03: Core + Host + Server + CLI Summary

End-to-end Phase 1 wiring: an in-memory columnar `EventStore` + JSON-RPC-safe `Correlator`, a Node `NodeHostAdapter` that opens & tails JSONL via `fs`+`chokidar`, a Hono health server hard-bound to `127.0.0.1`, and an `ahp-inspector` CLI that ties them together so `pnpm exec ahp-inspector ./test/fixtures/tiny.jsonl` opens the log, ingests events, and serves `/health` on loopback.

## Commits

| # | Hash    | Type | Scope | Subject                                                          |
| - | ------- | ---- | ----- | ---------------------------------------------------------------- |
| 1 | 3648081 | feat | 01-03 | EventStore (columnar) + Correlator (bidirectional pairing)       |
| 2 | 73ac272 | feat | 01-03 | NodeHostAdapter — fs+chokidar tail reader                        |
| 3 | 3a1d15e | feat | 01-03 | Hono health server (127.0.0.1) + ahp-inspector CLI                  |

## What Shipped

### `@ahp-inspector/core`

| Symbol             | File                              | Purpose                                                      |
| ------------------ | --------------------------------- | ------------------------------------------------------------ |
| `EventStore`       | `src/event-store.ts`              | Append-only parallel-array store with side indices + subscribe(); subscriber errors caught (T-03-04). |
| `AppendRange`      | `src/event-store.ts`              | `{from, to}` notification payload — exclusive `to`.          |
| `Correlator`       | `src/correlator.ts`               | Pairs request/response on append using `correlationKeyForRequest/Response`; out-of-order parking; `flush()` for timeout. |
| `Status`           | `src/types.ts`                    | `'ok' \| 'error' \| 'pending' \| 'unmatched' \| 'orphan' \| 'n/a'`. |

### `@ahp-inspector/host-node`

| Symbol               | File                              | Purpose                                                              |
| -------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `NodeHostAdapter`    | `src/host-adapter.ts`             | `implements HostAdapter`; `openLog` validates + returns `NodeLogHandle`; sanitised error messages (T-03-03). |
| `NodeLogHandle`      | `src/host-adapter.ts`             | `LogHandle` + `{path, size}`.                                        |
| `TailReader`         | `src/tail-reader.ts`              | 256 KiB-chunk initial read + chokidar `change` tail; copies Buffers to fresh Uint8Array views. |
| `discoverVsCodeLogs` | `src/discovery.ts`                | Returns `[]` (TODO Phase 4 / INGEST-02).                            |

### `@ahp-inspector/server`

| Symbol             | File                              | Purpose                                                              |
| ------------------ | --------------------------------- | -------------------------------------------------------------------- |
| `startHealthServer`| `src/health-server.ts`            | Hono app, `serve({hostname:'127.0.0.1', port})`; returns `{url, port, server, close}`. |

### `@ahp-inspector/cli`

`packages/cli/src/index.ts` — `ahp-inspector [file] [--port <n>] [--no-server]`. Boots `NodeHostAdapter` + `EventStore` + `Correlator`, optionally starts `startHealthServer`, then for the supplied file: tails bytes → `LineSplitter` → `parseLine` → `normalize`/`makeParseErrorEvent` → `store.append`. SIGINT/SIGTERM dispose the watcher and close the server before `process.exit(0)`.

## Test Coverage Matrix

| Surface                     | File                                            | Cases | Coverage                                                                   |
| --------------------------- | ----------------------------------------------- | ----- | -------------------------------------------------------------------------- |
| EventStore                  | `packages/core/src/event-store.test.ts`         | 6     | Empty start, append return value, columns + side indices, at() round-trip, subscribe/unsubscribe, throwing-subscriber isolation. |
| Correlator                  | `packages/core/src/correlator.test.ts`          | 8     | c2s↔s2c pair (ok / error), no pair on same-direction repeats, idType `1`≠`'1'`, out-of-order response-first, notifications never touched, flush→unmatched, dispose unsubscribes. |
| NodeHostAdapter             | `packages/host-node/src/host-adapter.test.ts`   | 6     | openLog tiny.jsonl, openLog rejects missing files, sanitised error message, watchLog initial bytes match size, tmp-file append delivered <1.5s, discoverLogs == []. |
| Health server               | `packages/server/src/health-server.test.ts`     | 2     | bind address introspection (`server.address().address === '127.0.0.1'`), `/health` body shape, `close()` releases the port. |
| CLI smoke                   | `packages/cli/src/cli.smoke.test.ts`            | 2     | `--no-server` opens fixture and exits 0 on SIGINT; default mode prints `listening on http://127.0.0.1:<port>`, `/health` returns 200, clean SIGINT exit. |
| **Plan 01-03 new**          |                                                 | **24**| Adds to 76 prior → **100 total**; full suite 663 ms. |

## Threat Model Status

| Threat ID | Mitigation Status | Evidence                                                                                       |
| --------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| T-03-01 (LAN exposure) | mitigated | `health-server.ts` hard-codes `hostname='127.0.0.1'`; test asserts `server.address().address === '127.0.0.1'` and rejects `0.0.0.0` / `::`. |
| T-03-02 (mispairing JSON-RPC) | mitigated | Correlator uses `correlationKeyForResponse` (inverts dir) + idType in key; explicit pair / no-pair tests for direction & idType. |
| T-03-03 (path echo in errors) | mitigated | `openLog` errors only include `basename(resolved)`; test asserts a deeply-nested path's intermediate dirs do NOT appear in the error message. |
| T-03-04 (subscriber DoS) | mitigated | `EventStore.append` wraps subscriber dispatch in try/catch with `console.warn`; test installs a throwing subscriber and confirms append still succeeds. |
| T-03-05 (silent dep slip) | mitigated | `test/security.test.ts` allow-list explicitly extended to include `hono`, `@hono/node-server`, `tsx`; security test green. |
| T-03-06 (path traversal) | accept (locked) | Per locked decision — viewer reads user-chosen paths anywhere on disk. Read-only access + readability check + sanitised error messages remain in place. |

## Verification Run

```text
pnpm vitest run        # 13 files, 100 tests passed in 663 ms
pnpm typecheck         # 6 packages clean
pnpm lint              # 8 warnings, 0 errors
```

Acceptance greps (all match):

- `class EventStore` in `packages/core/src/event-store.ts` ✓
- `class Correlator` in `packages/core/src/correlator.ts` ✓
- `correlationKeyForRequest` + `correlationKeyForResponse` in `packages/core/src/correlator.ts` ✓
- `class NodeHostAdapter` in `packages/host-node/src/host-adapter.ts` ✓
- `implements HostAdapter` in `packages/host-node/src/host-adapter.ts` ✓
- `from 'chokidar'` in `packages/host-node/src/tail-reader.ts` ✓
- `127.0.0.1` in `packages/server/src/health-server.ts` ✓
- `0.0.0.0` in `packages/server/src/health-server.ts` → empty ✓

## CLI Demo

```bash
$ pnpm exec tsx packages/cli/src/index.ts ./test/fixtures/tiny.jsonl --port 5173
[ahp-inspector] listening on http://127.0.0.1:5173
[ahp-inspector] opened /Users/.../ahp-inspector/test/fixtures/tiny.jsonl (560 bytes)
^C
$ curl -s http://127.0.0.1:5173/health
{"status":"ok","version":"0.1.0"}
```

(Manual smoke is covered by `cli.smoke.test.ts`; both scenarios exit 0 on SIGINT.)

## Final Allow-List (Phase 1 close)

```
typescript, @biomejs/biome, vitest, tsup, tsx, @types/node,
commander, chokidar, hono, @hono/node-server, agent-host-protocol,
@ahp-inspector/{shared, parser, core, host-node, server, cli}
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocker] `host-node` lacked `@ahp-inspector/shared` dependency**
- **Found during:** Task 2 typecheck — `import type { HostAdapter } from "@ahp-inspector/shared"` in the new `host-adapter.ts` failed module resolution.
- **Fix:** Added `@ahp-inspector/shared: workspace:*` to `packages/host-node/package.json`. Re-ran `pnpm install`; lockfile updated.
- **Files modified:** `packages/host-node/package.json`, `pnpm-lock.yaml`.
- **Commit:** 73ac272.

**2. [Rule 3 — Blocker] CLI lacked `@ahp-inspector/{core, parser, shared}` dependencies**
- **Found during:** Task 3.
- **Issue:** CLI imports the full pipeline (`EventStore`, `LineSplitter`, `makeParseErrorEvent`); only `host-node`, `server`, `commander` were declared in Plan 01-01 stub.
- **Fix:** Added the three workspace links to `packages/cli/package.json`.
- **Commit:** 3a1d15e.

**3. [Rule 1 — Bug] CLI used non-existent `parsed.error.rawText`**
- **Found during:** Task 3 typecheck.
- **Issue:** `ParsedLine.error` only carries `{reason}`; the raw line text is `parsed.text`. Initial CLI used `parsed.error.rawText`.
- **Fix:** Pass `parsed.text` into `makeParseErrorEvent(meta, parsed.error.reason, parsed.text)`.
- **Commit:** 3a1d15e.

**4. [Rule 1 — Bug] `NodeHostAdapter.openLog` declared `let stat;` (implicit any)**
- **Found during:** Task 3 lint pass.
- **Fix:** Annotated `let stat: ReturnType<typeof statSync>`.
- **Commit:** rolled into 3a1d15e.

**5. [Rule 2 — Critical] Health-server bind comment contained literal `0.0.0.0`**
- **Found during:** Task 3 acceptance grep — `grep -E "0\.0\.0\.0" health-server.ts` is required to return nothing.
- **Fix:** Reworded the comment to "any non-loopback bind" so the source no longer contains the literal pattern.
- **Commit:** rolled into 3a1d15e.

**6. [Rule 3 — Cleanup] Biome organize-imports auto-applied to Plan 01-03 sources**
- **Found during:** `pnpm lint` after Task 3.
- **Fix:** `biome check . --write` reordered imports in 11 files (purely lexicographic). Behavior unchanged.
- **Note:** Biome also tried to rewrite `biome.json`'s ignore patterns (e.g. `!**/dist/**` → `!**/dist`); reverted that file because it would change ignore semantics outside this plan's scope.
- **Commit:** rolled into 3a1d15e.

No architectural deviations; no checkpoints hit; no auth gates required.

## Authentication Gates

None.

## Known Stubs

- `discoverVsCodeLogs()` returns `[]`. JSDoc TODO references INGEST-02 / Phase 4 (file discovery for the picker UI).
- CLI defaults `dir='c2s'` for every parsed line — Phase-1 placeholder; real direction inference lands with the Phase 2 transport.

Both stubs are intentional and explicitly scoped to a future plan. They do NOT block the FOUND-01/EVENT-03/FOUND-04 success criteria for Plan 01-03.

## Threat Flags

None — all new surface (loopback HTTP, fs read, chokidar watch) is enumerated in the plan's threat model and tested.

## Readiness for Phase 2

Phase 2 will introduce the streaming transport (`HostClient` over SSE), a Hono `/events` route, and a virtualised timeline UI. Phase 1 leaves the following primitives wired and tested:

- ✅ `EventStore.subscribe()` already publishes `{from, to}` ranges — Phase 2 SSE producer can hook this directly.
- ✅ `Correlator` exposes `pairOf` / `latencyOf` / `statusOf` keyed by event idx — UI rows can reference pairs in O(1).
- ✅ `HostAdapter` interface is the only host-side surface the renderer touches; a future browser/VS-Code transport need only implement `HostClient` + the same `HostAdapter` contract.
- ✅ Health server in place — Phase 2 adds routes to the same Hono app (or composes a new one bound to the same hostname constant).
- ✅ Boundary + security tests guard new deps and any accidental Node import in shared/parser/core.

## Self-Check: PASSED

Files (all `[ -f ]` checks):

- ✅ `packages/core/src/event-store.ts`
- ✅ `packages/core/src/event-store.test.ts`
- ✅ `packages/core/src/correlator.ts`
- ✅ `packages/core/src/correlator.test.ts`
- ✅ `packages/core/src/types.ts`
- ✅ `packages/host-node/src/host-adapter.ts`
- ✅ `packages/host-node/src/tail-reader.ts`
- ✅ `packages/host-node/src/discovery.ts`
- ✅ `packages/host-node/src/host-adapter.test.ts`
- ✅ `packages/server/src/health-server.ts`
- ✅ `packages/server/src/health-server.test.ts`
- ✅ `packages/cli/src/index.ts` (full implementation)
- ✅ `packages/cli/src/cli.smoke.test.ts`

Commits:

- ✅ `3648081` (Task 1)
- ✅ `73ac272` (Task 2)
- ✅ `3a1d15e` (Task 3)
