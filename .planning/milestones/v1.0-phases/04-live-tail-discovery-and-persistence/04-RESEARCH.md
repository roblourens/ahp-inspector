# Phase 4: Live Tail, Discovery, and Persistence — Research

**Researched:** 2026-05-07
**Domain:** Filesystem discovery + incremental tail + per-log UI persistence in a local-first Hono/Zustand stack
**Confidence:** HIGH for code-level findings (verified by reading source); MEDIUM for VS Code log conventions (verified on this dev machine, may differ on Linux/Windows); MEDIUM for the canonical AHP JSONL filename pattern (no production extension exists yet).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Discovery and manual open**
- **D-01:** CLI must support a no-file launch mode that opens the app into a log picker/discovery state instead of failing with "log file not found"; passing a file path keeps current direct-open behavior.
- **D-02:** Discovery prioritizes the VS Code log roots already documented in `packages/host-node/src/discovery.ts`: macOS `~/Library/Application Support/Code{,-Insiders}/logs/`, Linux `~/.config/Code{,-Insiders}/logs/`, Windows `%APPDATA%\Code{,-Insiders}\logs\`.
- **D-03:** Candidate matching favors the future canonical AHP JSONL format (`*.jsonl`, especially AHP / agent-host named files). Current `agenthost.*.log`-style files are accepted as lower-confidence candidates only where the existing parser/legacy adapter can handle them safely.
- **D-04:** Manual open is **path-based** (paste/type a path or pick a discovered candidate), not browser file upload. Keeps Node host adapter and watch path intact; avoids copying large/sensitive logs into browser memory.
- **D-05:** Discovered candidates exposed to the browser use opaque IDs plus safe display labels, size, mtime, origin. Full absolute paths may be accepted from a manual-open input and retained server-side, but **must not** be echoed in metadata, row payloads, or routine UI surfaces.

**Active log session lifecycle**
- **D-06:** Add a server-side log-session/catalog layer that can exist with no active log, map safe candidate IDs to real paths, open/switch logs, and own the current `AppState`. Avoid baking a single `AppState` permanently into `startLogServer`.
- **D-07:** When the active log changes: dispose previous `AppState`, clear detail/search caches for the old log, reset the timeline snapshot, reconnect/restart the stream for the new active log.
- **D-08:** The CLI direct-open path becomes a convenience initializer for the same active-log session flow, not a divergent mode.

**Live tail behavior**
- **D-09:** Reuse `TailReader` and the `append`/`patch` SSE frame contract. Phase 4 hardens edge cases and connects UI controls; does not replace the pipeline.
- **D-10:** Appended JSONL lines appear incrementally without reparsing the whole file. Partial trailing lines stay buffered until the newline arrives (preserve `LineSplitter` behavior).
- **D-11:** File truncation, replacement, or rotation must be surfaced explicitly. Do **not** silently ignore shrink events; show a reset/rotation banner and reload from new file contents (or require user reopen, whichever research finds safest).
- **D-12:** Watch/read errors must be user-visible with retry/reopen actions. Existing best-effort silent catches in low-level readers are acceptable only if a higher layer turns them into visible state.

**Pause/resume and reading context**
- **D-13:** Pause/resume is a **live-follow / read-position control**, not a parser shutdown. While paused, the server may continue ingesting and indexing. The UI preserves selection/scroll and shows a "N new events" affordance instead of yanking the user to the bottom.
- **D-14:** Resume reveals/catches up to new rows and optionally jumps to newest, **without** clearing filters, search, selected detail, or grouping.
- **D-15:** If planning finds server-side pause necessary for performance, it must be an explicit secondary optimization. User-facing semantics remain "pause my view, don't lose incoming traffic."

**Persistence**
- **D-16:** Persist theme globally under existing `ahp-theme` preference. Persist log-specific viewer state separately by a stable sanitized log key generated server-side (e.g. hash of canonical path + mtime/size metadata).
- **D-17:** Per-log persistence includes: search query, filters, grouping mode, collapsed groups, selected row when still valid, detail width, live-follow paused/resumed state.
- **D-18:** Persisted state is convenience only. If a log no longer exists, changed identity, or has fewer rows than the saved selected index, the UI degrades cleanly and clears only the invalid pieces.

**UI shape**
- **D-19:** Picker uses existing header/filter visual language: concise discovered-log list newest-first, origin/confidence badges, file size/mtime, clear manual-open path entry.
- **D-20:** Active-log header continues showing safe basename-level metadata + event/session counts; absolute paths are not the dominant UI label.
- **D-21:** Empty states distinguish "server not running" vs "server running, no log selected" vs "no discovered logs found." The no-log state offers manual open + a refresh discovery action.

### the agent's Discretion
- Exact candidate confidence scoring, badge copy, refresh cadence, log-key hash algorithm, and the final placement of pause/resume controls — as long as the locked decisions above are preserved.

### Deferred Ideas (OUT OF SCOPE)
- Full VS Code extension packaging (host boundary stays compatible with a later extension/webview).
- Advanced analytics or new visualization modes beyond live/discovery/persistence.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **INGEST-02** | User can discover likely VS Code / Copilot AHP log files from the app and select one to view. | §1 Discovery (filesystem walk, scoring, candidate API), §6 Server session layer, §7 Picker UI surface. |
| **INGEST-03** | User can manually open a log file when auto-discovery misses it. | §1.4 Manual-open API contract, §6 session.openByPath, §7 ManualOpenInput UI. |
| **INGEST-04** | User can watch a selected log as new JSONL entries are appended without reparsing the entire file. | §3 TailReader hardening (append, partial line, rotation, errors), §6 swap pipeline, §4 SSE append/patch reuse. |
| **INGEST-05** | User can pause and resume live following without losing their place in the log. | §5 View-only pause semantics, store extensions, "N new events" affordance. |
| **SEARCH-05** | Search and filter state persists for the current log where appropriate. | §6.4 Stable log key, §8 localStorage hydration policy, §9 Validation matrix. |

Success criteria (from ROADMAP §Phase 4):
1. Auto-discovered candidates list + pick → covered by §1, §6, §7.
2. Manual open of any log → §1.4, §6, §7.
3. Incremental tail w/o reparsing → §3, §4.
4. Pause/resume preserves selection + scroll → §5.
5. Per-log persistence across reloads, degrades gracefully → §6.4, §8.
</phase_requirements>

---

## Project Constraints (Repository Conventions)

There is no `copilot-instructions.md` at the repo root. The de-facto project rules — confirmed by reading `test/boundary.test.ts`, `test/security.test.ts`, `SECURITY.md`, and the Phase 1–3 SUMMARY notes recorded in `STATE.md` — are:

1. **Loopback-only HTTP.** `startLogServer` hard-codes `127.0.0.1`; tests assert the literal and reject any `0.0.0.0`/`localhost` drift.
2. **Local-first dependency allow-list.** `test/security.test.ts` enforces a closed dependency set. **No new runtime dep should be added in Phase 4** — `chokidar`, `hono`, `zustand`, etc. cover the workspace. If a hash helper or a tiny shallow-equal is needed, prefer Node `crypto` (stdlib) and hand-rolled.
3. **Portable boundary.** `packages/shared`, `packages/parser`, `packages/core` MUST NOT import `node:`, `fs`, `path`, `chokidar`, `react`, `hono`, or `@ahp-inspector/host-node`. UI MUST NOT import `hono`, `@hono/*`, `@ahp-inspector/server`, `@ahp-inspector/host-node`, or `@ahp-inspector/parser/legacy`.
4. **No raw `#hex` literals** in `packages/ui/src/components/`. Add tokens to `tokens.css` (data-theme="dark" only; Phase 5 owns light/hacker overrides).
5. **No absolute paths in metadata, row payloads, or SSE frames.** `LogMeta.filename` is basename only; this rule must extend to discovered-candidate listings (D-05).
6. **`exactOptionalPropertyTypes` is on.** Use conditional spreads (`...(v !== undefined ? { v } : {})`) for optional props; this has bitten plans 03-02, 03-03, 03-04, 03-05.
7. **Direction inference** lives in CLI (`classifyDirection`) and is injected via `directionInference` opt; do not move it server-side.
8. **No watch-mode test flags.** Validation commands run `vitest run` only.
9. **CSP/host-guard middleware** is mounted on every request (`app.use("*", ...)`). Any new endpoint inherits these protections automatically.

[VERIFIED: `packages/server/src/log-server.ts:20`, `packages/server/src/log-server.ts:44-51`, `test/boundary.test.ts:1-40`, `test/security.test.ts:1-50`, `SECURITY.md`]

---

## Executive Summary

Phase 4 is a **lifecycle and integration phase** — almost no greenfield invention. Every primitive needed (chokidar tail, line splitter, EventStore, SearchIndex, SSE fan-out, Zustand store, `connectLogStream`, `NodeHostAdapter`) already exists. The work is:

1. **Lift `AppState` from a process-singleton into a switchable session.** Today `startLogServer({ appState })` baked a single log into the server. Phase 4 needs a `LogSessionManager` that the server holds; `appState` becomes nullable and swappable.
2. **Implement real discovery** in `discoverVsCodeLogs()` (currently `return []`).
3. **Harden `TailReader`** for the three things it doesn't handle today: shrink/truncation, file rename/replace (inode change), and surfacing read/watch errors as a `SsePayload.error` instead of a silent `console.warn`.
4. **Design pause as a UI-only read-position lock.** No server changes required to satisfy the locked semantics; ingest keeps running. Add a `livePaused` + `pendingNewCount` to the store and a "N new events" affordance.
5. **Persist per-log UI state in `localStorage`** keyed by a server-issued stable `logKey` (sha256 of resolved path + size + mtime). Hydrate on `snapshot-end` once the active log is known. Validate before applying (e.g. drop `selectedIdx` if out of range).
6. **Picker UI** — a new `NoActiveLogState` screen that lists candidates and accepts a manual path, plus minor `AppShell` chrome additions for "Switch log", pause toggle, and "N new events" pill.

**Primary recommendation:** plan Phase 4 in **6 waves** mirroring Phase 3's wave shape, gated by a Wave 0 that adds the log-session layer + new SSE error frame contract + `livePaused` store fields + dependency allow-list update (no new deps expected). UI-SPEC IS REQUIRED — see §7.

---

## 1. Discovery — File Layout, Scoring, and API

### 1.1 Real-world VS Code log layout (verified on this machine)

[VERIFIED: `ls ~/Library/Application Support/Code/logs/` on `/Users/roblou`]

```
~/Library/Application Support/Code/logs/
  20260407T223530/                    ← per-launch session timestamp
    main.log
    sharedprocess.log
    ptyhost.log
    mcpGateway.log                    ← interesting: MCP gateway log per session
    window1/
      exthost/
        GitHub.copilot-chat/
          GitHub Copilot Chat.log
        vscode.github/...
    window2/...
```

The real layout is `<root>/<launchTimestamp>/window<N>/exthost/<extId>/<filename>`. There is **no current AHP JSONL file in production VS Code installs** — the working assumption (D-03) is that future Copilot/AHP code will land its protocol log either under an `exthost/<copilot-extId>/` folder or directly under the per-launch directory, with a `.jsonl` extension and a name containing `agenthost`, `agent-host`, `ahp`, or `copilot-chat`.

[ASSUMED] AHP-aware extensions will write JSONL with one of the names: `agenthost.*.jsonl`, `agent-host*.jsonl`, `ahp*.jsonl`, or potentially the literal `copilot-chat.jsonl`. The plan should match a permissive set and let scoring (§1.3) pick winners.

### 1.2 Bounded walk strategy

Naive `glob('**/*.jsonl')` over the logs root would walk hundreds of stale per-launch directories. Recommended bounded walk:

1. List immediate children of each root (`Code/logs/`, `Code-Insiders/logs/`, on every applicable platform). Each child is a launch-timestamp dir.
2. Sort by name desc (timestamps sort lexicographically) **or** by `mtimeMs` desc; take **top N=10** newest sessions. Configurable but capped at 50.
3. For each session, walk only:
   - the session dir itself (depth 1) for `*.jsonl` and known AHP basenames
   - `window*/exthost/*/` (depth 3) for the same patterns
4. Hard-cap **total file stats at 5000** and total walk time at **1500 ms** (`AbortController` + `Date.now()` budget). Beyond cap, return what was found and tag the response `truncated: true`.

[VERIFIED: layout above; bounding strategy is a design recommendation — no equivalent code exists yet.]

### 1.3 Confidence scoring

Each candidate gets a numeric score (don't expose to UI; map to badge `high|medium|low`):

| Signal | Points |
|--------|--------|
| Filename matches `^(agenthost\|agent-host\|ahp).*\.jsonl$` | +50 |
| Filename matches `.*(agent-host\|ahp\|copilot-chat).*\.jsonl$` | +30 |
| Filename matches `^agenthost\..*\.log$` (legacy adapter) | +15 |
| Located under `exthost/GitHub.copilot-chat/` (or any folder containing `copilot`) | +20 |
| `mtimeMs` within last 1 h | +15 |
| `mtimeMs` within last 24 h | +5 |
| `sizeBytes > 0` | +5 |
| `sizeBytes` is suspiciously huge for a .log (>500 MB) | -10 |

Map: `>=50 → "high"`, `>=20 → "medium"`, else `"low"`. Default sort: confidence desc, then mtime desc.

[ASSUMED] These thresholds — refine after first run on a real AHP-emitting build.

### 1.4 Discovery + manual-open API contract

New endpoints under `/api/sessions/*` (the existing `/api/log/*` namespace stays the active-log API):

```ts
// GET /api/sessions/discover  →  { candidates: SafeCandidate[], truncated: boolean }
interface SafeCandidate {
  id: string;            // opaque, server-side map → absolute path; sha256 of path (32 hex chars)
  label: string;         // basename + " · " + sessionTimestamp; NEVER absolute path (D-05)
  origin: "vscode-stable" | "vscode-insiders" | "manual";
  confidence: "high" | "medium" | "low";
  mtimeMs: number;
  sizeBytes: number;
  // Optional contextual breadcrumb for the picker (still no abs path):
  // e.g. "20260407T223530 / window1 / exthost / GitHub.copilot-chat"
  contextLabel?: string;
}

// POST /api/sessions/open    body: { id: string } | { path: string }
//   → 200 { active: { logKey: string, meta: LogMeta } }
//   → 404 { code: "not-found", message }
//   → 400 { code: "not-a-file" | "not-readable" | "path-too-long" }
//
// POST /api/sessions/close   → 200 { active: null }
// GET  /api/sessions/active  → 200 { active: { logKey, meta } | null }
```

`POST /api/sessions/open` accepts **either** an opaque candidate `id` (resolved via the in-memory map populated by the last `discover` call) OR a raw `path` typed by the user (the only API that ever takes a real path from the browser). Path inputs are length-capped (e.g. 4096) and pass through `NodeHostAdapter.openLog()` which already returns safe basename-only errors.

The existing `GET /api/log/meta` and `GET /api/log/stream` continue to operate against the currently active log. When no log is active, `/api/log/meta` returns `204 No Content` (or `200 { active: null }` — pick one and use it consistently); the SSE stream returns `409 Conflict` with body `{ code: "no-active-log" }`.

---

## 2. Active Log Session Lifecycle (Server Refactor)

### 2.1 Current shape

[VERIFIED: `packages/server/src/log-server.ts:22-51`]

`LogServerOptions.appState` is required and frozen at boot. `registerLogRoutes`, `registerDetailRoutes`, `registerSearchRoutes` all close over the same single `appState`.

### 2.2 Recommended shape

Introduce `LogSessionManager` in `packages/server/src/session-manager.ts`:

```ts
export interface ActiveSession {
  readonly logKey: string;        // sha256(path + ':' + size + ':' + mtimeMs); 16-32 hex chars
  readonly appState: AppState;
}

export interface LogSessionManager {
  current(): ActiveSession | null;
  open(opts: { path: string }): Promise<ActiveSession>;
  close(): Promise<void>;
  /** Subscribe for active-log change events; emits null on close. */
  onChange(listener: (active: ActiveSession | null) => void): () => void;
}
```

Route layer becomes:

```ts
// log-server.ts
const sessions = createLogSessionManager({ host, directionInference, version });
app.get("/api/log/meta", (c) => {
  const a = sessions.current();
  if (!a) return c.body(null, 204);
  return c.json(a.appState.meta);
});
registerLogRoutes(app, sessions);    // SSE route reads sessions.current() per connection
registerDetailRoutes(app, sessions);
registerSearchRoutes(app, sessions);
registerSessionRoutes(app, sessions); // discover/open/close/active
```

**SSE behavior on log switch:** when `sessions.onChange` fires, the existing SSE route emits a `log-reset` event then `bye` and closes the stream. The browser client reopens automatically (see §4.4).

[VERIFIED: routes and patterns from `packages/server/src/sse-routes.ts:17-95`]

### 2.3 CLI as a session initializer

[VERIFIED: `packages/cli/src/index.ts:97-151`]

The CLI's `if (!file)` branch currently calls `fail(...)`. Replace with: if a file is given, after building the server call `await sessions.open({ path: absPath })`. If no file is given, just start the server and let the picker UI drive `POST /api/sessions/open`. **Do not** create a separate `appState` and pass it to `startLogServer` — `LogSessionManager` owns it now.

The pre-existing `start:fixture` and `start:long` pnpm scripts continue to work because they pass a path.

### 2.4 Disposal sequence on log switch

For each switch (D-07):

1. Old `AppState.dispose()` (already async; clears watcher, flush timer, store subscription, correlator, listeners, awaits `host.close()`).
2. Emit `log-reset` to current SSE subscribers, then `bye`.
3. Construct new `AppState` via `createAppState({ host, file: newPath, directionInference, ... })`.
4. Compute new `logKey`.
5. Notify listeners with the new `ActiveSession`.

Detail/search caches are per-process by route handler closure; nothing to clear on the server side because `eventAt` and `searchIndex` live on the new `AppState`. **UI must clear** `useAppStore.getState().clearSelection()` + `setSelectedDetail(null)` + invalidate the http-client `cache` (export `clearEventCacheForTests` and rename to `clearEventCache` for production reuse).

---

## 3. Live Tail Hardening

### 3.1 Inventory of current behavior

[VERIFIED: `packages/host-node/src/tail-reader.ts:1-122`, `packages/parser/src/jsonl.ts:1-79`, `packages/server/src/app-state.ts:207-236`]

Already correct:
- Initial read seeds `lastOffset = sizeAtStart`.
- `chokidar.watch` with `ignoreInitial: true` produces incremental reads from `lastOffset` to `nextSize`.
- Reads are coalesced (`#readInFlight`) so rapid `change` bursts don't stack tail reads.
- `LineSplitter` buffers partial trailing lines until newline, strips a one-time leading BOM, throws `ParseOverflowError` past `MAX_BUF_BYTES` (16 MiB).
- AppState handles `ParseOverflowError` by emitting `{ kind: "error", code: "parse-overflow" }` to subscribers.
- `byteOffset` accounting handles CRLF vs LF.

### 3.2 Gaps to close in Phase 4

| # | Gap | Where | Phase 4 fix |
|---|-----|-------|-------------|
| G1 | **Shrink / truncation silently ignored** — `nextSize <= lastOffset` returns without notice. | `tail-reader.ts:89` | Detect `nextSize < lastOffset` separately; emit a new `ChunkSink` companion signal `onReset({ newSize })` (or change `ChunkSink` to a richer event). AppState propagates `{ kind: "rotation", newSize }` SSE frame; UI shows banner and reloads from snapshot. |
| G2 | **File rename / inode swap** not detected. chokidar `change` only fires for in-place writes. Some loggers rotate via rename + recreate. | `tail-reader.ts` startWatch | Listen for `unlink` and `add`. On `unlink` followed by `add` with smaller size: treat as rotation (same handler as G1). |
| G3 | **Initial-read failure swallowed** — `NodeHostAdapter.watchLog` catches and silently disposes. | `host-adapter.ts:62-65` | Add an `onError` channel (extend `ChunkSink` to a `WatchSink { onChunk; onReset?; onError? }`); AppState surfaces as `{ kind: "error", code: "read-error", message }` SSE frame. |
| G4 | **Mid-tail read errors logged via `console.warn`**. | `tail-reader.ts:107-110` | Route through `onError` channel above. |
| G5 | **Watcher disposal can hang** — `void this.#watcher.close()` is fire-and-forget. | `tail-reader.ts:118` | `await` it inside an `async dispose()`; AppState already awaits via the chain. |
| G6 | **No periodic `fs.stat` fallback**. Some macOS/Linux network filesystems don't fire chokidar `change`. | new | Add a low-rate (2-5s) stat poll that triggers `#readTail` if `nextSize !== lastOffset`. Only enabled when chokidar reports `usePolling: false` and the user opts in via env. **Optional** — flag and discuss before building. |

### 3.3 Recommended `WatchSink` shape

```ts
export interface WatchSink {
  onChunk(bytes: Uint8Array, byteOffset: number): void;
  /** File shrank or was replaced. Caller MUST drop buffered state. */
  onReset(info: { newSize: number; reason: "shrink" | "rename" }): void;
  /** Persistent watch error. Caller should surface to UI. */
  onError(err: Error, fatal: boolean): void;
}
```

Backwards-compat shim: keep the old function-only signature working via an adapter so the existing `app-state.ts` ingest closure refactors cleanly.

### 3.4 SSE frame additions

Extend `SsePayload` (in `app-state.ts`):

```ts
| { kind: "rotation"; newSize: number; reason: "shrink" | "rename" }
| { kind: "watch-error"; code: "read-error" | "watch-fatal"; message: string }
```

The existing `error` kind is reused for `parse-overflow`. Add `rotation` and `watch-error` so the UI can render distinct affordances.

When a `rotation` frame arrives, the SSE route sends it, the UI clears `rows`, sets `connection = "connecting"`, and optimistically reopens the stream which will emit a fresh snapshot from the truncated/replaced file.

---

## 4. SSE Client Changes

### 4.1 New events

In `packages/ui/src/transport/sse-client.ts`:

- Listen for `event: rotation` — call store action `resetForRotation()` which clears `rows`, `selectedIdx`, `selectedDetail`, `searchMatches` (preserves `filters`, `searchQuery`, `grouping`). Then close the EventSource and reopen.
- Listen for `event: watch-error` — set `connection = "disconnected"` and store the error message in a new `lastWatchError` slot for the existing `DisconnectedBanner` to render.
- Listen for `event: log-reset` (emitted when an admin/UI triggers a log switch) — same as rotation, but additionally clear `meta` so the picker UI knows to fetch the new active session.

### 4.2 Log-switch reconnect

After `POST /api/sessions/open` resolves, the UI:

1. Closes the current EventSource (if any) via the existing `ConnectionHandle.close()`.
2. Calls `useAppStore.getState().resetForLogSwitch()` (clears rows + selection + search matches; preserves theme; **clears** filters/search/grouping by default unless persistence rehydrate is in progress).
3. Calls `connectLogStream()` again.

The persistence layer (§8) hydrates **after** snapshot-end, so the order is: open → connect → snapshot → hydrate persisted state → re-run search if needed.

### 4.3 No-active-log handling on initial probe

Today `App.tsx` probes `/api/log/meta`. If response is `204` (no active log), the UI must set a new `connection` state value `"no-log"` (added to `Connection` type) instead of `"no-server"`. Render `NoActiveLogState` (new component) instead of `ServerNotRunningState`.

`Connection` type becomes: `"connecting" | "connected" | "disconnected" | "no-server" | "no-log"`.

---

## 5. Pause / Resume

### 5.1 Locked semantics → minimal design

D-13/14/15 explicitly forbid dropping events on pause. Therefore **server-side does nothing**. Pause is purely a UI viewport/follow toggle.

### 5.2 Store extensions

```ts
// store.ts additions
livePaused: boolean;            // false by default; toggled by user
pendingNewCount: number;        // number of rows appended since pause began
followLatest: boolean;          // when true and not paused, scroll auto-follows tail
setLivePaused(p: boolean): void;
clearPendingNewCount(): void;
```

`appendRows` action:
- always appends to `rows` (no behavior change).
- when `livePaused === true`, increments `pendingNewCount` by `newRows.length`.
- when `livePaused === false`, leaves `pendingNewCount` at 0.

### 5.3 UI affordance

- **Pause toggle button** in `HeaderBar` (or a new `LiveControlsStrip`); icon `Pause`/`Play` from `lucide-react`.
- **"N new events" pill** docked at the bottom of `TimelineRegion` when `livePaused && pendingNewCount > 0`. Clicking calls `clearPendingNewCount()` and scrolls TanStack-Virtual to the last row index. Selection is preserved.
- **Scroll preservation**: `TimelineRegion` already restores scrollOffset on rerender via TanStack Virtual. The trick is to **not call `virtualizer.scrollToIndex(rows.length - 1)` when paused**. Today there is no auto-follow; scroll just stays where the user left it on append. So the only positive change needed is the pill; the "preserve selection on append" requirement is already satisfied because `selectedIdx` is keyed by row index and append never moves indices below `from`.
- **Resume** clears `pendingNewCount`; if `followLatest === true` (default), also `scrollToIndex(rows.length - 1)`.

[VERIFIED: TanStack Virtual is already in use; `appendRows` mutates by index so existing selection is stable — `packages/ui/src/state/store.ts:87-100`]

### 5.4 Per-log persistence of pause state

Persist `livePaused` per log (D-17). On rehydrate, if pause was on, render the pill with `pendingNewCount = 0` and let new appends populate it. Don't auto-pause if the user never paused — restoring `livePaused: true` on reload only when the persisted value is true.

---

## 6. Persistence

### 6.1 Stable log key

Server-issued, deterministic, non-reversible. Recommendation:

```ts
import { createHash } from "node:crypto";
function computeLogKey(absPath: string, sizeBytes: number, mtimeMs: number): string {
  const h = createHash("sha256");
  h.update(absPath);
  h.update("\u0000");
  h.update(String(sizeBytes));
  h.update("\u0000");
  h.update(String(Math.floor(mtimeMs))); // ms granularity is fine
  return h.digest("hex").slice(0, 32);   // 128 bits is plenty
}
```

Key is exposed to the browser via `GET /api/log/meta` and `GET /api/sessions/active`. Since size+mtime change as a log grows, **the key would drift on every write** if computed naively. Two options:

- **Option A (recommended): compute logKey from `absPath` + initial `mtimeMs` only**, captured at `openLog()` time, so a single AHP session keeps a stable key for its lifetime even as it grows. A truly different file (different path, or same path after a rotation reset) gets a new key.
- Option B: hash path only — too aggressive; persisted state from a stale prior log re-applies after the file is overwritten with unrelated content.

Recommend Option A. Document explicitly in the plan.

### 6.2 LogMeta extension

```ts
interface LogMeta {
  readonly filename: string;
  readonly sizeBytes: number;
  readonly startedAt: number;
  readonly logKey: string;     // NEW — stable identifier for client persistence
}
```

### 6.3 Storage shape (browser localStorage)

Single key `ahp-log-prefs-v1` containing a Map keyed by `logKey`:

```ts
interface PerLogPrefs {
  v: 1;
  searchQuery: string;
  filters: FilterState;            // existing shape from state/filters.ts
  grouping: GroupingMode;
  groupCollapsed: string[];        // Set serialized as array
  selectedIdx: number | null;
  detailWidth: number;
  livePaused: boolean;
}
type Storage = { [logKey: string]: PerLogPrefs };
```

LRU-cap at **50 entries** to prevent localStorage bloat; evict oldest on insert.

### 6.4 Hydration / persistence flow

1. **Hydrate** — fires once on `snapshot-end` (logKey is now known via `meta.logKey`). Read `Storage[logKey]`. If present:
   - `setSearchQuery`, `setFilters`, `setGrouping`, restore `groupCollapsed` Set, `setDetailWidth`, `setLivePaused`.
   - For `selectedIdx`: only re-select if `idx < rows.length` (D-18). If valid, call existing `selectIdx(idx)` which triggers detail fetch.
2. **Persist** — subscribe to store changes after hydration. Debounce 250 ms. Write back the slice. Use `useAppStore.subscribe((s) => slice)` with shallow compare, **not** `subscribeWithSelector` (that's a Zustand middleware — would require updating allow-list; keep stdlib `subscribe` + manual prev/next compare).
3. **Wrap localStorage** in try/catch; quota errors silently degrade (the app already does this for theme).
4. **Reset on log switch** — when `meta.logKey` changes, persist the prior log's slice immediately, then hydrate the new one (or clear if absent).

[VERIFIED: existing pattern in `packages/ui/src/components/shell/HeaderBar.tsx:48-54` (theme persistence)]

### 6.5 What does NOT persist

- `connection` (transient).
- `selectedDetail` payload (re-fetched from `selectedIdx`).
- `searchMatches` (re-derived by re-running search after hydration).
- `pendingNewCount` (always starts at 0 on load).
- `meta`, `rows` (server-driven).

---

## 7. UI Planning Notes — UI-SPEC IS REQUIRED

Phase 4 introduces **at least three new screen-level surfaces** and modifies the chrome. Phase 2 and Phase 3 both produced UI-SPECs; Phase 4 must too. Recommend running `/gsd-ui-phase 4` after research and before planner.

### 7.1 New surfaces

| Surface | Trigger | Key elements |
|---------|---------|--------------|
| `NoActiveLogState` (full-page) | `connection === "no-log"` | Heading "No log open", discovered-candidates list, `ManualOpenInput`, "Refresh" button, link "How to find your VS Code logs" (no telemetry, just docs). Uses Phase 2 chrome. |
| `LogPickerPanel` (overlay/sheet) | "Switch log" button | Same content as `NoActiveLogState` minus the heading; non-modal so user can cancel without losing current view. |
| `ManualOpenInput` (composite) | inside both above | Path input (max 4096), "Open" button, error region (errors echo basename only, never typed-path tail). |
| `LiveControlsStrip` or addition to `HeaderBar` | always visible when `connection === "connected"` | Pause/Play toggle, optional follow-latest toggle. |
| `NewEventsPill` | bottom of `TimelineRegion` when `livePaused && pendingNewCount > 0` | "N new events · Resume" / "N new events · Jump". |
| `RotationBanner` | inside `TimelineRegion` after `rotation` SSE frame for 5s | "Log rotated — reloaded from new file." |
| `WatchErrorBanner` | replaces `DisconnectedBanner` content when `lastWatchError` set | Error code + retry button. |

### 7.2 Items the UI-SPEC must lock

- Layout of the discovered-candidates list (rows: confidence dot · basename · `mtimeMs` relative · `sizeBytes` formatted · origin chip · context label). Locked: no absolute path text.
- Sort order, default = confidence desc then mtime desc.
- Empty state copy for "no candidates found": guidance to use manual open + a path hint.
- Manual-open input width, validation, error copy verbatim.
- Pause/follow icons, color when paused (use existing accent), keyboard shortcut (suggest `Space` or `p`; verify against existing Phase 3 keymap — Phase 3 reserves `/`, `f`, `Esc`, arrows, `Home`/`End`).
- `NewEventsPill` placement (bottom-center, 16 px from bottom of timeline region).
- RotationBanner & WatchErrorBanner copy.

### 7.3 Tokens to add

Likely additions to `tokens.css`:

- `--color-status-paused-fg`, `--color-status-paused-bg` for the pause indicator.
- `--color-pill-bg`, `--color-pill-fg`, `--color-pill-border` for `NewEventsPill`.
- `--color-confidence-high|medium|low` (small dots in the picker).
- `--color-banner-rotation-bg|fg`, `--color-banner-watch-error-bg|fg`.

All values inside `[data-theme="dark"]` only; Phase 5 owns light/hacker.

### 7.4 Browser UAT screenshots

Following Phase 3 convention, capture under `screenshots/phase4-*.png`:

- `phase4-no-log-state.png` — fresh launch with no path
- `phase4-discovered-candidates.png` — populated picker
- `phase4-manual-open-error.png` — invalid path validation
- `phase4-live-paused.png` — pause indicator + `NewEventsPill`
- `phase4-rotation-banner.png` — captured by truncating a fixture mid-tail
- `phase4-persisted-restore.png` — reload showing filters/grouping/selection restored

---

## 8. Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`. Section is required.

### 8.1 Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + jsdom for UI; native Node for server/host |
| Config files | `vitest.config.ts`, `packages/ui/vitest.config.ts` |
| Quick run | `pnpm -F @ahp-inspector/<pkg> test` for changed package |
| Full suite | `pnpm test && pnpm -F @ahp-inspector/ui build && pnpm -F @ahp-inspector/cli build && pnpm typecheck && pnpm lint` |
| Browser UAT | `playwright-cli` skill (see `.github/skills/playwright-cli/`), screenshots committed under `screenshots/phase4-*` |

### 8.2 Phase Requirements → Test Map

| Req | Behavior | Test Type | Command | File Exists? |
|-----|----------|-----------|---------|--------------|
| INGEST-02 | `discoverVsCodeLogs()` returns scored candidates from a temp tree mimicking real VS Code layout | unit | `pnpm -F @ahp-inspector/host-node test src/discovery.test.ts` | ❌ Wave 0 |
| INGEST-02 | Discovery walk is bounded (file/time cap; 5000-stat ceiling); returns `truncated: true` | unit | same as above, `--bounded` test case | ❌ Wave 0 |
| INGEST-02 | `GET /api/sessions/discover` returns SafeCandidate[] with no abs paths | integration | `pnpm -F @ahp-inspector/server test src/session-routes.test.ts` | ❌ Wave 0 |
| INGEST-02 | UI `NoActiveLogState` lists candidates and selects one via `POST /api/sessions/open` | jsdom | `pnpm -F @ahp-inspector/ui test src/components/states/NoActiveLogState.test.tsx` | ❌ Wave 2 |
| INGEST-03 | `POST /api/sessions/open` accepts a typed path; rejects non-file with safe error | integration | `session-routes.test.ts` | ❌ Wave 0 |
| INGEST-03 | UI `ManualOpenInput` validates length and renders basename-only errors | jsdom | `ManualOpenInput.test.tsx` | ❌ Wave 2 |
| INGEST-04 | `TailReader` initial read + chokidar append with byte-accurate offset (LF and CRLF) | unit | `pnpm -F @ahp-inspector/host-node test src/tail-reader.test.ts` | ❌ Wave 1 |
| INGEST-04 | `TailReader` shrink → `onReset({reason:"shrink"})` | unit | `tail-reader.test.ts` | ❌ Wave 1 |
| INGEST-04 | `TailReader` rename/replace → `onReset({reason:"rename"})` | unit | `tail-reader.test.ts` | ❌ Wave 1 |
| INGEST-04 | Read-error → `onError(err, fatal)`, propagated to AppState as `watch-error` SSE frame | integration | `pnpm -F @ahp-inspector/server test src/app-state.test.ts` | ⚠ extends existing |
| INGEST-04 | Append while paused does not lose events; UI `pendingNewCount` increments | jsdom | `pnpm -F @ahp-inspector/ui test src/state/store.test.ts` | ❌ Wave 2 |
| INGEST-05 | Pause toggle preserves `selectedIdx` and scroll across appends | jsdom | `pnpm -F @ahp-inspector/ui test src/components/timeline/TimelineRegion.test.tsx` | ⚠ extends existing |
| INGEST-05 | `NewEventsPill` resumes and jumps to latest | jsdom | `NewEventsPill.test.tsx` | ❌ Wave 2 |
| SEARCH-05 | `logKey` is stable for the lifetime of an open log; differs across paths | unit | `pnpm -F @ahp-inspector/server test src/log-key.test.ts` | ❌ Wave 0 |
| SEARCH-05 | localStorage hydration restores searchQuery/filters/grouping/selectedIdx/detailWidth/livePaused | jsdom | `pnpm -F @ahp-inspector/ui test src/state/persistence.test.ts` | ❌ Wave 0 |
| SEARCH-05 | Hydration drops out-of-range `selectedIdx` and unknown filter values | jsdom | `persistence.test.ts` | ❌ Wave 0 |
| SEARCH-05 | Switching logs persists the prior slice and hydrates the new one | jsdom | `persistence.test.ts` | ❌ Wave 3 |
| ALL | Vertical-slice: discover → open → tail → pause → resume → reload restores state | integration | `pnpm test test/phase4-vertical-slice.test.ts` | ❌ Wave 5 |
| ALL | Browser UAT screenshots captured | manual | `playwright-cli` per scenario in §7.4 | ❌ Wave 5 |

### 8.3 Sampling Rate

- **Per task commit:** package-scoped `pnpm -F @ahp-inspector/<pkg> test`.
- **Per wave merge:** `pnpm test`.
- **Phase gate:** full suite green + browser UAT recorded before `/gsd-verify-work`.

### 8.4 Wave 0 Gaps

- [ ] `packages/host-node/src/discovery.test.ts` — covers INGEST-02 walk, scoring, bounding.
- [ ] `packages/server/src/session-manager.ts` + `.test.ts` — open/close/switch lifecycle.
- [ ] `packages/server/src/session-routes.ts` + `.test.ts` — discover/open/close/active endpoints, no-abs-path assertion.
- [ ] `packages/server/src/log-key.ts` + `.test.ts` — stable hash function.
- [ ] `packages/ui/src/state/persistence.ts` + `.test.ts` — hydrate/persist/clear with localStorage mock.
- [ ] Extend `test/security.test.ts` only if a new dep is added (not expected).

---

## 9. Security / Privacy Domain

ASVS categories applicable for Phase 4:

| Category | Applies | Standard Control |
|----------|---------|------------------|
| V2 Authentication | no | local loopback only |
| V3 Session Management | no | single-user local app |
| V4 Access Control | yes | host-guard middleware rejects non-loopback Host headers (already in place) |
| V5 Input Validation | yes | path length cap + `NodeHostAdapter.openLog` stat-based rejection; opaque candidate IDs |
| V6 Cryptography | yes | sha256 via `node:crypto` for `logKey` only — no secrets, no signing |
| V7 Error Handling | yes | basename-only error messages (existing pattern); never echo typed path back to UI verbatim |
| V8 Data Protection | yes | logKey is non-reversible; localStorage stores only UI prefs, never log content |
| V12 File Resources | yes | bounded discovery walk; chokidar disposed on switch; size/time caps |

### Threat patterns

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Path leak via API responses | Information Disclosure | `SafeCandidate` strips path; `LogMeta` is basename only; opaque IDs |
| Path traversal via `POST /api/sessions/open` | Tampering | Path is `path.resolve()`'d; only opened if `statSync().isFile() && R_OK`. **No chroot intentionally** (per existing host-adapter design comment) — user explicitly typed the path. |
| Discovery DoS via giant log tree | DoS | File-stat cap (5000), wall-clock cap (1500 ms), session-dir cap (top 50) |
| Tail DoS via infinite line (no newline) | DoS | Existing `LineSplitter` `MAX_BUF_BYTES = 16 MiB` → `ParseOverflowError` → `error` SSE frame |
| localStorage poisoning | Tampering | Versioned schema (`v: 1`); validate types; drop entries that fail validation |
| Stale persisted `selectedIdx` pointing past end | Logic / UX bug | Range check before re-select |
| Cross-log state leak after rotation | Confidentiality | `logKey` includes initial mtime; rotated file gets a new key on next open |
| Watch resource leak after stream close | DoS | `AppState.dispose()` already awaits chokidar close; `LogSessionManager.close()` chains it |

---

## 10. Candidate Wave Breakdown

Mirrors Phase 3's 7-plan/6-wave shape.

- **Wave 0 — Foundation** (one plan)
  - `LogSessionManager` skeleton + interface; `logKey` hash + tests; new SSE payload kinds (`rotation`, `watch-error`, `log-reset`); `LogMeta.logKey` field; `WatchSink` interface in shared; `Connection = "no-log"` added to UI store; persistence module skeleton + tests using mocked storage.
- **Wave 1 — Discovery + Tail Hardening** (two parallel plans)
  - 1a: `discoverVsCodeLogs()` real implementation + scoring + bounded walk + tests.
  - 1b: `TailReader` shrink/rename/error handling + `WatchSink` adoption + AppState wiring + integration tests.
- **Wave 2 — Server session layer + new endpoints** (one plan, blocks Wave 3)
  - `LogSessionManager` real impl; route handlers refactored to read `sessions.current()`; `/api/sessions/*` endpoints; CLI as initializer (no-file path); meta returns 204 when no active log.
- **Wave 3 — UI: NoActiveLogState + Picker + ManualOpen + log switch** (two parallel plans, blocked on Wave 2)
  - 3a: NoActiveLogState, LogPickerPanel, ManualOpenInput components + tests.
  - 3b: SSE client extensions (rotation/log-reset/watch-error); `connectLogStream` reconnect on switch; http-client cache invalidation; AppShell switch-log button.
- **Wave 4 — UI: Pause/Resume + persistence wiring** (one plan)
  - Store extensions (`livePaused`, `pendingNewCount`, `setLivePaused`); `LiveControlsStrip` or HeaderBar additions; `NewEventsPill`; persistence hydrate/persist effect mounted at AppShell.
- **Wave 5 — Vertical slice + UAT + USER_GUIDE update** (one plan)
  - `phase4-vertical-slice.test.ts`; browser UAT screenshots; USER_GUIDE additions for picker, pause, persistence; `nyquist` validation gate.

Total: **7 plans across 6 waves**, parallelizable in Waves 1 and 3.

---

## 11. Risks and Open Questions

### Risks

| # | Risk | Mitigation |
|---|------|-----------|
| R1 | The canonical AHP JSONL filename is unknown — discovery scoring may catch zero candidates on real machines until a Copilot build emits AHP logs. | Make the matching set permissive; allow manual-open as the always-available fallback (D-04); document expected filename patterns in USER_GUIDE so future Copilot teams emit compatible names. |
| R2 | chokidar on macOS uses fsevents (already a transitive dep, no new install needed); on Linux uses inotify; on Windows uses ReadDirectoryChangesW. Behavior on network filesystems is unreliable. | Document that network-mounted log files are not supported in v1; keep the optional poll fallback (§3.2 G6) deferred. |
| R3 | Refactoring `startLogServer` to drop required `appState` is a public-ish API change — every existing test that builds a server passes `{ appState }`. | Keep the old call signature working by accepting either `{ appState }` or `{ sessions }` for one phase; remove the old shape in Wave 5 cleanup. |
| R4 | localStorage quota could be hit when 50 logs each have large `groupCollapsed` sets. | LRU cap; cap each `groupCollapsed` array at e.g. 1000 keys before persisting. |
| R5 | Persistence rehydration could race with snapshot completion if implemented as a `useEffect` watching `meta.logKey`. | Hydrate inside the `snapshot-end` handler in `sse-client.ts` (synchronous after store.setRows), not via a UI effect. |
| R6 | Pause + filters: when paused, search results may go stale because new appended rows aren't searched. | Re-run search on resume; document this small lag; do not block ingest. |

### Open Questions

> **Status (resolved during phase planning, post-CONTEXT/UI-SPEC):** All open questions below are now resolved or formally deferred. See annotations.

1. **Q1: Should `livePaused` be persisted by default?** D-17 says yes. Confirm — restoring `paused: true` on every reload could surprise users who paused once. Recommend persisting but adding a small "Live (paused)" indicator so it's discoverable. *(Defer to UI-SPEC.)* — **RESOLVED:** D-17 (locked) + UI-SPEC §3 LivePauseButton + §6.4 persistence flow lock `livePaused` as part of per-log persisted state. The accent-tinted Pause/Play chip with `aria-pressed` provides the discoverability indicator. Implemented by Plan 04-06.
2. **Q2: Should the "Switch log" UI fully reset or remember per-log persisted state?** Locked decision (D-17/D-18) implies remember per-log. Confirm at UI-SPEC. — **RESOLVED:** D-18 + UI-SPEC §6.4 specify per-log storage keyed by `logKey` with synchronous flush of the previous log's prefs on switch and rehydration of the new log's prefs on snapshot-end. Implemented by Plan 04-06 Task 3 (`usePersistEffect`).
3. **Q3: Polling fallback for NFS/SMB watchers (§3.2 G6)?** Recommend defer to v2. — **RESOLVED (deferred to v2):** Confirmed out of scope for Phase 4. UI-SPEC §G6 notes a future `WatchErrorBanner` variant could surface it without new UI; no plan task allocated.
4. **Q4: Candidate confidence thresholds (§1.3)?** First-pass values are guesses; tune after running on a real AHP-emitting build. Plan to log scoring details to a debug endpoint behind an env flag in Wave 1. — **RESOLVED:** Plan 04-01 fixes the scoring constants used by `discoverCandidates()` and exposes them as named constants for future tuning. Tuning against a real AHP build is post-phase telemetry, not a Phase 4 blocker.
5. **Q5: Should manual-open accept relative paths?** `NodeHostAdapter.openLog()` does `path.resolve(process.cwd(), path)`. For a server launched via the CLI, `cwd` is the user's terminal cwd which is fine. For a server launched headlessly later, behavior is undefined. Recommend documenting "absolute paths recommended" in the input help text. — **RESOLVED:** UI-SPEC §ManualOpenInput locks the help-text copy ("Absolute path recommended.") and error code → fixed-copy mapping. Server still accepts relative paths (resolved against `cwd`); UX guidance steers users toward absolute.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The canonical AHP JSONL file pattern will be `agenthost*.jsonl` or `*ahp*.jsonl` | §1.1, §1.3 | Discovery returns zero matches on real installs until pattern set is updated. Manual-open mitigates. |
| A2 | Confidence scoring thresholds (50/20) are sensible | §1.3 | Picker may rank wrong logs first; harmless and tunable. |
| A3 | sha256 truncated to 128 bits (32 hex) is collision-safe for ≤ thousands of logs per machine | §6.1 | Two logs collide → wrong persisted state restored. Acceptable risk; can extend to 256 bits at zero cost. |
| A4 | Persisted `livePaused: true` is the desired UX after reload | §5.4, §6 | User confusion. Resolve in UI-SPEC. |
| A5 | chokidar `unlink`+`add` reliably indicates rotation across macOS/Linux/Windows | §3.2 G2 | Some platforms may fire `change` only; rotation undetected. Add periodic stat poll as fallback. |
| A6 | No new runtime dep is required for Phase 4 | §Project Constraints | A missed need (e.g. for shallow compare) would force a `test/security.test.ts` allow-list patch + plan justification. |
| A7 | `fsevents` and the macOS recursive watch behavior cover the per-launch session subdirs we'd want to monitor (we only watch the *active* log file, not the discovery tree, so this is moot for tail; only relevant if we add live-refresh of the discovery list) | §3 | If we ever add live discovery refresh, watching trees of thousands of files could exhaust file handles. Manual "Refresh" button avoids this. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node ≥ 22 | runtime | ✓ | (project engines field) | — |
| pnpm 9.15.0 | builds | ✓ | declared `packageManager` | — |
| chokidar | tail/watch | ✓ | already installed (allow-listed) | — |
| node:crypto | logKey hash | ✓ | stdlib | — |
| `playwright-cli` skill | UAT | ✓ | `.github/skills/playwright-cli/` present | manual screenshots |
| Real VS Code log emitting AHP JSONL | end-to-end UAT | ✗ | — | Synthetic fixtures + manual-open path; ship synthetic fixture under `test/fixtures/discovery/` mimicking real layout. |

---

## Sources

### Primary (HIGH — verified by reading source in this session)
- `packages/host-node/src/discovery.ts` (current stub returning `[]`)
- `packages/host-node/src/host-adapter.ts` (NodeHostAdapter, basename-only errors, watchLog)
- `packages/host-node/src/tail-reader.ts` (chokidar wiring, current edge cases)
- `packages/parser/src/jsonl.ts` (LineSplitter, MAX_BUF_BYTES, parseLine)
- `packages/server/src/app-state.ts` (SsePayload, ingest closure, dispose chain)
- `packages/server/src/log-server.ts` (HOSTNAME constant, route registration)
- `packages/server/src/sse-routes.ts` (SSE frame contract, listener fan-out)
- `packages/cli/src/index.ts` (current required-file flow)
- `packages/ui/src/App.tsx` (meta probe → connection routing)
- `packages/ui/src/state/store.ts` (existing actions, what to extend)
- `packages/ui/src/transport/sse-client.ts` (event handling, snapshot buffering)
- `packages/ui/src/transport/http-client.ts`, `search-client.ts` (cache + abort patterns)
- `packages/shared/src/host-protocol.ts` (HostAdapter, LogCandidate, HostMessage union)
- `packages/ui/src/components/shell/HeaderBar.tsx` (theme persistence pattern)
- `test/boundary.test.ts`, `test/security.test.ts` (enforcement constraints)
- `SECURITY.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`
- `.planning/phases/03-detail-search-and-filtering/03-{UI-SPEC,VALIDATION}.md` (templates)
- `.planning/phases/04-live-tail-discovery-and-persistence/04-CONTEXT.md`

### Secondary (MEDIUM — verified on this dev machine)
- VS Code logs directory layout under `~/Library/Application Support/Code/logs/` (probed via `ls`/`find`); confirmed per-launch session timestamp dirs containing `main.log`, `mcpGateway.log`, `window<N>/exthost/<extId>/<file>.log`. Linux/Windows roots [ASSUMED] from CONTEXT D-02 and Code documentation.

### Tertiary (LOW — assumptions, see Assumptions Log)
- AHP JSONL filename conventions (no production extension yet emits them).
- Confidence scoring thresholds.
- chokidar rotation event fidelity per platform.

---

## Metadata

**Confidence breakdown:**

- Standard stack & repo invariants: HIGH — verified by reading source.
- Discovery layout (macOS): HIGH — verified locally. Linux/Windows: MEDIUM — verified only via Code docs / CONTEXT.
- Discovery scoring rules: LOW — first-pass guesses; tune after real AHP logs exist.
- Tail hardening recommendations: HIGH — gaps confirmed by reading current code.
- Pause/persistence design: HIGH — fully expressible in existing Zustand + localStorage; pattern matches Phase 2/3.
- AHP JSONL filename pattern: LOW — see A1.

**Research date:** 2026-05-07
**Valid until:** ~2026-06-07 (revisit if VS Code/Copilot ships a real AHP log emitter and the filename pattern is published, or if chokidar/Hono majors change).
