---
status: issues_found
phase: project-wide
depth: deep
files_reviewed: 336
findings:
  critical: 1
  warning: 14
  info: 5
  total: 20
reviewed_at: 2026-09-01
---

# AHP Inspector Comprehensive Code Review

## Executive summary

AHP Inspector has a sound high-level package split, unusually strong unit-test coverage, strict
TypeScript settings, and several thoughtful defenses for a local log viewer. The review still found
one critical security issue, several data-loss/lifecycle bugs, a stale protocol integration, and
gaps in CI and release automation.

The most urgent issue is the loopback API's acceptance of the `null` browser origin. A remote page
can create a sandboxed null-origin frame, call the predictable local server, open any readable local
file (the API intentionally accepts arbitrary paths and does not require `.jsonl`), and retrieve its
lines through the detail endpoint. This was reproduced against a workspace-owned non-JSONL file:
the server returned `Access-Control-Allow-Origin: null`, accepted `POST /api/sessions/open`, and
returned the first raw line through `GET /api/log/event/0`.

The highest-priority correctness findings are:

1. A valid final JSONL record without a newline is never emitted.
2. Initial-read/watch and change/rotation transitions can lose, duplicate, or reorder bytes.
3. Selecting a malformed row can crash both detail renderers.
4. Extension shutdown does not dispose the active session, and upload cleanup is not owned by the
   server handle.
5. The vendored protocol and sync script do not support the current canonical `channels-chat`
   surface.

## Validation performed

| Check | Result |
|---|---|
| `pnpm typecheck` | Passed for all 9 workspace projects |
| `pnpm test` | Passed: 1,471 tests |
| `pnpm build` | Passed; Vite emitted a CSS `::highlight()` parser warning |
| `pnpm lint` | Failed: 42 errors, 12 warnings, 1 info |
| Null-origin API reproduction | Confirmed against a workspace-owned file |
| Unterminated-final-line reproduction | Confirmed: snapshot contained 0 rows after initial read completed |
| Full Playwright suite | Not run; two specs require an externally started server and CI does not run E2E |

## Critical findings

### C-01: Null-origin CORS enables cross-site arbitrary local-file reads

- **Severity:** Critical
- **Confidence:** 99%
- **Files:** `packages/server/src/origin.ts:22-23`,
  `packages/server/src/session-routes.ts:24-46`, `packages/server/src/detail-routes.ts:20-46`
- **Root cause:** `isAllowedOrigin` explicitly trusts the literal `null` origin and every
  `vscode-webview://` origin. The session API accepts an arbitrary readable path, including files
  that are not JSONL. Parse-error events retain each raw source line, and the detail endpoint returns
  that data.
- **Impact:** A hostile website can use a sandboxed iframe (whose origin is `null`) to scan the
  default local port, open a known local path, and read file contents through CORS. The predictable
  CLI default port (`5173`) makes discovery easier. Browser private-network controls may reduce
  exploitability in some configurations, but they are not a reliable application security boundary.
- **Evidence:** A live server returned `Access-Control-Allow-Origin: null`, accepted a null-origin
  request to open `package.json`, and returned its first raw line through the detail API.
- **Remediation:** Reject `null` and wildcard VS Code webview origins. Introduce a high-entropy,
  per-process capability token required by every API and SSE request. Inject it into the standalone
  page and VS Code webview at startup. Prefer an exact per-panel webview origin allow-list where the
  platform exposes it. Add an integration test that a null-origin request cannot read, mutate, or
  establish SSE.

## Warning findings

### W-01: Protocol vendoring is stale and the sync command is structurally unable to import current AHP

- **Severity:** Warning
- **Confidence:** 99%
- **Files:** `scripts/sync-agent-host-protocol.ts:17-34`,
  `packages/protocol/src/source-info.ts:6`, `packages/core/src/event-narrow.ts:196-200`,
  `packages/core/src/replay.ts:101`, `packages/core/src/replay.ts:536-547`
- **Root cause:** The sync script hard-codes a directory allow-list ending at root/session/terminal/
  changeset. The canonical sibling repository now contains `channels-chat`, while the vendored source
  is pinned to `7ed423d` and the sibling is at `fa92d47d`. Event narrowing and replay also hard-code
  only `root/`, `session/`, and `terminal/` action prefixes.
- **Impact:** Running `pnpm sync:ahp` against the current source would omit required channel files.
  Current `chat/*` traffic is treated as unknown and is not replayed, so the state inspector and rich
  summaries drift from the actual protocol.
- **Remediation:** Discover canonical channel directories from the upstream aggregator or a
  machine-readable manifest rather than maintaining a local list. Sync current sources, add
  `channels-chat`, and derive action/resource handling from canonical types or registries. Add a test
  comparing the vendored manifest to the sibling repository when it is available.

### W-02: A valid final JSONL record without a newline is silently dropped

- **Severity:** Warning
- **Confidence:** 99%
- **Files:** `packages/server/src/app-state.ts:350-356`,
  `packages/parser/src/jsonl.ts:177-183`
- **Root cause:** Initial-read completion calls only `splitter.endOfInput()`, which flushes oversized
  skip state but not the normal trailing buffer. `LineSplitter.flush()` exists but is never used by
  `AppState`.
- **Impact:** Static uploads and ordinary JSONL files whose last record lacks a trailing newline omit
  their final event indefinitely. Rotation has the same issue.
- **Evidence:** An in-memory host delivered one complete JSON-RPC object without `\n`, then signaled
  initial-read completion; `state.snapshot().rows.length` remained `0`.
- **Remediation:** On known static EOF, flush and parse the final complete record. For live files,
  parse a trailing buffer only when it is valid complete JSON, otherwise retain it for a future
  append. Cover initial load, upload, and post-rotation cases.

### W-03: Tail-reader transitions can lose or duplicate appended bytes

- **Severity:** Warning
- **Confidence:** 92%
- **Files:** `packages/host-node/src/host-adapter.ts:59-61`,
  `packages/host-node/src/tail-reader.ts:57-59`, `packages/host-node/src/tail-reader.ts:109-118`,
  `packages/host-node/src/tail-reader.ts:129-178`
- **Root cause:** The filesystem watcher is installed only after the entire initial read completes.
  A write in that gap is not observed unless another later write happens. Rotation is launched
  independently from the serialized `#onChange` path, so an in-flight old-file read can continue
  after reset and overwrite `#lastOffset`.
- **Impact:** Live traffic can be missed, duplicated, or appended after a rotation reset in the wrong
  order.
- **Remediation:** Start watching before the baseline read, then reconcile file identity/size after
  the read. Serialize change, unlink/add, shrink, and rotation operations through one queue or
  generation token. Ignore chunks/results from stale generations.

### W-04: Malformed-event detail views can crash

- **Severity:** Warning
- **Confidence:** 98%
- **Files:** `packages/ui/src/components/detail/PrettyJsonView.tsx:133-145`,
  `packages/ui/src/components/detail/RawJsonView.tsx:18-42`,
  `packages/ui/src/components/detail/DetailPanel.tsx:490-514`
- **Root cause:** Parse-error events have `raw === undefined`. `JSON.stringify(undefined)` returns
  `undefined` without throwing. Pretty view dereferences `serialized.length`; raw view passes the
  undefined value to a component that calls string methods.
- **Impact:** Selecting the row for malformed input can tear down the detail subtree (there is no
  error boundary), preventing inspection of the very errors the UI is intended to explain.
- **Remediation:** Normalize non-serializable/undefined results explicitly, e.g.
  `JSON.stringify(data, null, 2) ?? "undefined"`, and render parse-error `rawText` deliberately. Add
  Pretty/Raw/DetailPanel tests for a real parse-error response.

### W-05: Server and extension resource ownership is incomplete

- **Severity:** Warning
- **Confidence:** 99%
- **Files:** `packages/server/src/log-server.ts:55-78`,
  `packages/server/src/upload-routes.ts:137-158`,
  `packages/extension/src/extensionServer.ts:59-66`
- **Root cause:** `registerUploadRoutes` returns a disposable handle, but `startLogServer` discards it.
  The extension closes only the HTTP server and never disposes `sessions`. Upload cleanup registered
  on Node's `exit` event starts asynchronous work that Node will not wait for.
- **Impact:** Extension deactivation leaves the active chokidar watcher and correlation timer alive.
  Server restarts accumulate process listeners. Uploaded temp directories can remain after normal
  shutdown.
- **Remediation:** Make `LogServerHandle.close()` own and await route cleanup; make the extension
  dispose sessions and server together in a `finally`-safe order. Remove asynchronous `exit`
  cleanup or use an owned lifecycle that completes before process exit.

### W-06: Watch errors leak absolute local paths into the browser/webview

- **Severity:** Warning
- **Confidence:** 98%
- **Files:** `packages/host-node/src/tail-reader.ts:69-76`,
  `packages/host-node/src/tail-reader.ts:136-142`,
  `packages/server/src/app-state.ts:419-424`
- **Root cause:** Raw filesystem `Error.message` values are copied into SSE payloads. Node stat/read
  errors commonly include the full absolute path.
- **Impact:** The UI-visible error channel violates the documented basename-only privacy boundary
  and can expose usernames and sensitive directory structure. Combined with C-01, it can also be
  read cross-origin.
- **Remediation:** Map host errors to stable codes and sanitized, path-free copy at the host/server
  boundary. Log detailed errors only to a trusted host-side diagnostic channel if needed.

### W-07: Log switching relies on a racy old-stream reset

- **Severity:** Warning
- **Confidence:** 91%
- **Files:** `packages/ui/src/App.tsx:75-91`,
  `packages/ui/src/components/shell/AppShell.tsx:63-69`,
  `packages/ui/src/components/shell/AppShell.tsx:131-157`,
  `packages/ui/src/transport/sse-client.ts:140-153`,
  `packages/ui/src/transport/sse-client.ts:233-235`
- **Root cause:** Switch handlers set the new log key and immediately close/replace the old
  EventSource. The full UI reset is performed only if the old stream's asynchronous `log-reset`
  frame arrives. The new stream's `snapshot-begin` clears rows and metadata but not selection,
  pending rows, search state, or detail state.
- **Impact:** Depending on timing, the old reset can be lost (stale selection/details survive into
  the new log) or arrive after the new key is set (clearing new state). A selected index can briefly
  fetch an unrelated event at the same index in the new log.
- **Remediation:** Perform a synchronous local `resetForLogSwitch()` as part of the switch
  transaction before assigning the new key and connecting. Treat `log-reset` as a remote safety
  signal, not the primary local state transition.

### W-08: SSE backpressure queue is unbounded per client

- **Severity:** Warning
- **Confidence:** 95%
- **Files:** `packages/server/src/sse-routes.ts:25`, `packages/server/src/sse-routes.ts:49-76`,
  `packages/server/src/sse-routes.ts:111-120`
- **Root cause:** The connection count is capped, but every accepted client has an unbounded
  in-memory `SsePayload[]`. Slow or paused clients continue accumulating frames and row arrays.
- **Impact:** One or several slow local clients can retain the entire live stream multiple times and
  exhaust the process. This is especially risky during a large baseline plus active tail.
- **Remediation:** Set byte/frame/row high-water marks. Coalesce compatible append/patch frames,
  disconnect clients that exceed the cap with an explicit resync signal, and measure queued bytes
  rather than only reporting counts.

### W-09: Large-log indexing and replay duplicate too much state

- **Severity:** Warning
- **Confidence:** 90%
- **Files:** `packages/server/src/search-index.ts:8-27`,
  `packages/server/src/state-replay-index.ts:15-49`,
  `packages/server/src/app-state.ts:153-160`
- **Root cause:** Every raw payload is retained as an object and separately as a full lowercased JSON
  string for search. State lookup replays from event zero on every miss and caches up to 25 complete
  replay results.
- **Impact:** A large log can require several times its source size in memory. Repeated state
  inspection becomes O(events × misses), while cached full states can retain many historical object
  graphs. This undermines the project's large-log goal despite timeline virtualization.
- **Remediation:** Use a compact/incremental search representation with measured memory bounds.
  Build replay checkpoints incrementally and cache deltas or bounded structural snapshots. Add
  process-memory and state-lookup latency benchmarks using large synthetic logs.

### W-10: CI omits its own lint target, production builds, and E2E tests

- **Severity:** Warning
- **Confidence:** 100%
- **Files:** `.github/workflows/ci.yml:18-20`, `e2e/phase14.spec.ts:3-6`,
  `e2e/phase17.spec.ts:4-9`
- **Root cause:** CI runs only install, typecheck, and unit tests. It does not run `pnpm lint`,
  `pnpm build`, or any Playwright project. Two Playwright specs depend on an externally running CLI,
  unlike the self-spawning specs.
- **Impact:** The current repository already fails `pnpm lint` with 42 errors and 12 warnings, yet CI
  remains green. Packaging/bundling regressions and browser-only failures are caught only manually.
  The E2E command is not hermetic.
- **Remediation:** Add lint and build to required CI. Extract one shared Playwright CLI fixture that
  allocates an ephemeral port and use it in every spec. Run a focused smoke E2E set on pull requests
  and the full set before release.

### W-11: Version-input releases tag a commit containing the wrong package version

- **Severity:** Warning
- **Confidence:** 100%
- **Files:** `.github/workflows/publish.yml:35-37`, `.github/workflows/publish.yml:52-63`
- **Root cause:** The workflow changes `packages/cli/package.json` only in the runner worktree, then
  creates a tag at the unchanged checked-out commit without committing the version bump.
- **Impact:** `vX.Y.Z` can point to source that declares the previous version, while npm contains the
  requested version. Subsequent releases start from stale metadata and provenance is confusing.
- **Remediation:** Require the version to be committed before dispatch, or have the workflow create
  and push a release commit before tagging. Verify tag, package manifest, tarball version, and npm
  version all match before publishing.

### W-12: Global keyboard shortcuts break normal input editing

- **Severity:** Warning
- **Confidence:** 98%
- **Files:** `packages/ui/src/components/filters/FilterBar.tsx:114-136`,
  `packages/ui/src/components/timeline/TimelineRegion.tsx:132-150`,
  `packages/ui/src/components/timeline/TimelineRegion.tsx:193-207`
- **Root cause:** Document/window key handlers do not consistently ignore input, textarea, select,
  or contenteditable targets. FilterBar captures `/` everywhere. TimelineRegion captures grouping
  chords and arrow/page navigation while focus can be in a text field.
- **Impact:** Users cannot reliably type slash-containing filters/paths or use arrow keys to edit
  text while the main shell is mounted; keystrokes can unexpectedly change grouping or timeline
  selection.
- **Remediation:** Centralize shortcut handling and return immediately for editable targets unless
  the exact shortcut is intentionally supported there (for example Cmd/Ctrl+F). Add tests for every
  global shortcut with focus in each editable control.

### W-13: Candidate-open failures produce unhandled rejections and no recovery UI

- **Severity:** Warning
- **Confidence:** 98%
- **Files:** `packages/ui/src/components/shell/AppShell.tsx:130-140`
- **Root cause:** Candidate selection launches a `void` async IIFE with `try/finally` but no `catch`.
  The picker closes even when opening fails.
- **Impact:** Stale discovery results, permission changes, or file removal cause an unhandled promise
  rejection and leave the user without an error message or retry context.
- **Remediation:** Await through a component-owned loading/error state, keep the picker open on
  failure, and display the same sanitized error mapping used by manual path open.

### W-14: Persistence failure handling cannot work as documented

- **Severity:** Warning
- **Confidence:** 100%
- **Files:** `packages/ui/src/state/persistence.ts:43-48`,
  `packages/ui/src/persistence/persist-effect.ts:62-72`
- **Root cause:** `writeAll` catches and suppresses every localStorage failure. Its caller expects
  `saveForLogKey` to throw so it can set `ref.disabled = true`.
- **Impact:** Quota/security failures trigger repeated serialization and write attempts on every
  relevant state change, while users receive no indication that preferences are not being saved.
- **Remediation:** Let `writeAll` throw a typed persistence error or return a result. Disable further
  writes after the first failure and expose a non-sensitive one-time warning if persistence matters
  to the user.

## Informational findings

### I-01: Pretty-view search highlighting is globally shared across component instances

- **Severity:** Info
- **Confidence:** 97%
- **Files:** `packages/ui/src/components/detail/PrettyJsonView.tsx:26`,
  `packages/ui/src/components/detail/PrettyJsonView.tsx:89-115`,
  `packages/ui/src/components/detail/DetailPanel.tsx:503-514`
- **Issue:** Every PrettyJsonView registers the same CSS Custom Highlight name. Stacked request and
  response views overwrite each other, and either component's cleanup deletes the other's ranges.
- **Remediation:** Allocate a stable unique name per mounted view or register one combined highlight
  containing ranges from all detail containers.

### I-02: Copy-toast keys remount timers on unrelated renders

- **Severity:** Info
- **Confidence:** 99%
- **Files:** `packages/ui/src/components/detail/DetailPanel.tsx:530-533`,
  `packages/ui/src/components/detail/StateInspectorPanel.tsx:283-286`
- **Issue:** `key={toast.message + Date.now()}` changes on every parent render. Live row updates can
  repeatedly remount the toast and reset its 1.5-second timer.
- **Remediation:** Store a monotonically increasing toast id when the toast is created, or let the
  component reset its timer when message/kind changes.

### I-03: Byte offsets drift with mixed or chunk-split line endings

- **Severity:** Info
- **Confidence:** 96%
- **Files:** `packages/server/src/app-state.ts:358-365`,
  `packages/server/src/app-state.ts:384`
- **Issue:** One `newlineSize` is inferred for the whole decoded chunk. A chunk with mixed LF/CRLF,
  or a CRLF split across chunks, assigns incorrect offsets to some later events.
- **Remediation:** Have the splitter return each line's exact terminator byte count, or derive offsets
  from TailReader's byte offsets rather than rescanning decoded chunks.

### I-04: CSP nonce generation is not cryptographically strong

- **Severity:** Info
- **Confidence:** 100%
- **Files:** `packages/extension/src/webviewHtml.ts:45-51`
- **Issue:** CSP nonces are generated from `Math.random()`. There is no current HTML injection path,
  but CSP nonces are security tokens and should not rely on a predictable PRNG.
- **Remediation:** Use `crypto.randomBytes(16).toString("base64url")` in the extension host.

### I-05: Dead compatibility surfaces and duplicated harness code obscure ownership

- **Severity:** Info
- **Confidence:** 96%
- **Files:** `packages/ui/src/state/store.ts:110-120`,
  `packages/ui/src/state/store.ts:247-298`, `packages/server/src/projector.ts:1-10`,
  `packages/server/src/index.ts:5-6`, `e2e/phase5.spec.ts:13-68`,
  `e2e/phase34.spec.ts:35-90`
- **Issue:** `selectedDetail`, `setSelectedDetail`, and `followLatest` have no production consumers;
  `Projector` is only an alias; the separate health server has no application consumer; and most E2E
  files duplicate process/port/cleanup helpers.
- **Impact:** The real lifecycle and state ownership are harder to understand, and duplicated test
  infrastructure has already diverged into self-starting and externally hosted specs.
- **Remediation:** Remove unused state and obsolete shims after confirming no supported external API
  depends on them. Extract a shared Playwright fixture and a single server/session lifecycle owner.

## Strengths

- The package direction (`shared`/`parser`/`core` → host/server/UI) is clear and reinforced by
  boundary tests and Biome restricted-import rules.
- TypeScript is configured with `strict`, `noUncheckedIndexedAccess`, and
  `exactOptionalPropertyTypes`; all package typechecks pass.
- Unit coverage is broad (1,471 passing tests) and includes real filesystem, SSE, CORS/CSP,
  rotation, parser overflow, reducer, persistence, and virtualization behavior.
- The server binds explicitly to `127.0.0.1`, validates the Host header, caps concurrent SSE
  connections, limits upload size, and avoids reflecting requested paths in normal session-open
  responses.
- Raw JSON rendering uses React text nodes rather than HTML injection, and the project actively
  guards against CDN/telemetry dependencies.
- Parser and correlator code generally use bounded structures and preserve JSON-RPC id type and
  request direction, avoiding common correlation errors.

## Recommended remediation order

1. **Immediate:** C-01 capability-token/origin fix; add regression tests.
2. **Next:** W-01 protocol sync/current chat support, W-02/W-03 tail correctness, W-04 malformed
   detail handling, W-05/W-06 lifecycle/privacy fixes.
3. **Then:** W-07/W-08/W-09 switching/backpressure/large-log architecture.
4. **Quality gate:** W-10/W-11 CI and release correctness before the next publish.
5. **Polish:** W-12 through I-05.

## Review coverage and limitations

The review inventoried all project-owned TypeScript/TSX, workspace manifests, root tooling, CI,
release workflow, unit/integration tests, and Playwright specs. Whole-tree searches covered unsafe
casts, broad catches, timers/listeners, filesystem/network operations, browser storage, rendering,
and lifecycle APIs. Critical runtime paths were read directly across parser, core, host-node, server,
CLI, extension, UI state/transport, and detail/timeline components.

Generated GSD installer files and planning prose were excluded. Generated protocol reducer bodies
were not style-reviewed, but their sync boundary and integration were reviewed against the canonical
sibling repository. The complete Playwright suite was not executed because its harness is not
currently hermetic; this is itself reported as W-10.
