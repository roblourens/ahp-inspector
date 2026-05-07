# Domain Pitfalls: AHP Log Viewer

**Domain:** Local-first developer log viewer / JSON-RPC protocol inspector
**Researched:** 2026-05-06
**Overall confidence:** MEDIUM-HIGH (synthesized from established patterns in DevTools, Wireshark, Chrome Network panel, LSP Inspector, Charles/Proxyman, log viewers like lnav, Logdy, OkLog, and JSONL streaming tooling)

This document catalogs mistakes that recur in tools that watch and visualize developer protocol logs. Each pitfall is mapped to the roadmap phase that should prevent it. Pitfalls are ordered roughly by severity (impact × likelihood for *this specific* project).

---

## Critical Pitfalls

These cause architectural rewrites, data corruption, leaked secrets, or render the tool unusable on real workloads.

### C1. Reparsing the entire log on every change
**What goes wrong:** The watcher re-reads and re-parses the whole JSONL file every time it grows (or every keystroke in the search box re-filters from raw text). Latency climbs linearly with log size; at ~50 MB the UI freezes for seconds; at ~500 MB it never recovers.
**Why it happens:** Easy first implementation. `fs.readFile` + `JSON.parse` per line in a render-time loop feels fine on the 200-line sample log.
**Warning signs:**
- A single state object holds the entire raw file as a string.
- Filter / search recomputes from `events.filter(...)` over the full array on every keystroke.
- File-watcher handler calls the same parse routine as initial load.
- DevTools shows long tasks > 100 ms during tailing.
**Prevention:**
- Treat the log as an append-only stream from day one. Parse incrementally: track a byte offset, read only the new tail, parse line-by-line.
- Build an in-memory event store keyed by a monotonic sequence id. Never mutate prior events.
- Derive indexes (by method, by request id, by session, by turn, by direction, by status) at ingest time, not at render time.
- Memoize filter results; debounce search input (50–100 ms); run filtering on a Web Worker for any log over a small threshold (e.g. 5 MB).
**Phase:** Phase 1 (ingestion architecture) — must be designed in, not retrofitted.

### C2. Leaking secrets into the UI, screenshots, telemetry, or external services
**What goes wrong:** Tokens, prompts, file paths, and model output appear in plaintext in the UI; a developer screenshots a bug and posts an OAuth token to GitHub; a future "Send to LLM to summarize" feature exfiltrates customer data; a crash reporter uploads payloads.
**Why it happens:** "It's local-only" is treated as sufficient mitigation. Redaction is deferred as a polish item.
**Warning signs:**
- No redaction layer between parsed event and rendered cell.
- "Copy as JSON" copies the raw payload with no warning.
- Any outbound network call exists in the app at all (analytics, font CDNs, update checks).
- Sample fixtures committed to the repo contain real tokens.
**Prevention:**
- Default-deny network: ship with a strict CSP (`connect-src 'self'`), no analytics, no remote fonts, no update pings. Document this as a product guarantee.
- Build a redaction pass that runs at parse time and tags fields (`authorization`, `token`, `apiKey`, `bearer`, `password`, `secret`, common JWT/OAuth shapes, `Authorization:` headers in stringified payloads). Render redacted by default with a per-event "Reveal" affordance.
- Add a "Demo mode" / "Share mode" toggle that forces aggressive redaction for screenshots and screencasts.
- Strip secrets from any committed sample fixture; generate synthetic fixtures from the real log shape.
- Never log payload contents to the browser console (it ends up in OS crash dumps).
**Phase:** Phase 1 (network posture, CSP) and Phase 3+ (redaction UI). The CSP/no-network decision must be locked early; retrofitting is hard once a dependency pulls in a CDN font.

### C3. Brittle parser that drops entire sessions on one bad line
**What goes wrong:** A single malformed JSONL line — a partial write during tailing, a non-UTF-8 byte, a log rotation mid-line, an embedded newline in a stringified payload — throws and aborts the whole load. Or worse, swallows silently and shifts every subsequent event off-by-one.
**Why it happens:** `content.split('\n').map(JSON.parse)` is the natural first pass. Tail reads catch lines mid-flush.
**Warning signs:**
- Parser is a single `.map(JSON.parse)` with no try/catch.
- No buffer for partial trailing line between tail reads.
- No "unparseable line" event type in the model.
- Tests use only well-formed fixtures.
**Prevention:**
- Per-line `try/parse/catch`; on failure, emit a synthetic `ParseError` event preserving the raw bytes, byte offset, and reason. Render these inline in the timeline so users can see what was skipped.
- Maintain a tail buffer: only emit a line when a `\n` is seen; carry the partial remainder to the next read.
- Handle BOM, CRLF, trailing whitespace, and empty lines explicitly.
- Treat the human-readable sample log as a *separate* parser with its own adapter — do not let its quirks pollute the JSONL parser.
- Fuzz the parser with: truncated lines, lines with embedded `\n` inside JSON strings, invalid UTF-8, 10 MB single-line payloads, BOMs, mixed line endings.
**Phase:** Phase 1 (parser) with explicit fuzz tests. Failure here in Phase 4 means re-architecting the event model.

### C4. Request/response correlation that silently mismatches
**What goes wrong:** JSON-RPC `id` is correlated naively (`id` alone), but ids are namespaced per-direction or per-session in AHP. A client request with `id: 1` matches a server-originated request with `id: 1`, producing nonsensical pairs. Notifications (no `id`) get accidentally paired. Numeric `1` and string `"1"` are treated as different.
**Why it happens:** JSON-RPC 2.0 only requires id uniqueness within a single client→server session; bidirectional protocols (LSP, AHP) have *two* id spaces. Sample sizes are small enough that collisions don't appear in dev.
**Warning signs:**
- Correlation key is `event.id` with no direction or session component.
- No handling of `id: null` (notifications, parse-error responses per spec).
- No "unmatched request" or "orphan response" surfacing in the UI.
- Tests don't include simultaneous overlapping requests in both directions.
**Prevention:**
- Correlation key = `(session, direction, id, idType)`. Document this explicitly. Reference the AHP spec in `../agent-host-protocol` for which methods are bidirectional.
- Treat notifications (no `id`) as never-correlatable; render them as standalone timeline entries.
- Surface unmatched requests (still pending after N seconds, or after the log ends) as a first-class UI state — these are the most interesting events for debugging hangs.
- Surface orphan responses (response with no matching request) as warnings; they usually indicate log truncation or a parser bug.
- Preserve id type: `1` ≠ `"1"`. Use a normalized key like `${typeof id}:${id}`.
- Fixture tests: overlapping ids across directions, ids reused after log rotation, requests that never get responses, responses that arrive before request (out-of-order writes).
**Phase:** Phase 2 (analysis layer) — design the correlation key before building any UI that depends on pairs.

### C5. UI that re-renders the full timeline on every new event
**What goes wrong:** Every appended log line triggers a top-level React re-render. At 100 events/sec the UI hits 100% CPU and drops frames. Scrolling jitters. Live tailing is unusable on a busy session.
**Why it happens:** Naive `useState([...events, newEvent])` pattern; passing the whole list to a child component; not virtualizing.
**Warning signs:**
- The timeline component receives `events: Event[]` as a prop.
- React DevTools Profiler shows the timeline re-rendering on every append.
- Dropped frames during live tail.
- Memory grows linearly with log size (no row recycling).
**Prevention:**
- Virtualize the timeline from day one (TanStack Virtual or react-virtuoso). Do *not* defer this — retrofitting virtualization across an expandable-row UI is painful.
- Append events in batches with `requestAnimationFrame` coalescing (e.g. flush every 16 ms or every N events, whichever first).
- Use a stable external store (Zustand / Redux / a plain event store with subscriptions) and have rows subscribe to slices, not to the whole list.
- "Follow tail" mode is a separate concern from "user has scrolled up" — pause auto-scroll the moment the user scrolls, resume on explicit click.
- Budget: live tail must sustain 1000 events/sec on a mid-range laptop without dropping frames. Bench this in CI.
**Phase:** Phase 3 (timeline UI) — virtualization is a Phase 3 entry requirement, not a Phase 5 polish item.

### C6. Search/filter that's wrong, not just slow
**What goes wrong:** Substring search misses fields nested inside payloads. Method filter is case-sensitive when method names aren't. Regex search throws on user input. "Errors only" filter misses JSON-RPC error responses (status code lives in `error.code`, not at top level). Time-range filter uses local time but logs are UTC. Filter combination is OR when the user expects AND.
**Why it happens:** Each filter is added ad hoc; no shared semantics for "what does this filter actually match against?"
**Warning signs:**
- No documented filter grammar.
- No shared "is this event an error?" predicate (each filter reimplements it).
- Search results differ from what the user can see when they expand a row.
- No tests asserting "filter X matches event Y."
**Prevention:**
- Define a single `EventView` projection: the canonical set of indexed text fields per event (method, id, session, turn, direction, error code, error message, top-level payload keys, full stringified payload). Search and filter both operate against this projection.
- Build text search on a real index (FlexSearch, MiniSearch, or lunr) keyed by sequence id. Free-text search returns sequence ids; the timeline filters by id-set intersection.
- Combine filters as AND by default; show active filters as removable chips so the user always knows what's applied.
- Normalize: case-insensitive method match, UTC-aware time filters with explicit timezone display, regex search wrapped in try/catch with inline error feedback.
- Make "is error" / "is unmatched" / "is slow (>Nms)" first-class derived facets, computed once at ingest.
**Phase:** Phase 3 (filters) and Phase 4 (search) — define the `EventView` projection in Phase 2 before either is built.

---

## Moderate Pitfalls

Painful, but recoverable without architectural change.

### M1. Log format drift between sample and real JSONL
**What goes wrong:** Development is driven by the human-readable `agenthost.*.log` sample (`>> dispatch`, `<< listSessions`, `!! …`, `** onDidAction`). When VS Code starts emitting real JSONL, half the assumptions break: field names differ, direction encoding differs, timestamps move from line-prefix to a JSON field.
**Prevention:**
- Define a canonical internal `Event` type up front, derived from the AHP spec and JSON-RPC 2.0 — *not* from the sample log.
- Write two adapters: `JsonlAdapter` (target) and `HumanLogAdapter` (sample). Both produce the canonical `Event`. UI never sees raw lines.
- Version the canonical schema (`schemaVersion: 1`); add an adapter test for every new log fixture.
- Prefer the JSONL adapter for all new feature work; treat the human adapter as legacy from day one.
**Phase:** Phase 1 (parser/adapter split).

### M2. Tail-following while the user is scrolling
**What goes wrong:** User scrolls up to inspect an old event; new events arrive and the view jumps to the bottom mid-read. Or: user scrolls to bottom expecting to "follow," but auto-follow is off and they don't notice new events arriving above.
**Prevention:**
- Two explicit states: `following` (pinned to tail) and `paused` (user has scrolled). Indicate state visually (a "Jump to live" pill when paused, with a count of new events).
- Any user-initiated scroll up flips to `paused`. Clicking the pill or scrolling to the absolute bottom resumes `following`.
- Never adjust scroll position programmatically while `paused`.
**Phase:** Phase 3 (timeline UX).

### M3. Expandable rows that break virtualization
**What goes wrong:** Variable-height rows (collapsed = 1 line, expanded = 200 lines of JSON) confuse fixed-height virtualizers. Scroll position jumps when expanding a row above the viewport. Measuring causes layout thrash.
**Prevention:**
- Use a virtualizer with first-class dynamic-height support (react-virtuoso, or TanStack Virtual with `measureElement`).
- When expanding a row, anchor scroll to the row's top so the expansion grows downward into empty space.
- Consider a side panel / split view for "expanded detail" instead of inline expansion at scale — this sidesteps the height problem entirely and is the pattern Chrome DevTools, Charles, and Wireshark all use. Inline expansion is fine for 1–2 rows; a detail pane scales better.
**Phase:** Phase 3 (timeline UI). Decide inline-vs-pane *before* building the row component.

### M4. JSON pretty-printer that chokes on huge payloads
**What goes wrong:** A 5 MB model-response payload is `JSON.stringify`'d with `null, 2`, then handed to a syntax highlighter that builds a DOM node per token. Expanding the row freezes the tab.
**Prevention:**
- Cap inline pretty-print at e.g. 64 KB; for larger payloads show a truncation notice with "Show full" / "Copy" / "Open in viewer" actions.
- Use a virtualized JSON tree (react-json-view-lite, or a custom collapsible tree) rather than syntax-highlighting a giant string.
- Lazy-render: only pretty-print when the row is actually expanded; throw away the formatted DOM when collapsed.
- For very large payloads, offer "View raw" that opens a separate read-only pane streaming the bytes.
**Phase:** Phase 3 (event detail).

### M5. Timestamps and timing presented misleadingly
**What goes wrong:** Log timestamps are shown in local time but compared as strings; latency between request and response is wrong across log rotations or DST transitions; "duration" displays for notifications (which have no response). Timestamps shown to ms when the source is second-precision implies false accuracy.
**Prevention:**
- Parse all timestamps to a single normalized representation (epoch ms or `Date`) at ingest. Display formatting is a render concern only.
- Show source timezone explicitly (e.g. `14:32:01.234 UTC` or `… (local)` toggle).
- Compute latency as `response.ts - request.ts` only when both exist and are paired by the correlation key. Render `—` otherwise. Never show `0 ms` for missing data.
- Surface clock weirdness: if response precedes request, flag it instead of displaying a negative number silently.
**Phase:** Phase 2 (event model) and Phase 3 (display).

### M6. File-watcher misbehavior across editors and OSes
**What goes wrong:** `fs.watch` fires twice on macOS for one write, misses events on network filesystems, doesn't fire when the file is replaced atomically (common with log rotation). VS Code's editor "save" can replace-then-rename, breaking the watcher's file handle.
**Prevention:**
- Use `chokidar` (or equivalent) rather than raw `fs.watch`; it handles platform quirks and atomic replacement.
- Detect file truncation (current size < last known size) and reset the read offset to 0; surface a "log rotated" event in the UI.
- Detect inode change (file replaced); reopen.
- Throttle/debounce watcher events (e.g. 50 ms) before issuing a tail read.
- Test on macOS, Linux, and at minimum WSL on Windows.
**Phase:** Phase 1 (ingestion).

### M7. Auto-discovery surfaces the wrong files or none at all
**What goes wrong:** Discovery scans `~` recursively (slow, scary), or only checks one hardcoded path that's wrong on Linux/Windows, or returns the user's `.zsh_history` because it matched a glob.
**Prevention:**
- Maintain a small, explicit list of known candidate paths per OS (VS Code's `logs/` directory, the documented AHP log location). Document them.
- Match by filename pattern *and* by content sniff (first non-empty line parses as a known shape) before listing.
- Always offer a manual file-open path as a peer to discovery, not a fallback hidden in a menu.
- Never recurse into the home directory.
**Phase:** Phase 1 or Phase 2 (file discovery).

### M8. Theme system bolted on after the fact
**What goes wrong:** Colors are hardcoded in components; "dark mode" is a class toggle that misses 40 of them; the "hacker" theme requires a new font but font loading wasn't planned and causes FOUT; syntax highlighting for JSON detail uses a fixed palette that fights the theme.
**Prevention:**
- Define design tokens (CSS custom properties) for *every* color, surface, border, and semantic state (`--color-error`, `--color-request`, `--color-response`, `--color-notification`, `--color-action`) in Phase 3, before themes are visible polish work.
- Themes are token sets, not stylesheets. JSON viewer and any third-party component must consume tokens or be wrapped to do so.
- Test all three themes in CI (visual regression via Playwright screenshots) — otherwise themes silently rot.
- Fonts: self-host (no Google Fonts CDN — see C2), preload to avoid FOUT.
**Phase:** Phase 3 (design tokens), Phase 5 (theme polish).

### M9. Extension/webview compatibility broken late
**What goes wrong:** The standalone web app uses `window.fetch` to load logs from the local FS via a bundled server, hardcodes `localhost:5173` URLs, uses `localStorage` for settings — none of which work the same in a VS Code webview (no arbitrary network, sandboxed origin, restricted storage, message-passing only).
**Prevention:**
- Define a `Host` interface in Phase 1: `listCandidateLogs()`, `openLog(path)`, `watchLog(path, cb)`, `readSettings()`, `writeSettings()`. Two implementations: `LocalServerHost` (Node server) and (later) `VsCodeWebviewHost` (postMessage to the extension).
- UI imports the `Host` via context/DI; never imports `fetch`, `fs`, or `window.location` directly.
- Avoid: `localStorage`, absolute URLs, `WebSocket` to arbitrary ports, dynamic `import()` of remote modules, anything that requires `unsafe-eval` CSP.
- Add a "webview compatibility" lint check (forbid the imports above outside the host implementation) once the abstraction exists.
**Phase:** Phase 1 (host abstraction), revisited at every phase boundary.

### M10. Test fixtures that don't represent reality
**What goes wrong:** All tests use a 50-line hand-crafted fixture. The viewer ships, the user opens a 200 MB real log, and everything breaks: parser, virtualizer, search, correlation. Or: tests pass against the human-readable sample but the JSONL adapter is exercised only by a single happy-path fixture.
**Prevention:**
- Curate a fixture suite covering: tiny (10 lines), medium (10k lines), large (1M lines, generated), malformed lines, partial trailing line, all known AHP methods, overlapping bidirectional ids, errors with each JSON-RPC error code, notifications without ids, log rotation mid-stream, mixed line endings, embedded newlines in payloads, large (5 MB) payloads.
- Synthesize the large fixtures with a generator script (kept in `test/fixtures/generate.ts`); don't commit multi-MB binaries.
- **Never** commit a fixture derived from a real log without scrubbing tokens, file paths, and prompts. Have a pre-commit check that scans fixtures for high-entropy strings and known token prefixes (`sk-`, `ghp_`, `eyJ` for JWTs, `Bearer `).
- Performance fixtures gate CI: parsing 1M lines must complete under N seconds; live-tail at 1k events/sec must not drop frames.
**Phase:** Phase 1 onwards (fixtures grow per phase).

---

## Minor Pitfalls

Annoyances and polish issues. Cheap to prevent, expensive to retrofit only because they're forgotten.

### m1. "Copy" actions that copy the wrong thing
Copy-as-JSON copies the rendered (possibly redacted, possibly truncated) view, not the raw payload — or vice versa, surprising the user. **Prevention:** Two distinct actions: "Copy raw JSON" (warns if redaction is on) and "Copy displayed". Phase 4.

### m2. Keyboard shortcuts that conflict with the browser
`Cmd+F` browser-find shadows the in-app search; `Cmd+W` closes the tab when the user expects to close a panel. **Prevention:** Adopt conventional shortcuts (`/` for search, `Esc` to clear, `j/k` to navigate rows, `Enter` to expand) and document them; do not override browser/OS shortcuts. Phase 4–5.

### m3. Empty states that say "No data"
A new user opens the app with no log selected and sees "No events." They don't know why. **Prevention:** Empty states are onboarding: show discovered candidates, a manual-open button, and a link to the format docs. Phase 4.

### m4. Color used as the only signal
"Errors are red" excludes color-blind users and breaks in the hacker theme where everything is green. **Prevention:** Always pair color with shape/icon/text (✗ for error, ⇄ for request/response pair, → for notification). Phase 5.

### m5. Settings that aren't persisted, or are persisted globally when they should be per-log
Filter state, theme, expanded-row state — users expect the right scope. **Prevention:** Theme is global; filters and search are per-session (or per-log path). Decide per-setting in Phase 4. Use the `Host.readSettings/writeSettings` abstraction so VS Code webview can route to extension storage.

### m6. Console logging in production
`console.log(event)` left in for debugging dumps full payloads (with secrets) into the OS-level browser log. **Prevention:** Lint rule forbidding `console.*` outside a wrapped logger that's no-op in production. Phase 1.

### m7. Source maps shipped with the production build
Source maps in production reveal internal structure and slow loads. For a local-only tool this is low risk, but if VS Code ever serves the bundle, it matters. **Prevention:** `sourcemap: 'hidden'` in production builds. Phase 5.

### m8. AHP spec drift
The AHP protocol in `../agent-host-protocol` evolves; new methods/actions appear; the viewer shows them as `unknown`. **Prevention:** Generate the method/action enum from the AHP TypeScript types or JSON schemas at build time. Surface unknown methods clearly (don't hide them). Phase 1, refreshed each milestone.

---

## Phase-Mapped Warning Matrix

| Phase (likely) | Pitfalls to actively prevent | Mitigation summary |
|---|---|---|
| **Phase 1 — Ingestion & parsing foundation** | C1, C2 (network posture, CSP), C3, M1, M6, M7, M10, m6, m8 | Streaming parser, adapter pattern, host abstraction, fuzz tests, no-network defaults, generated AHP enums |
| **Phase 2 — Event model & correlation** | C4, M5 | Correlation key includes session+direction+id+type; surface unmatched/orphan events; normalized timestamps |
| **Phase 3 — Timeline UI & expansion** | C5, M2, M3, M4, M8 (tokens) | Virtualization from day one; explicit follow/pause states; design tokens; bounded pretty-print |
| **Phase 4 — Search & filters** | C6, m1, m2, m3, m5 | Single `EventView` projection, real text index, AND-by-default filters with chips, conventional shortcuts |
| **Phase 5 — Polish & themes** | M8 (themes), m4, m7 | Token-driven themes, visual regression tests, no color-only signals, hidden source maps |
| **Cross-phase — Security** | C2 reinforced every phase | Redaction layer, no outbound network, scrubbed fixtures, screenshot/share mode |
| **Future — VS Code extension** | M9 | Host abstraction defined Phase 1 prevents rework |

---

## Sources & Confidence Notes

- **HIGH confidence** (well-established patterns across multiple mature tools): C1 (incremental parsing), C3 (resilient JSONL parsing), C5 (virtualization), M3 (variable-height virtualization), M6 (chokidar over fs.watch), M10 (fixture variety).
- **HIGH confidence, domain-specific:** C4 (bidirectional JSON-RPC id collision is documented in LSP/DAP debugger inspector projects); C2 (well-established secret-handling guidance for any local DevTool).
- **MEDIUM confidence** (general DevTool/UX wisdom, applied to this domain): M2, M5, M7, M8, M9, m1–m8.
- **Reference patterns drawn from:** Chrome DevTools Network panel, Wireshark, LSP Inspector, vscode-languageclient logs, Charles Proxy, Proxyman, lnav, Logdy, OkLog, react-virtuoso/TanStack Virtual docs on dynamic heights, JSON-RPC 2.0 spec, chokidar README on platform quirks.
- No external secrets or sample-log content quoted in this document.
