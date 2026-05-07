# Architecture Patterns: AHP Log Viewer

**Domain:** Local-first protocol/log viewer (JSON-RPC 2.0 / AHP) — standalone CLI host first, VS Code webview later
**Researched:** 2026-05-06
**Confidence:** HIGH on overall structure, MEDIUM on specific tuning numbers (chunk sizes, virtualization thresholds — depend on real log volumes)

---

## 1. Architectural Goals

The architecture must satisfy five non-negotiable forces from `PROJECT.md`:

1. **Incremental ingest of large, growing JSONL files** — never reparse, never re-render whole-file.
2. **Stable correlation of AHP events** (request ↔ response, action chains, session/turn grouping) computed on the stream, not on render.
3. **Sub-frame filter/search responsiveness** over potentially 100K+ events.
4. **Virtualized, dense, themable UI** with raw-JSON drill-down.
5. **Host-pluggable I/O** so the same UI works under (a) a Node CLI + local web server today and (b) a VS Code extension webview later, with **no UI changes**.

Everything below is in service of those forces.

---

## 2. Layered Component Model

The system is six layers. Dependencies point downward only. The **Host Adapter** boundary is the seam that lets us swap CLI ↔ VS Code without touching anything above the Event Store.

```
┌──────────────────────────────────────────────────────────────────────┐
│ 6. UI Shell (React + virtualized timeline, detail pane, theme)       │
│    - TimelineList, EventRow, DetailPane, FilterBar, SessionPicker    │
├──────────────────────────────────────────────────────────────────────┤
│ 5. Query / View State                                                │
│    - FilterModel, SearchIndex queries, selection, derived view       │
├──────────────────────────────────────────────────────────────────────┤
│ 4. Event Store + Correlation Engine                                  │
│    - In-memory columnar store, request/response pairing,             │
│      session/turn grouping, derived fields (latency, status)         │
├──────────────────────────────────────────────────────────────────────┤
│ 3. Parser / Normalizer                                               │
│    - JSONL line parser, schema validation, AHP envelope discriminator│
├──────────────────────────────────────────────────────────────────────┤
│ 2. Transport (Host → UI)                                             │
│    - Append-only event stream + control channel (open/close/error)   │
├──────────────────────────────────────────────────────────────────────┤
│ 1. Host Adapter (swappable)                                          │
│    CLI: file discovery, fs.watch, chunked tailing, HTTP/WS to UI     │
│    VSC: workspace API, FileSystemWatcher, postMessage to webview     │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 Component Boundaries

| Layer | Component | Responsibility | Talks To | Lives Where |
|-------|-----------|---------------|----------|-------------|
| 1 | **HostAdapter** (interface) | `discoverLogs()`, `openLog(path)`, `watchLog()`, `readChunk()`, `close()` | OS / VS Code API | `packages/host-*` |
| 1 | **CliHost** (impl) | Node fs, chokidar/`fs.watch`, glob discovery of `~/agenthost.*.log`, serves UI bundle + WS | HostAdapter contract | `packages/host-cli` |
| 1 | **VsCodeHost** (impl, later) | `vscode.workspace.fs`, `FileSystemWatcher`, `webview.postMessage` | HostAdapter contract | `packages/host-vscode` |
| 2 | **Transport** | Frames raw byte chunks → newline-delimited line events; backpressure; reconnection | HostAdapter ↔ Parser | `packages/transport` |
| 3 | **Parser** | Parse one JSONL line → `AhpEvent`; tolerate malformed lines; emit `ParseError` events inline | Transport → Store | `packages/parser` |
| 3 | **Normalizer** | Discriminate JSON-RPC shape (request/response/notification) and AHP overlay (action envelope, session/turn IDs); compute stable `eventId` | Parser internal | `packages/parser` |
| 4 | **EventStore** | Append-only columnar arrays + indices by `id`, `method`, `sessionId`, `turnId`, `direction`, `timestamp` | Receives normalized events; queried by View State | `packages/core` |
| 4 | **Correlator** | On each append: pair responses with requests by `id`+direction; mark unmatched; compute latency; group actions by `sessionId`/`turnId` | EventStore | `packages/core` |
| 4 | **SearchIndex** | Incremental token/substring index over payload text + structural fields | EventStore | `packages/core` |
| 5 | **FilterModel** | Pure predicate over `AhpEvent` derived from FilterBar state; memoized | EventStore + UI | `packages/ui-state` |
| 5 | **ViewModel** | Produces virtualized window slice for the visible row range; selection; expand/collapse | FilterModel + EventStore | `packages/ui-state` |
| 6 | **UI Components** | TimelineList (virtualized), EventRow, DetailPane (formatted + raw), FilterBar, SessionPicker, ThemeProvider | ViewModel | `packages/ui` |
| 6 | **ThemeSystem** | CSS variable token sets for light/dark/hacker; switch at runtime; respects VS Code theme when hosted | UI | `packages/ui` |

Key boundary rules:

- **The UI never imports from `host-cli` or `host-vscode`.** It receives an `AhpEventStream` over the Transport interface, full stop.
- **The Core (Store/Correlator/Index) is pure TypeScript, no DOM, no Node APIs.** This makes it equally usable in a webview and unit-testable without a browser.
- **Host adapters expose only the `HostAdapter` interface** — no leak of `fs`, `vscode`, or HTTP types upward.

---

## 3. Data Flow

Single direction, append-only, with one feedback channel for user-driven filter changes.

```
Log file(s) on disk
   │  (fs.watch / chokidar / VS Code FileSystemWatcher)
   ▼
HostAdapter.readChunk() ──► byte chunks
   │
   ▼
Transport: chunk → lines (handles partial trailing line across chunks)
   │
   ▼
Parser: line → AhpEvent | ParseError   (per-line, streaming)
   │
   ▼
Normalizer: tag event kind, attach eventId, sessionId, turnId
   │
   ▼
EventStore.append(event)   ──► triggers Correlator + SearchIndex update
   │                              (pair req/resp, update latency stats)
   │
   ▼  (push notification: "appended N events, indices updated")
ViewModel: recomputes only the affected visible slice
   │
   ▼
UI: TimelineList renders new rows via virtualization (fixed-height rows)
   ▲
   │  (user changes filter / search / selection)
FilterModel ──► ViewModel ──► UI re-slices (no reparse, no re-correlate)
```

Three properties this guarantees:

- **O(N) ingest, O(1) per appended event amortized** for indexing.
- **O(window size) render** regardless of total event count.
- **Filter changes never touch the parser or store** — they reproject existing data.

---

## 4. Suggested JSONL Event Envelope

This is the wire shape we want VS Code to emit, and the canonical internal `AhpEvent` after normalization. One line = one event. Always-present fields up front for cheap discrimination without full JSON walks.

```jsonc
// Common envelope (all events)
{
  "ts": "2026-05-06T14:22:09.481Z",   // ISO-8601 with ms; sortable
  "tsMono": 184729481.231,             // optional monotonic ns/ms for ordering
  "dir": "c2s" | "s2c",                // direction relative to client (VS Code)
  "kind": "request" | "response" | "notification" | "action" | "log" | "transport",
  "sessionId": "sess_abc" | null,
  "turnId":    "turn_42"  | null,
  "channel":   "agenthost" | string,   // logical transport label
  "seq":       12345,                  // monotonic sequence per channel; tie-breaker
  "raw":       { /* original JSON-RPC / action payload */ }
}
```

Kind-specific overlays inside `raw` (mirrors AHP / JSON-RPC 2.0):

```jsonc
// request
{ "kind": "request",  "raw": { "jsonrpc":"2.0", "id": 17, "method":"listSessions", "params": {...} } }

// response (success)
{ "kind": "response", "raw": { "jsonrpc":"2.0", "id": 17, "result": {...} } }

// response (error) — Correlator promotes status="error"
{ "kind": "response", "raw": { "jsonrpc":"2.0", "id": 17, "error":  { "code": -32000, "message":"...", "data":{...} } } }

// notification
{ "kind": "notification", "raw": { "jsonrpc":"2.0", "method":"dispatchAction", "params": {...} } }

// action envelope (server-originated)
{ "kind": "action", "raw": {
    "serverSeq": 88,
    "origin": "server",
    "action": { "type":"onDidAction", "payload": {...} }
}}

// transport / log (out-of-band; useful for context but not protocol)
{ "kind": "log", "raw": { "level":"info", "message":"connected to agent host" } }
```

**Why this shape:**

- `dir` + `kind` + `raw.id` is sufficient for correlation without parsing `params` or `result`.
- `ts` + `seq` + `tsMono` give a robust ordering even if wall-clock jitters.
- `sessionId` / `turnId` lifted to the envelope avoids reparsing `params` for grouping — the most common UI operation.
- `raw` is preserved verbatim so the DetailPane "Raw JSON" tab is lossless.
- Forward-compatible: new `kind` values won't break old viewers (they'll show as generic rows).

**Migration story for current human-readable log:** ship a small "legacy adapter" in the Parser layer that converts `>> dispatch`, `<< listSessions`, `!! …`, `** onDidAction` lines into this envelope shape. This is throwaway — it lives in `packages/parser/legacy.ts` and gets deleted once VS Code emits real JSONL.

---

## 5. Patterns to Follow

### Pattern 1: Append-only columnar store
**What:** Store events as parallel typed arrays (`ts: Float64Array`, `kind: Uint8Array`, `methodId: Uint16Array`, `sessionIdx: Uint32Array`, plus a `raw: object[]`). Maintain side indices: `Map<requestId, eventIdx>`, `Map<sessionId, eventIdx[]>`.
**When:** Always; this is the core data structure.
**Why:** Cache-friendly scans for filtering; cheap appends; trivial to slice for the virtualized view; serializable for snapshot/export.

```ts
class EventStore {
  ts:      number[] = [];
  kind:    EventKind[] = [];
  dir:     Direction[] = [];
  method:  (string | null)[] = [];
  reqId:   (string | number | null)[] = [];
  session: (string | null)[] = [];
  turn:    (string | null)[] = [];
  raw:     unknown[] = [];
  // derived (filled by Correlator):
  pairIdx:  (number | null)[] = []; // index of paired request/response
  latency:  (number | null)[] = []; // ms, on response rows
  status:   Status[] = [];          // ok | error | pending | unmatched
}
```

### Pattern 2: Correlation on append, not on read
**What:** When a `response` arrives, look up `reqId` in the pending-requests map → write `pairIdx` and `latency` on both rows, mark status. Notifications/actions are grouped by `sessionId`+`turnId` into a `Map<turnKey, eventIdx[]>`.
**When:** Inside `EventStore.append`, synchronously.
**Why:** UI never has to "find the matching response" at render time — it follows a pointer.

### Pattern 3: Filter as pure predicate, applied via index intersection
**What:** Compile FilterBar state to `(idx) => boolean`. For high-selectivity filters (sessionId, method, status), intersect precomputed index arrays first; only then run the predicate over the candidate set.
**When:** Whenever the FilterModel changes; result cached until either filter or store changes.
**Why:** Avoids O(N) scan on every filter tweak. With session/method indices, typical filter is O(matches), not O(events).

### Pattern 4: Virtualized rendering with stable row identity
**What:** Use `@tanstack/react-virtual` (or similar) over the filtered index array. Row key = `events.seq`, not array position, so React doesn't thrash when new events stream in above the viewport.
**When:** Always for the timeline.
**Why:** Constant render cost; smooth tailing even at high event rates.

### Pattern 5: Host adapter as a single TypeScript interface
**What:**
```ts
interface HostAdapter {
  discoverLogs(): Promise<LogCandidate[]>;
  openLog(path: string): Promise<LogHandle>;
  watchLog(handle: LogHandle, onChunk: (bytes: Uint8Array) => void): Disposable;
  close(handle: LogHandle): Promise<void>;
}
```
**When:** Every I/O operation goes through this.
**Why:** The CLI implementation uses Node `fs` + `chokidar`; the future VS Code implementation uses `vscode.workspace.fs` + `FileSystemWatcher`. The UI is identical because it only sees `Uint8Array` chunks via the Transport.

### Pattern 6: Theme tokens via CSS custom properties
**What:** All colors/typography expressed as `var(--ahp-fg-default)`, `var(--ahp-row-request)`, etc. Three token sets: light, dark, hacker. In VS Code host, map tokens to `var(--vscode-*)` so it inherits the editor theme automatically.
**When:** Every UI component.
**Why:** Theme switch is one DOM attribute change; no React re-render. VS Code integration is free.

---

## 6. Anti-Patterns to Avoid

### Anti-Pattern 1: Reparsing the file on every update
**Why bad:** Quadratic time as the file grows; UI jank; the entire reason this product needs to exist is that raw logs are slow to digest.
**Instead:** Tail by byte offset; parser holds a partial-line buffer across chunks; only new lines are processed.

### Anti-Pattern 2: Storing parsed events as a single `AhpEvent[]` of objects
**Why bad:** ~10× memory overhead vs. columnar; GC pressure during streaming; slow filter scans.
**Instead:** Columnar arrays as in Pattern 1; keep `raw` objects but never iterate them for filtering.

### Anti-Pattern 3: Computing latency / pairing in the renderer
**Why bad:** Re-runs on every render and every filter change; correctness depends on visible window.
**Instead:** Correlator writes derived fields on append; renderer reads them.

### Anti-Pattern 4: A "websocket protocol" between CLI host and UI that diverges from the postMessage shape used in the webview
**Why bad:** Two transports drift; bug-fix cost doubles; UI needs to know which host it's in.
**Instead:** Define a single `HostMessage` discriminated union (`{type:'chunk'|'open'|'close'|'error'|'discovered', ...}`). CLI sends it over WebSocket; VS Code host sends the *same* union via `webview.postMessage`. UI has one handler.

### Anti-Pattern 5: Synchronous full-file load on open
**Why bad:** UI freezes on multi-hundred-MB logs.
**Instead:** Stream from byte 0 in chunks (e.g. 256 KB), yielding to the event loop between chunks; show a progress indicator and let the timeline render incrementally as it parses.

### Anti-Pattern 6: Putting AHP-specific knowledge in the UI
**Why bad:** Couples renderer to protocol versions; makes parser swaps painful.
**Instead:** Parser/Normalizer owns AHP semantics; UI sees only typed `AhpEvent` with stable derived fields.

---

## 7. Build Order Implications

The architecture dictates a clean phase ordering. Each phase delivers a runnable slice.

| Order | Phase Topic | Why This Order | Depends On |
|-------|-------------|----------------|------------|
| **P1** | Core types + Parser + EventStore + Correlator (pure TS, no UI, no I/O) | Everything depends on the event model and store contract; cheapest to get right with fixture tests | — |
| **P2** | CliHost + Transport + UI shell with minimal virtualized timeline | First end-to-end vertical slice: open a file → see rows. Validates the HostAdapter contract under real I/O. | P1 |
| **P3** | Filtering + Search + DetailPane (formatted + raw) | Adds the value props on top of the working pipeline. Pure additions to View State + UI. | P2 |
| **P4** | Watching/tailing + auto-discovery + multi-file/session UX | Now that ingest is proven on static files, layer on growth. Stresses backpressure and incremental rendering. | P2, P3 |
| **P5** | Theme system polish (light/dark/hacker) + density/keyboard UX | Polish phase; isolated to UI layer. | P3 |
| **P6** | VS Code extension host (`packages/host-vscode`) + webview packaging | Implements the second `HostAdapter`. If the boundary held, this is mostly packaging + message-bus glue, not a rewrite. | P1–P5 |

**Critical sequencing constraints:**

- The `AhpEvent` envelope and `HostAdapter` interface must be stabilized **in P1** before any UI work. Changing either later is expensive.
- Tailing (P4) must come *after* the UI proves it can render a static file (P2), or you'll be debugging two unknowns at once.
- The VS Code host (P6) is **not** a prerequisite for any earlier phase. If the boundary leaks, P6 will surface it — that's a feature, not a bug, but plan a small spike at the end of P1 that mocks a "VsCodeHost" with `setTimeout`-driven postMessage to prove the abstraction holds.

---

## 8. Scalability Considerations

| Concern | 10K events (typical session) | 100K events (long debug) | 1M events (pathological) |
|---------|------------------------------|--------------------------|--------------------------|
| Ingest time | <1 s | 3–8 s, streamed | 30–60 s, streamed; warn user |
| Memory | ~10 MB | ~80–120 MB | ~800 MB; recommend filtered import or rolling window |
| Filter latency | <5 ms (full scan ok) | <20 ms with indices | <100 ms with indices; consider Web Worker for store |
| Render | Trivial with virtualization | Trivial with virtualization | Trivial with virtualization |
| Search | Linear substring ok | Build inverted token index lazily on first search | Required: token index + worker |

**Inflection points to plan for, but not premature-optimize:**

- At ~100K events, move EventStore + SearchIndex into a **Web Worker** to keep the main thread at 60fps during ingest. The columnar layout makes the worker boundary cheap (transfer typed arrays).
- At ~1M events, offer a **rolling window** mode (keep last N events in memory; older spilled to a memory-mapped file or dropped with a banner).
- Neither needed for v1; the architecture supports both without restructuring.

---

## 9. Testing Strategy

Testing maps 1:1 onto the layer boundaries.

### 9.1 Parser fixture tests (the foundation)
- **Location:** `packages/parser/__fixtures__/*.jsonl` plus `*.expected.json` snapshots.
- **What:** For each AHP event kind (request, response success, response error, notification, action, malformed line, partial line across chunks), one fixture file + one expected normalized output.
- **Mechanism:** `parseLine(input)` is a pure function; snapshot compare. Add a fixture every time a real-world log surprises us.
- **Why critical:** The parser is the only place real-world input enters the system; fixtures are the regression net. Run on every commit.
- **Bonus:** A small "fixture from real log" script that takes a sanitized line range from a sample log and adds it as a test case — keeps fixtures honest without committing sensitive payloads.

### 9.2 Core unit tests (Store, Correlator, SearchIndex, FilterModel)
- **Location:** `packages/core/*.test.ts`
- **What:** Pure TypeScript tests. Append synthetic events, assert pairing, latency, index contents, filter results.
- **Mechanism:** Vitest. No DOM, no fs, no network. Should run in <1 s for the full suite.
- **Coverage targets:** ≥90% on Correlator and FilterModel (these are the correctness-critical pieces).

### 9.3 Host adapter contract tests
- **Location:** `packages/host-cli/*.test.ts`, later `packages/host-vscode/*.test.ts`
- **What:** A shared `hostAdapterContract.ts` test suite parameterized by adapter implementation. Verifies discover/open/watch/close semantics against a temp directory of synthetic JSONL.
- **Why:** Forces both CLI and VS Code adapters to behave identically; bugs in one will fail the same test in the other.

### 9.4 UI component tests
- **Location:** `packages/ui/*.test.tsx`
- **What:** React Testing Library for FilterBar, EventRow, DetailPane interactions. Storybook (or Ladle) for visual snapshots of each row kind across all three themes.
- **Virtualization tests:** Mount TimelineList with a 100K-event mock store; assert only ~30 rows in the DOM and that scrolling updates correctly.

### 9.5 End-to-end smoke
- **Location:** `e2e/`
- **What:** Playwright. Launch the CLI host pointed at a fixture log directory, open the UI, assert: rows render, filter narrows results, detail pane opens, tailing picks up appended lines.
- **Frequency:** On PR; not on every commit.

### 9.6 Performance budgets (regression tests, not benchmarks)
- Parse 100K-line fixture in <10 s in CI.
- Filter recomputation on 100K events in <100 ms.
- These run nightly, not per-commit, but fail loud when crossed.

---

## 10. Open Architectural Questions (flag for phase research)

| Question | Phase to resolve | Why it can wait |
|----------|------------------|-----------------|
| Worker boundary: move Core to a Web Worker on day 1, or only when needed? | P2 spike | Adds complexity; defer until measured. |
| Search: substring scan vs. inverted index vs. SQLite-WASM? | P3 | Depends on real-world log sizes once tailing works. |
| VS Code webview state persistence across reloads (do we restore filter + scroll position via `getState`/`setState`)? | P6 | Pure VS Code concern. |
| Do we ever need to re-derive `sessionId`/`turnId` if VS Code emits envelopes that *don't* lift them? | P1, after first real JSONL sample | If VS Code cooperates, never; if not, normalizer extracts from `raw.params`. |

---

## 11. Sources

- AHP framing facts (JSON-RPC 2.0, action envelopes with `serverSeq`/`origin`/`action`): orchestrator-provided context; cross-referenced against `../agent-host-protocol` repo per `PROJECT.md`. **Confidence: HIGH.**
- Columnar in-memory store + correlate-on-append pattern: standard design used by Chrome DevTools Performance panel, Perfetto, Jaeger UI for timeline-of-events workloads. **Confidence: HIGH (pattern), MEDIUM (specific tuning).**
- Virtualization with `@tanstack/react-virtual`: official docs and widespread use in log/grid UIs. **Confidence: HIGH.**
- VS Code webview ↔ extension `postMessage` contract and `FileSystemWatcher` semantics: VS Code Extension API docs (`code.visualstudio.com/api`). **Confidence: HIGH.**
- Theme token mapping to `--vscode-*` CSS variables: VS Code Webview UI Toolkit / theming docs. **Confidence: HIGH.**
- Performance numbers in §8: order-of-magnitude estimates from comparable log viewers (lnav, Perfetto trace viewer); **MEDIUM confidence — must be validated with real AHP log sizes during P2.**
