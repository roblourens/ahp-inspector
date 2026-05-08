# Phase 4: Live Tail, Discovery, and Persistence - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 makes the standalone viewer feel like a live local tool: it should launch without requiring a log path, discover likely VS Code / Copilot AHP logs, let the user choose or manually open a log, keep following appended JSONL lines, support pause/resume of live following without losing reading context, and remember per-log viewer state. It does not package a VS Code extension, alter the AHP protocol, or add new analysis features beyond live ingestion/discovery/persistence.

</domain>

<decisions>
## Implementation Decisions

### Discovery and manual open
- **D-01:** The CLI should support a no-file launch mode that opens the app into a log picker/discovery state instead of failing with "log file not found"; passing a file path should keep the current direct-open behavior.
- **D-02:** Discovery should prioritize likely VS Code log roots already documented in `packages/host-node/src/discovery.ts`: macOS `~/Library/Application Support/Code{,-Insiders}/logs/`, Linux `~/.config/Code{,-Insiders}/logs/`, and Windows `%APPDATA%\Code{,-Insiders}\logs\`.
- **D-03:** Candidate matching should favor the future canonical AHP JSONL format (`*.jsonl`, especially AHP/agent-host named files) and include current `agenthost.*.log`-style files as lower-confidence candidates only where the existing parser/legacy adapter can handle them safely.
- **D-04:** Manual open should be path-based in the local app (paste/type a path or choose a discovered candidate), not browser file upload. This keeps the existing Node host adapter and watch path intact and avoids copying large/sensitive logs into browser memory.
- **D-05:** Discovered candidates shown to the browser should use opaque IDs plus safe display labels, size, mtime, and origin. Full absolute paths may be accepted from a manual-open input and retained server-side, but should not be echoed in metadata, row payloads, or routine UI surfaces.

### Active log session lifecycle
- **D-06:** Add a server-side log session/catalog layer that can exist with no active log, map safe candidate IDs to real paths, open/switch logs, and own the current `AppState`. Avoid baking a single `AppState` permanently into `startLogServer`.
- **D-07:** When the active log changes, dispose the previous `AppState`, clear detail/search caches for the old log, reset the timeline snapshot, and reconnect/restart the stream for the new active log.
- **D-08:** The existing CLI direct-open path should become a convenience initializer for the same active-log session flow, not a separate mode with divergent behavior.

### Live tail behavior
- **D-09:** Reuse `TailReader` and the existing `append`/`patch` SSE frame contract for live updates; planning should focus on hardening edge cases and connecting UI controls rather than replacing this pipeline.
- **D-10:** New appended JSONL lines should appear incrementally without reparsing the whole file. Partial trailing lines should stay buffered until the newline arrives, preserving existing `LineSplitter` behavior.
- **D-11:** File truncation, replacement, or rotation must be surfaced explicitly. Do not silently ignore shrink events; show a reset/rotation banner and reload from the new file contents or require the user to reopen, depending on what research finds safest.
- **D-12:** Watch/read errors should be user-visible in the app with retry/reopen actions. Existing best-effort silent catches in low-level readers are acceptable only if a higher layer turns them into visible state.

### Pause/resume and reading context
- **D-13:** Pause/resume is a live-follow/read-position control, not a parser shutdown by default. While paused, the server may continue ingesting and indexing appended rows, but the UI should preserve current selection/scroll and show a "N new events" affordance instead of yanking the user to the bottom.
- **D-14:** Resume should reveal/catch up to new rows and optionally jump to the newest event, without clearing filters, search, selected detail, or grouping.
- **D-15:** If planning finds server-side pause is necessary for performance, it must be an explicit secondary optimization; the user-facing semantics remain "pause my view, don't lose incoming traffic."

### Persistence
- **D-16:** Persist theme globally under the existing `ahp-theme` preference and persist log-specific viewer state separately by a stable sanitized log key generated server-side (for example, a hash of canonical path + mtime/size metadata).
- **D-17:** Per-log persistence should include search query, filters, grouping mode, collapsed groups, selected row when still valid, detail width, and live-follow paused/resumed state.
- **D-18:** Persisted state must be treated as convenience only. If a log no longer exists, changed identity, or has fewer rows than the saved selected index, the UI should degrade cleanly and clear only the invalid pieces.

### UI shape
- **D-19:** The picker should feel like part of the current polished shell: use the existing header/filter visual language, a concise discovered-log list sorted newest first, origin/confidence badges, file size/mtime, and a clear manual-open path entry.
- **D-20:** The active-log header should continue showing safe basename-level metadata and event/session counts; avoid making absolute paths the dominant UI label.
- **D-21:** Empty states should distinguish "server not running" from "server running, no log selected" and "no discovered logs found." The no-log state should offer manual open and a refresh discovery action.

### the agent's Discretion
- Exact candidate confidence scoring, badge copy, refresh cadence, log-key hash algorithm, and the final placement of pause/resume controls are left to the planner/researcher as long as they preserve the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and phase requirements
- `.planning/PROJECT.md` — product vision, local-first/privacy posture, active requirements for discovery, real JSONL, responsiveness, themes, and host boundary.
- `.planning/ROADMAP.md` §Phase 4 — fixed phase goal, dependencies, requirements, and success criteria for discovery, manual open, live tail, pause/resume, and persistence.
- `.planning/STATE.md` — prior technical decisions and implementation notes from Phases 1-3.

### AHP and log format
- `../agent-host-protocol/types/` — canonical AHP protocol types; do not invent protocol shapes.
- `packages/parser/src/jsonl.ts` — JSONL line parsing and partial-line assumptions used by live tail ingestion.
- `packages/parser/src/normalizer.ts` — canonical event normalization from raw JSON-RPC/AHP messages.
- `packages/parser/src/legacy.ts` — legacy human-readable sample adapter; use only as transitional support, not the primary Phase 4 target.

### Host/discovery/tail infrastructure
- `packages/shared/src/host-protocol.ts` — `HostAdapter`, `LogCandidate`, `LogHandle`, and host message contracts.
- `packages/host-node/src/discovery.ts` — existing discovery stub and OS-specific VS Code log roots.
- `packages/host-node/src/host-adapter.ts` — Node open/watch implementation and path privacy constraints.
- `packages/host-node/src/tail-reader.ts` — incremental read/watch implementation already available for appended bytes.

### Server and streaming integration
- `packages/server/src/app-state.ts` — current one-log `AppState`, ingestion pipeline, append/patch events, search index ownership, and safe `LogMeta`.
- `packages/server/src/sse-routes.ts` — SSE snapshot/append/patch/ping route contract consumed by the UI.
- `packages/server/src/log-server.ts` — current server composition that will need a session/log-manager layer for no-active-log and log switching.
- `packages/cli/src/index.ts` — current required-file CLI flow that should become optional-file with direct-open convenience.

### UI state and transport
- `packages/ui/src/App.tsx` — current meta probe and stream startup; needs no-log/server-running state support.
- `packages/ui/src/state/store.ts` — existing timeline, filters, grouping, detail, and connection state; persistence should extend this carefully.
- `packages/ui/src/transport/sse-client.ts` — browser stream client handling snapshots, append, patch, disconnect, and reconnect state.
- `packages/ui/src/transport/http-client.ts` and `packages/ui/src/transport/search-client.ts` — existing bounded HTTP client patterns for detail/search endpoints.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TailReader` already performs initial read plus incremental appended-byte reads with chokidar; Phase 4 should harden shrink/rotation/error reporting rather than replace it.
- `NodeHostAdapter.discoverLogs()` already delegates to `discoverVsCodeLogs()` and `openLog()`/`watchLog()` are behind the shared host boundary, matching the future VS Code-webview direction.
- `AppState` already ingests chunks through `LineSplitter`, `parseLine`, `normalize`, `EventStore`, `Correlator`, `SearchIndex`, and emits compact row append/patch frames.
- `connectLogStream()` already handles snapshot buffering and appending rows into Zustand, so live tail UI can reuse the existing SSE contract.
- `useAppStore` already owns search, filters, grouping, selected detail, and detail width, making it the natural source for per-log persisted preferences.

### Established Patterns
- Portable packages must not import Node/server concerns; boundary tests enforce the host abstraction.
- Server metadata intentionally exposes only basenames, not absolute paths. Phase 4 should continue this privacy pattern even when discovery deals with real filesystem paths.
- UI colors/spacing should go through design tokens; avoid raw color literals in components.
- Existing API clients use small transport modules with typed response shapes and explicit error handling.
- Existing server routes are local-only behind host guard + CSP; new discovery/open/session endpoints should be mounted under the same server protections.

### Integration Points
- Add discovery/session endpoints alongside current log/detail/search routes, or refactor route registration to consume a log-session manager that can return "no active log" cleanly.
- Introduce a no-active-log UI state before stream connection, distinct from `ServerNotRunningState`.
- Persist UI state from store changes to localStorage and restore when a log identity becomes active.
- Add tests around no-file CLI launch, discovery results, manual open, log switching, append while paused, and persisted state restoration.

</code_context>

<specifics>
## Specific Ideas

- The UI should remain fast, responsive, information-dense, and polished; discovery/live controls should not clutter the timeline.
- Favor a "newest logs first" picker so the likely current VS Code session is obvious.
- Pause should protect the user's current reading position; it should not mean "drop incoming events."
- Candidate labels should be useful but safe: basename, origin, recency, size, and confidence are enough for the normal list.

</specifics>

<deferred>
## Deferred Ideas

- Full VS Code extension packaging remains out of scope for Phase 4, though the host boundary should stay compatible with a later extension/webview.
- Advanced analytics or new visualization modes beyond live/discovery/persistence belong in future phases.

</deferred>

---

*Phase: 04-live-tail-discovery-and-persistence*
*Context gathered: 2026-05-07*
