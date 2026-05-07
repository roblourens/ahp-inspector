# Phase 2: Vertical Slice — CLI, Server, Timeline — Research

**Researched:** 2026-05-07
**Domain:** CLI → local Hono SSE server → React 19 + TanStack Virtual UI; dark-first dense devtool timeline
**Confidence:** HIGH (stack and patterns are well-trodden; only Phase-2-specific risk is the boundary-test conflict for `packages/ui/`)

## Summary

Phase 1 already delivered the canonical event model, parser, EventStore, Correlator, NodeHostAdapter (with TailReader+chokidar), Hono health server (bound to 127.0.0.1), and a CLI that wires bytes → events. Phase 2 extends, not rebuilds, all of these. The work is: (1) introduce a runtime **AppState** that owns one open log + Correlator + connection state; (2) add SSE/snapshot routes to the existing Hono server and have it also serve the built UI as static assets with a strict CSP; (3) create `packages/ui/` (Vite + React 19 + TanStack Virtual + Zustand) that hand-builds every component listed in UI-SPEC §11; (4) extend the CLI to actually open a browser, derive direction from JSONL envelope (today's hard-coded `'c2s'` placeholder must go), and pass an SSE URL; and (5) lock down a row-projection contract (`EventRow`) that Phase 3 will reuse for filter/search.

**Primary recommendation:** Build an explicit `EventRow` projection in `packages/core/` (computed once on append from `AhpEvent` + `Correlator` columns) and stream it (snapshot + tail deltas) over Hono SSE as JSON-encoded batches. The UI consumes the projection and never re-derives correlation/status/latency on the render path. This isolates UI from store internals and matches Phase 3's filter-on-projection plan.

The single non-obvious snag in the existing repo: `test/boundary.test.ts` already lists `packages/ui/src` in `PORTABLE_ROOTS` with `react`/`react-dom`/`vite` in `FORBIDDEN_PATTERNS`. Phase 2 MUST update the boundary test (remove `packages/ui/src` from portable roots and add a separate `UI_FORBIDDEN_PATTERNS` for `node:`/`fs`/`chokidar`/`hono`/`@ahp-viewer/host-node`/`@ahp-viewer/server`) before any UI code lands, otherwise the suite will fail green-Wave-0.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 2. The orchestrator clarified out-of-band:

### Locked Decisions (from prompt + UI-SPEC + ROADMAP)

- **UI-SPEC at `02-UI-SPEC.md` is the binding visual/interaction contract** — all token names, copy strings, layout, row geometry, components, and acceptance gates are locked.
- **Dark-first only.** Light/hacker theme switching belongs to Phase 5; Phase 2 ships `[data-theme="dark"]` only, but every color/space/type value lives in CSS custom properties (single token manifest at `packages/ui/src/styles/tokens.css`).
- **Search/filter UI, detail inspector, session/turn grouping, live-tail UI controls (`following`/`paused`, jump-to-live), file picker, theme switcher are out of scope** (Phase 3/4/5). Phase 2 implements the placeholder Detail Rail and the no-results / disconnected screen states required by UI-SPEC §8 and §10.
- **Local-only posture is non-negotiable**: server binds 127.0.0.1, CSP `connect-src 'self'`, no CDN/Google-Fonts/remote SVG, fonts vendored locally, allow-list test extended (not bypassed).
- **No shadcn / no component registries.** All UI primitives are hand-built per UI-SPEC §13.
- **Architecture boundary stays intact:** `packages/shared/`, `packages/parser/`, `packages/core/` remain Node-free and DOM-free; UI may not import `node:*`, `fs`, `chokidar`, `hono`, or any host package.

### the agent's Discretion

- **Transport encoding format**: SSE event payload shape (single envelope vs typed `event:` names), batch size, flush cadence (rAF coalesce on the producer side and/or consumer side).
- **Snapshot delivery**: one-shot REST snapshot endpoint vs initial SSE burst before tail. (Recommendation below.)
- **AppState location**: a new `packages/server/src/app-state.ts` vs lifting it into `packages/core/`. (Recommendation below.)
- **Direction inference**: how the normalizer learns `dir` from real JSONL (lift from envelope vs heuristic by `kind`+`method`).
- **Browser auto-open** library choice (`open` vs Node's experimental no-deps approach).
- **Test boundary refactor**: how to express "UI may use React but not Node" without losing Phase-1 portable guarantees.

### Deferred Ideas (OUT OF SCOPE)

- Detail pane content, JSON pretty/raw, copy actions, Shiki — Phase 3.
- Search index (Orama), filter chips, time-range, AND/OR semantics — Phase 3.
- Session/turn grouping toggle, sticky group headers — Phase 3.
- Live-tail UX (`following`/`paused`/jump-to-live pill), discovery picker — Phase 4.
- Light theme, hacker theme, theme switcher, persistence — Phase 5.
- Playwright E2E, visual regression — Phase 5 (Phase 2 lays the seam: the dev server must be launchable headlessly so Phase 5 can drive it).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **INGEST-01** | Open AHP JSONL log via CLI file path arg | Already wired in Phase 1 CLI; Phase 2 hardens error copy (UI-SPEC §10 CLI rows) and removes the `dir='c2s'` placeholder. See §"Standard Stack" → `commander`, §"Architecture Patterns" → CLI Boot. |
| **INGEST-06** | Clear parse-error rows for malformed JSONL while neighbors load | Parser already emits `parse-error` events via `makeParseErrorEvent`. Phase 2 work = ParseErrorRow component + projection passes `parseError.reason` and computed `line` (index in stream) to UI. UI-SPEC §7.3 row state. |
| **EVENT-04** | Correlated requests show response status + latency | Correlator already computes `pairIdx`/`latencyMs`/`status`. Projection must zip these into the `EventRow` so UI never reaches into Correlator. Latency banding per UI-SPEC §5.4. |
| **EVENT-05** | Unmatched/orphan/failed/malformed visually distinguishable | `Status` enum already includes `'unmatched'`, `'orphan'`, plus `parse === 'error'` events. Map to row left-rail + status column per UI-SPEC §7.1/§7.3. Add Correlator `flush()` ticker (server-side, every ~1s) so unmatched aging actually fires. |
| **TIME-01** | Virtualized timeline responsive on tens of thousands of events | TanStack Virtual 3.13.x with fixed `--row-height: 28px` (UI-SPEC §2). Fixed-height = no `measureElement` overhead. SSE batches coalesced per rAF on the UI side. |
| **TIME-02** | Row shows timestamp/dir/kind/method/status/latency/session/turn/IDs/preview | All columns enumerated in UI-SPEC §7.2. Projection includes `tsFmt`, `dirGlyph`, `kindTag`, `method`, `sessionShort`, `turnShort`, `status`, `latencyMs`, `keyId`, `payloadPreview`. |
| **TIME-03** | Visual encoding for direction/kind/success-error/action taxonomy/latency severity | Token system in UI-SPEC §4–§5; action family derivation per UI-SPEC §5.3. |
| **TIME-06** | Useful empty / loading / no-results / parse-error / disconnected states | UI-SPEC §8 + §10. ServerNotRunningState renders only when the static UI is loaded outside the CLI launcher (e.g., user refreshes after `Ctrl-C`). |

## Standard Stack

### Core (additions for Phase 2 — verified against npm registry on 2026-05-07)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | 19.2.6 | UI runtime | [VERIFIED: npm view] React 19 stable; matches UI-SPEC §13. |
| `react-dom` | 19.2.6 | DOM renderer | [VERIFIED: npm view] paired with react@19. |
| `@tanstack/react-virtual` | 3.13.24 | Row virtualization | [VERIFIED: npm view] de-facto choice for dynamic-height/large-list virt; we only need fixed-height in Phase 2 — `useVirtualizer({ count, estimateSize: () => 28, getScrollElement, overscan: 12 })`. [CITED: tanstack.com/virtual/latest] |
| `zustand` | 5.0.13 | Single-document state | [VERIFIED: npm view] tiny, no provider, plays well with selectors and `useSyncExternalStore` — no Redux ceremony. |
| `vite` | 8.0.10 | UI bundler + dev server | [VERIFIED: npm view] standard React stack. **Note:** Vite 8 raised the Node minimum and changed default targets vs Vite 5 the SUMMARY referenced — verify plugin compatibility at install time. [ASSUMED] Vite 8 is fully compatible with React 19; if not, pin to Vite 5.x. |
| `@vitejs/plugin-react` | 6.0.1 | React Fast Refresh + JSX | [VERIFIED: npm view] |
| `tailwindcss` | 4.2.4 | Utility CSS over CSS variables | [VERIFIED: npm view] v4 uses CSS-first `@theme` config — direct match for UI-SPEC §12 token manifest. |
| `@tailwindcss/vite` | 4.2.4 | Tailwind v4 Vite plugin | [VERIFIED: npm view] preferred over PostCSS in v4. |
| `lucide-react` | 1.14.0 | Icon set | [VERIFIED: npm view] tree-shaken, self-bundled. UI-SPEC names `file-json`, `loader-2`. **Pinning concern:** the `1.x` series is recent — confirm icon names exist before locking. [ASSUMED] both icons present. |
| `open` | 11.0.0 | Cross-platform browser launch from CLI | [VERIFIED: npm view] `await open(url)` opens default browser; honors `BROWSER` env var; refuses to open if env says `none`. |

### Supporting (already installed in Phase 1)

| Library | Version | Purpose |
|---------|---------|---------|
| `hono` | 4.12.18 | Server framework — already wired |
| `@hono/node-server` | 1.14.x | Node adapter — already wired |
| `commander` | 14.0.3 | CLI parser — already wired |
| `chokidar` | 4.x | File watching — already wired in NodeHostAdapter |
| `vitest` | 4.1.5 | Test runner — root config already present |

### Test additions

| Library | Version | Purpose |
|---------|---------|---------|
| `@testing-library/react` | 16.3.2 | React component tests | [VERIFIED: npm view] requires React 19 peer. |
| `@testing-library/user-event` | 14.6.1 | Keyboard/click interactions | [VERIFIED: npm view] |
| `jsdom` | 29.1.1 | DOM env for Vitest | [VERIFIED: npm view] **Alternative:** `happy-dom` 20.9.0 (faster); jsdom is safer for `getBoundingClientRect`/scroll behaviors needed by virtualization tests. Recommend **jsdom**. |
| `eventsource` | 4.1.0 | Server-side SSE client for integration tests | [VERIFIED: npm view] Node 22 has global `EventSource` since 22.4.0 — **preferred** to avoid the dep, but `eventsource` is the fallback if quirks appear. [CITED: nodejs.org/api/globals.html#eventsource] [ASSUMED] global `EventSource` works for our SSE shape. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Virtual | `react-window` / `react-virtuoso` | Both viable. TanStack is already in SUMMARY's recommended stack and ships dynamic-height (free upgrade path for Phase 3 detail-row expansion). |
| Zustand | `useSyncExternalStore` only | The store is non-trivial enough (selection + connection + projection cursor) that Zustand earns its 1KB. |
| SSE | WebSocket | SSE is one-way (server → browser), auto-reconnects, works through any HTTP proxy, has no framing protocol to debug. We only need server-push; clicking a row doesn't need to round-trip. WebSocket reintroduced only if Phase 3 adds bidirectional commands. |
| `open` (npm) | `child_process.exec('open'/'xdg-open'/...)` | `open` handles platform quirks (WSL, Linux flavors, BROWSER=none) and is one allow-listed dep — cheap. |

**Installation (planner reference):**
```bash
pnpm -F @ahp-viewer/cli add open
pnpm -F @ahp-viewer/server add  # no new deps; reuse hono
pnpm add -w -D @testing-library/react @testing-library/user-event jsdom
# new package:
pnpm -F @ahp-viewer/ui add react react-dom @tanstack/react-virtual zustand lucide-react
pnpm -F @ahp-viewer/ui add -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite @types/react @types/react-dom
```

**Allow-list test extension required:** add `react`, `react-dom`, `@tanstack/react-virtual`, `zustand`, `lucide-react`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `open`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@types/react`, `@types/react-dom`, and `@ahp-viewer/ui` to `test/security.test.ts` `ALLOW`. Without this, Wave 0 will fail.

## Architecture Patterns

### Recommended Project Structure (additions to existing)

```
packages/
├── shared/         # (unchanged) AhpEvent, HostAdapter, HostMessage
├── parser/         # (unchanged) JSONL + normalizer
├── core/           # ADD: row-projection.ts, projector.ts (subscribes to store+correlator)
├── host-node/      # (unchanged) NodeHostAdapter, TailReader
├── server/         # ADD: app-state.ts, sse-routes.ts, static-routes.ts, csp.ts; extend index.ts
├── cli/            # MODIFY: wire AppState + open browser; remove dir='c2s' placeholder
└── ui/             # NEW
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    ├── public/fonts/{inter,jetbrains-mono}/   # vendored .woff2
    └── src/
        ├── main.tsx
        ├── app.tsx
        ├── styles/{tokens.css,global.css}
        ├── transport/sse-client.ts
        ├── store/{app-store.ts,selectors.ts}
        ├── components/
        │   ├── shell/{AppShell,HeaderBar,SourceStrip,StatusBar}.tsx
        │   ├── timeline/{TimelineRegion,TimelineList,EventRow,ParseErrorRow}.tsx
        │   ├── timeline/cells/{DirectionGlyph,KindTag,ActionDot,StatusCell,LatencyCell,PayloadPreview}.tsx
        │   ├── states/{EmptyState,LoadingState,NoResultsBanner,DisconnectedBanner,ServerNotRunningState}.tsx
        │   └── detail/DetailRailPlaceholder.tsx
        └── test/  # *.test.tsx
test/
├── boundary.test.ts          # MODIFY: separate UI rules from portable rules
├── security.test.ts          # MODIFY: extend ALLOW
├── csp.test.ts               # NEW: assert CSP header is sent and contents
└── sse-integration.test.ts   # NEW: spin server, feed JSONL, drain SSE, assert delta shape
```

### Pattern 1: Row Projection — Single Source of Truth for the UI

**What:** A pure-function projection from `(AhpEvent, Correlator slot)` to a `EventRow` DTO that contains every value the timeline cell renders. Computed once on append (in `core/projector.ts` via `store.subscribe`), stored in a parallel array, and snapshotted/streamed over SSE.

**When to use:** Always — the UI must never read `Correlator` directly. This keeps SSE deltas tiny and makes Phase 3 search/filter trivially correct (one canonical view per event).

**Example:**
```ts
// packages/core/src/row-projection.ts
export interface EventRow {
  readonly idx: number;            // position in store
  readonly seq: number;
  readonly ts: number;
  readonly tsFmt: string;          // 'HH:mm:ss.SSS' UTC
  readonly dir: Direction;
  readonly kind: EventKind;
  readonly method: string | null;
  readonly actionType: string | null;
  readonly actionFamily: ActionFamily | null;  // derived per UI-SPEC §5.3
  readonly sessionId: string | null;
  readonly sessionShort: string | null;        // last 8 chars
  readonly turnId: string | null;
  readonly turnShort: string | null;
  readonly status: Status | null;              // 'ok' | 'error' | 'pending' | 'unmatched' | 'orphan' | 'n/a'
  readonly statusCode: number | null;          // HTTP-ish or RPC code when present
  readonly latencyMs: number | null;
  readonly latencyBand: 'fast' | 'normal' | 'slow' | 'critical' | null;
  readonly keyId: string | null;
  readonly payloadPreview: string;             // ≤120 chars, whitespace-collapsed
  readonly parseError: { line: number; reason: string } | null;
}
```

### Pattern 2: SSE Transport — Snapshot Burst then Tail

**What:** Single SSE endpoint `GET /api/log/stream`. On connect: server sends one `event: snapshot` containing the entire current projection as JSON (or, for very large logs, paginated `event: snapshot-chunk` frames followed by `event: snapshot-end`), then transitions to `event: append` deltas as the store appends. Heartbeat (`event: ping`, every 20s) keeps proxies/middleboxes from closing the connection.

**Why not WebSocket:** see Alternatives. SSE auto-reconnect via `EventSource` does much of the disconnect/retry UX work for free.

**Frame shapes:**
```ts
// Server → client SSE event payloads (each is JSON-encoded data:)
type SsePayload =
  | { kind: 'snapshot'; rows: EventRow[]; cursor: number; meta: LogMeta }
  | { kind: 'append'; rows: EventRow[]; cursor: number }
  | { kind: 'patch'; updates: Array<{ idx: number; fields: Partial<EventRow> }> } // for late correlation
  | { kind: 'ping' }
  | { kind: 'error'; code: string; message: string };

interface LogMeta {
  filename: string;       // basename only — never absolute path
  sizeBytes: number;
  startedAt: number;      // server epoch ms
}
```

**Late-correlation patch:** when a response arrives later and pairs to a request, the request's row's `status`/`latencyMs`/`latencyBand` change. Server emits an `event: patch` so the UI updates only those rows in place — no full snapshot.

**Hono SSE handler:**
```ts
// Source: hono.dev/docs/helpers/streaming
import { streamSSE } from 'hono/streaming';
app.get('/api/log/stream', (c) => streamSSE(c, async (stream) => {
  const off = appState.subscribe((evt) => stream.writeSSE({ event: evt.kind, data: JSON.stringify(evt) }));
  c.req.raw.signal.addEventListener('abort', off);
  // initial snapshot:
  await stream.writeSSE({ event: 'snapshot', data: JSON.stringify(appState.snapshot()) });
  // heartbeat loop:
  while (!c.req.raw.signal.aborted) {
    await stream.sleep(20_000);
    await stream.writeSSE({ event: 'ping', data: '{}' });
  }
}));
```
[CITED: hono.dev/docs/helpers/streaming — `streamSSE`, `writeSSE`, `sleep`]

### Pattern 3: AppState — Server-Side Single-Open-Log Holder

**What:** A small class in `packages/server/src/app-state.ts` that owns `{ host: HostAdapter, store: EventStore, correlator: Correlator, projector: Projector, splitter: LineSplitter, decoder, watcherDispose, meta: LogMeta }` and exposes `snapshot()` + `subscribe(listener)`. CLI constructs it; routes consume it.

**Why server-side, not core:** depends on `host-node` and lives behind the SSE seam. Keeps `core/` portable. (A symmetrical `BrowserAppState` will live in a future webview host.)

**Subscriber coalescing:** the projector subscribes to the store and emits per-append `EventRow`s into an internal queue. A `setInterval(16ms)` (≈60Hz) drains the queue and fires `append` events to listeners — this is the producer-side rAF equivalent. Without coalescing, an SSE write per JSONL line on a 100K-event initial load floods both the server and the browser.

### Pattern 4: Static UI Serving + CSP

**What:** Server serves the built UI from `packages/ui/dist/` at `/` for production, and proxies to `vite dev` at `http://127.0.0.1:5174` only when `NODE_ENV=development`. Either way, every response carries:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data:;
  connect-src 'self';
  object-src 'none';
  base-uri 'none';
  frame-ancestors 'none';
```
[CITED: developer.mozilla.org/en-US/docs/Web/HTTP/CSP] `'unsafe-inline'` for `style-src` is acceptable for Tailwind v4's emitted `<style>` blocks; Phase 5 may tighten to a hash if visual regression catches everything.

**Why no `script-src 'unsafe-inline'`:** Vite's prod build does not need it; modules are external `<script type="module" src="/assets/...">`.

### Pattern 5: CLI Boot Sequence

```
1. Parse argv (commander) → { file, port }
2. If !file: print server-not-running help text and exit 0 (UI-SPEC §10 server-not-running)
3. Construct AppState (open file, start watcher, seed store)
4. Start server on 127.0.0.1:port (port=0 picks ephemeral; print resolved URL)
5. Print "AHP Log Viewer running at http://127.0.0.1:{port}\nOpening browser…\nWatching {abs_path}" (UI-SPEC §10)
6. await open(url) — pass {wait:false}; on failure log "Open this URL: {url}" but don't exit
7. SIGINT/SIGTERM → AppState.dispose() → server.close()
```

**Direction inference (removes Phase-1 placeholder):** the Phase-1 normalizer expects `meta.dir` from the caller. Phase 2 either (a) lifts `dir` from a wire-level envelope field if VS Code emits one, or (b) infers from JSON-RPC structure: messages with `id`+`method` and no `result/error` are requests (direction depends on who sent — for a single-host VS Code log every request from VS Code is `c2s`); `result`/`error` ⇒ response in the opposite direction; `method:"action"` and `method:"notification"` are server-originated (s2c). **Recommendation:** add a `Normalizer.classifyDirection(raw)` helper that returns a `Direction` from the JSON-RPC shape, defaulting to `c2s` only for outbound requests. Document the assumption ("this CLI views client-side logs; for a server-side log, set `--source server` in a future flag"). [ASSUMED] real VS Code JSONL emits enough structure to classify; confirm against a sample before locking.

### Anti-Patterns to Avoid

- **Don't** stream raw `AhpEvent`s to the UI — payloads can be large, the UI doesn't need them in Phase 2 (only the projection's `payloadPreview`). Phase 3 detail view will fetch full raw on demand via `GET /api/log/event/:idx`.
- **Don't** subscribe React components directly to the EventStore — Zustand owns the bridge; components select slices. Otherwise every append re-renders every row.
- **Don't** use `react-window` + manual `forwardRef` plumbing for headers/footers — TanStack Virtual gives a `getVirtualItems()` API that works inside any scroll container we own.
- **Don't** pass absolute file paths to the browser. UI-SPEC §10 says basename in the source strip. Server-side `LogMeta.filename = basename(path)`.
- **Don't** add a service worker, IndexedDB, or `localStorage` reads in Phase 2 — Phase 5 owns persistence via the host adapter (`Host.readSettings`/`writeSettings`).
- **Don't** use `requestIdleCallback` for projection — it's unsupported in Safari and unnecessary at our cadence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform browser launching | `child_process.exec('open'/'xdg-open'/'start')` | `open` (npm) | WSL detection, BROWSER=none honoring, error normalization |
| Virtualized scroll list with selection + keyboard | Custom IntersectionObserver / sticky offset math | `@tanstack/react-virtual` | Months of edge cases (resize observer, scroll restoration, overscan tuning) already solved |
| SSE framing | Manual `Transfer-Encoding: chunked` writes | `hono/streaming` `streamSSE` | Aborts, headers, double-newline framing handled |
| SSE client + reconnect | Manual `fetch` with `ReadableStream` | Browser's built-in `EventSource` | Auto-reconnect with last-event-id; battle-tested |
| Argument parsing + help text | Hand-written switch | `commander` (already in repo) | We get the help, version, and error formatting for free |
| State management for selection + connection + projection cursor | Module-scoped singletons + custom subscribe | `zustand` | Selectors, devtools, no provider, ~1KB |
| Date formatting | `Date.toISOString().slice(11,23)` everywhere | A single `formatTs()` helper in `core/` | Centralizes UTC + tabular-nums concern |

**Key insight:** every Phase 2 widget (shell, status pill, kind tag, latency cell) is custom. Don't fight the bespoke surface — that is the product. *Do* lean on the ecosystem for the three things that are not the product: virtualization, SSE plumbing, and browser launch.

## Common Pitfalls

### Pitfall 1: Boundary Test Already Forbids React in `packages/ui/src`
**What goes wrong:** `test/boundary.test.ts` lists `packages/ui/src` in `PORTABLE_ROOTS`, with `react`/`react-dom`/`vite` in `FORBIDDEN_PATTERNS`. The first React import will fail Wave 0.
**Why it happens:** Phase 1 future-proofed against UI accidentally importing host code, but used the *portable* forbidden list.
**How to avoid:** First task in Wave 0 of Phase 2 is to refactor the boundary test:
- Keep `PORTABLE_ROOTS = [shared, parser, core]` with the existing forbidden list.
- Add a new `UI_ROOTS = [packages/ui/src]` with `UI_FORBIDDEN_PATTERNS = [/^node:/, /^fs$/, /^fs\//, /^path$/, /^chokidar$/, /^hono($|\/)/, /^@hono\//, /^@ahp-viewer\/host-node($|\/)/, /^@ahp-viewer\/server($|\/)/]`.
- Add tests asserting the UI roots scan runs and is non-trivial (≥1 file scanned once UI exists).

**Warning signs:** if the boundary refactor lands *after* the first UI file, CI is red and people start commenting `// biome-ignore`. Refactor first.

### Pitfall 2: Forgetting `Correlator.flush()` Means `unmatched` Never Appears
**What goes wrong:** UI-SPEC requires unmatched rows. Correlator's `unmatched` status only triggers via `flush(now, 30_000)`; nothing in Phase 1 calls it.
**How to avoid:** AppState owns a `setInterval(1000)` that calls `correlator.flush(Date.now())`; on each transition, the projector emits a `patch` SSE frame. Stop the interval on dispose.

### Pitfall 3: SSE Initial Snapshot Blocking the Event Loop
**What goes wrong:** A 100K-row JSON.stringify of the snapshot in one go pegs the CPU and stalls the watcher.
**How to avoid:** Chunk the snapshot into ~2,000-row frames (`snapshot-chunk` with cursor) and yield (`await stream.sleep(0)`) between frames. Browser can render the first chunk while the rest stream.

### Pitfall 4: `EventSource` Cannot Set Custom Headers
**What goes wrong:** Phase 4+ might want auth tokens; `EventSource` doesn't support headers.
**How to avoid:** Not a Phase 2 problem — local-only and unauthenticated. Document that any future cross-origin or authenticated use must switch to `fetch`+`ReadableStream` (or WebSocket). Don't preemptively hand-roll.

### Pitfall 5: TanStack Virtual + Tabular Nums + JetBrains Mono Width Drift
**What goes wrong:** Variable-width numerals shift columns, breaking the dense scan UI-SPEC promises.
**How to avoid:** UI-SPEC §3 already specifies `font-variant-numeric: tabular-nums` for timestamps and latency. Apply at the `--text-row` rule and verify with a Vitest snapshot (or just one assertion that computed style includes `tabular-nums`).

### Pitfall 6: Vite Dev Server vs Hono Server Confusion in Tests
**What goes wrong:** Tests import the UI through Vite's dev server, but production serves it from Hono — two CSP/CORS surfaces drift.
**How to avoid:** UI integration tests use the production build (`vite build && hono serves dist`). Component tests use Vitest + jsdom, no server. Reserve dev-server flow for human use only.

### Pitfall 7: SSE Reconnect Storm on Server Shutdown
**What goes wrong:** `EventSource` auto-reconnects forever; closing the CLI floods the browser console with errors.
**How to avoid:** On server `SIGINT`, send one final `event: bye` with HTTP 200 + `Connection: close`, and have the UI listen for `bye` to flip to `disconnected` state and *stop* attempting reconnects until the user clicks "Retry connection" (UI-SPEC §10). EventSource's native reconnect is fine for transient drops; only opt out on graceful shutdown.

### Pitfall 8: CSP `font-src 'self'` Forgotten — Inter/JetBrains Mono Falls Back
**What goes wrong:** Bundled fonts under `/fonts/...` blocked by default CSP if `font-src` not set.
**How to avoid:** Test in `csp.test.ts` asserts the header includes `font-src 'self'`. Visual smoke test confirms a known character renders in JetBrains Mono (compare computed `font-family`).

## Code Examples

### TanStack Virtual fixed-height timeline (TIME-01)
```tsx
// packages/ui/src/components/timeline/TimelineList.tsx
// Source: tanstack.com/virtual/v3/docs/framework/react/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual';
export function TimelineList({ rows, selectedIdx, onSelect }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,    // --row-height
    overscan: 12,
  });
  return (
    <div ref={parentRef} className="timeline-scroll" role="grid"
         aria-rowcount={rows.length}>
      <div style={{ height: v.getTotalSize(), position: 'relative' }}>
        {v.getVirtualItems().map((vi) => {
          const row = rows[vi.index]!;
          return (
            <EventRow key={row.idx} row={row} isSelected={row.idx === selectedIdx}
              onClick={() => onSelect(row.idx)}
              style={{ position: 'absolute', top: 0, left: 0, right: 0,
                       height: 28, transform: `translateY(${vi.start}px)` }} />
          );
        })}
      </div>
    </div>
  );
}
```

### Hono SSE route with snapshot + tail (TIME-01, EVENT-04, EVENT-05)
```ts
// packages/server/src/sse-routes.ts
import { streamSSE } from 'hono/streaming';
import type { AppState } from './app-state.js';

export function registerSseRoutes(app: Hono, state: AppState) {
  app.get('/api/log/stream', (c) => streamSSE(c, async (stream) => {
    // Yield snapshot in chunks of 2000 rows
    const snap = state.snapshot();
    await stream.writeSSE({ event: 'snapshot-begin',
      data: JSON.stringify({ meta: snap.meta, total: snap.rows.length }) });
    for (let i = 0; i < snap.rows.length; i += 2000) {
      await stream.writeSSE({ event: 'snapshot-chunk',
        data: JSON.stringify({ rows: snap.rows.slice(i, i + 2000), from: i }) });
      await stream.sleep(0);
    }
    await stream.writeSSE({ event: 'snapshot-end', data: '{}' });

    const off = state.subscribe(async (msg) => {
      await stream.writeSSE({ event: msg.kind, data: JSON.stringify(msg) });
    });
    c.req.raw.signal.addEventListener('abort', off);

    while (!c.req.raw.signal.aborted) {
      await stream.sleep(20_000);
      await stream.writeSSE({ event: 'ping', data: '{}' });
    }
  }));
}
```

### Browser SSE client with disconnect handling (TIME-06)
```ts
// packages/ui/src/transport/sse-client.ts
export function connect(onMsg: (m: SsePayload) => void, onState: (s: ConnState) => void) {
  const es = new EventSource('/api/log/stream');
  onState('connecting');
  es.addEventListener('snapshot-begin', (e) => onMsg(JSON.parse((e as MessageEvent).data)));
  es.addEventListener('snapshot-chunk', (e) => onMsg(JSON.parse((e as MessageEvent).data)));
  es.addEventListener('snapshot-end',   () => onState('connected'));
  es.addEventListener('append', (e) => onMsg(JSON.parse((e as MessageEvent).data)));
  es.addEventListener('patch',  (e) => onMsg(JSON.parse((e as MessageEvent).data)));
  es.addEventListener('bye',    () => { es.close(); onState('disconnected'); });
  es.onerror = () => onState(es.readyState === EventSource.CLOSED ? 'disconnected' : 'connecting');
  return () => es.close();
}
```

### Browser open from CLI (INGEST-01)
```ts
// packages/cli/src/index.ts (excerpt)
// Source: github.com/sindresorhus/open#readme
import open from 'open';
const url = `http://127.0.0.1:${serverHandle.port}`;
console.log(`AHP Log Viewer running at ${url}\nOpening browser…\nWatching ${absPath}`);
try { await open(url, { wait: false }); }
catch { console.log(`(could not auto-open; visit ${url})`); }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 + `tailwind.config.js` + PostCSS | Tailwind v4 `@theme` + `@tailwindcss/vite` plugin | Tailwind v4 GA (2025) | UI-SPEC tokens map directly to `@theme` block; no JS config |
| Server-Sent Events shimmed via `eventsource` package in Node | Built-in global `EventSource` (Node ≥22.4) | Node 22.4 LTS | Drop the dep in tests where possible; keep `eventsource@4` only as fallback |
| `react-window` | `@tanstack/react-virtual` v3 | TanStack v3 (2023) | Better TS, dynamic-height ready, framework-agnostic core |
| Hono SSE via raw `c.body(new ReadableStream(...))` | `streamSSE` helper from `hono/streaming` | Hono ≥3.10 | Aborts, framing, heartbeats handled |

**Deprecated/outdated:**
- React 18-only patterns (e.g., manual `act()` wrapping in tests) — React 19 + RTL 16 hide most of this. Don't import `act` directly.
- The Phase-1 placeholder `dir = 'c2s'` in `packages/cli/src/index.ts` — must be removed in Phase 2.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (root config `vitest.config.ts` already present) + `@testing-library/react` 16.3.2 + jsdom 29.1.1 |
| Config file | `vitest.config.ts` (root, project-shared); `packages/ui/vitest.config.ts` for jsdom env override |
| Quick run command | `pnpm vitest run --changed` |
| Full suite command | `pnpm vitest run && pnpm -F @ahp-viewer/ui build` |
| Phase-2 gate | `pnpm test && pnpm -F @ahp-viewer/ui build && pnpm -F @ahp-viewer/cli build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INGEST-01 | CLI accepts `<file>` arg, opens log, prints expected lines, exits cleanly on SIGINT | integration | `pnpm vitest run packages/cli/src/cli-launch.test.ts` | ❌ Wave 0 |
| INGEST-01 | CLI exits 1 with UI-SPEC §10 copy on missing file | integration | `pnpm vitest run packages/cli/src/cli-errors.test.ts` | ❌ Wave 0 |
| INGEST-06 | ParseErrorRow renders `BAD · line {n} · {reason}` for parse-error events | unit | `pnpm vitest run packages/ui/src/components/timeline/ParseErrorRow.test.tsx` | ❌ Wave 0 |
| EVENT-04 | Projection emits `latencyMs` + `latencyBand` + `status='ok'` on a paired req/resp | unit | `pnpm vitest run packages/core/src/row-projection.test.ts` | ❌ Wave 0 |
| EVENT-04 | `patch` SSE frame fires when a late response correlates a previously pending request | integration | `pnpm vitest run test/sse-integration.test.ts -t 'late patch'` | ❌ Wave 0 |
| EVENT-05 | Orphan response → `status='orphan'` and row left-rail uses `--color-warning` token (style-attr inspection) | unit | `pnpm vitest run packages/ui/src/components/timeline/EventRow.orphan.test.tsx` | ❌ Wave 0 |
| EVENT-05 | Unmatched request fires after `Correlator.flush(now+30s)` | unit | `pnpm vitest run packages/core/src/correlator.flush.test.ts` (extend existing if any) | ❌ Wave 0 |
| TIME-01 | `TimelineList` mounts with 50,000 rows in jsdom and renders ≤ overscan+visible (≈30) DOM rows | unit | `pnpm vitest run packages/ui/src/components/timeline/TimelineList.virt.test.tsx` | ❌ Wave 0 |
| TIME-02 | `EventRow` renders all 11 columns from a fixture `EventRow` projection | unit | `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx` | ❌ Wave 0 |
| TIME-03 | DirectionGlyph/KindTag/StatusCell/LatencyCell use the right CSS variable per kind/status/band | unit | `pnpm vitest run packages/ui/src/components/timeline/cells/*.test.tsx` | ❌ Wave 0 |
| TIME-06 | Each of EmptyState / LoadingState / NoResultsBanner / DisconnectedBanner / ServerNotRunningState renders the verbatim UI-SPEC §10 copy | unit | `pnpm vitest run packages/ui/src/components/states/*.test.tsx` | ❌ Wave 0 |
| FOUND-04 (re-check) | `/api/log/stream` headers include `Content-Security-Policy: ... connect-src 'self'; ...` and server bound 127.0.0.1 | integration | `pnpm vitest run test/csp.test.ts` | ❌ Wave 0 |
| Boundary | UI may import react; portable packages still cannot | structural | `pnpm vitest run test/boundary.test.ts` | ✅ exists, MUST modify |
| Allow-list | New deps all in ALLOW set | structural | `pnpm vitest run test/security.test.ts` | ✅ exists, MUST modify |
| Manual-only | Visible "smoothness" on a real 50K-line log in a real browser | manual | n/a | n/a — captured as a Phase-5 Playwright concern; document as a manual smoke step |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --changed` (fast feedback on edited files)
- **Per wave merge:** `pnpm vitest run` (full Vitest suite)
- **Phase gate:** `pnpm vitest run && pnpm -F @ahp-viewer/ui build && pnpm -F @ahp-viewer/cli build && pnpm typecheck` — all green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/boundary.test.ts` — refactor to split portable vs UI roots (see Pitfall 1)
- [ ] `test/security.test.ts` — extend `ALLOW` set with the Phase-2 dependency list
- [ ] `test/csp.test.ts` — assert CSP header content on every server response
- [ ] `test/sse-integration.test.ts` — server + JSONL fixture + EventSource (or `fetch` stream) drain
- [ ] `packages/ui/` package skeleton: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` (jsdom env), `index.html`
- [ ] `packages/ui/src/test-setup.ts` — RTL setup, `@testing-library/jest-dom` matchers (verify allow-list)
- [ ] `packages/ui/public/fonts/` — vendored Inter & JetBrains Mono `.woff2` (LICENSE files included; UI-SPEC §13 forbids CDN)
- [ ] `packages/core/src/row-projection.test.ts` — projection contract for §7.2 columns
- [ ] `packages/core/src/projector.ts` + test — append-driven projection emission
- [ ] `packages/server/src/app-state.ts` + `sse-routes.ts` + `csp.ts` + tests
- [ ] `packages/cli/src/cli-launch.test.ts` & `cli-errors.test.ts` — spawn the CLI as a child process; capture stdout
- [ ] Framework install: `pnpm add -w -D @testing-library/react @testing-library/user-event jsdom @testing-library/jest-dom`

## Security Domain

Per `.planning/config.json` `workflow.nyquist_validation: true`; security_enforcement default = enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local-only loopback, single-user dev tool — out of scope by design |
| V3 Session Management | no | No sessions; no cookies |
| V4 Access Control | no | No multi-user model |
| V5 Input Validation | yes | JSONL parser already tolerant (Phase 1); CLI argv goes through Node `path.resolve` + `statSync` (Phase 1); `--port` is `Number()`-coerced — add a validity check (1–65535 or 0 for ephemeral). |
| V6 Cryptography | n/a | No crypto in Phase 2 |
| V14 Configuration | yes | CSP header on every response; `127.0.0.1` bind hardcoded (Phase 1 test enforces); no `0.0.0.0` regression possible |

### Known Threat Patterns for {Hono SSE + local CLI + browser UI}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DNS rebinding (browser tab on a malicious site reaches `127.0.0.1:port`) | Spoofing / Info disclosure | Set `Host` header allow-list on the server (only accept `Host: 127.0.0.1[:port]` or `localhost[:port]`); reject other Host values with 421 |
| Cross-site request forgery to local server | Tampering | Same Host-header check + CSP `frame-ancestors 'none'` + SSE only responds to `Accept: text/event-stream` GETs; no state-changing endpoints exist in Phase 2 |
| Sensitive log paths leaked to browser/UI | Info disclosure | `LogMeta.filename` is `basename(path)` only; absolute path stays server-side and is logged to terminal once at startup |
| Malformed JSONL crashes server | DoS | Tolerant parser (Phase 1); per-line try/catch; per-row size cap on `payloadPreview` (already 120 chars) and on raw text in parse-error events (Phase 1 cap 8KB UTF-8) |
| Compromised CDN font/script | Tampering | No CDN — fonts/icons vendored; CSP `default-src 'self'`; no `unsafe-eval`; allow-list test prevents drift |
| Long-running SSE connection memory leak | DoS | `c.req.raw.signal.abort` cleans up subscriber; ping every 20s detects stale conns; AppState retains only one open log |
| Path traversal via CLI arg | Tampering | Phase 1 NodeHostAdapter resolves to absolute and stats; error messages echo `basename` only — covered |

**New mitigation to ship in Phase 2:** Host-header validation middleware in the server. ~10 lines, asserted by a unit test that POSTs with `Host: evil.com` and expects 421.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥22 | Phase 2 runtime | ✓ (Phase 1 declared `engines.node ">=22"`) | 22.x | — |
| pnpm 9.15 | Workspace install | ✓ (Phase 1) | 9.15.0 | — |
| Default browser on user's OS | `open` package launches it | ✓ (assumed; soft requirement) | — | If launch fails: print URL and let user paste — covered in CLI Boot pattern |
| Internet access | none in runtime | n/a | — | — (local-only by design) |
| Inter Variable + JetBrains Mono Variable `.woff2` files | UI-SPEC §13 self-hosted fonts | ✗ (not yet vendored) | — | None — must be added under `packages/ui/public/fonts/` (download once, commit, with LICENSE) |
| `agent-host-protocol` sibling repo | Type re-exports | ✓ (Phase 1) | — | — |

**Missing dependencies with no fallback:** Inter Variable + JetBrains Mono Variable webfont files — block UI work until vendored. Not technically blocking the SSE/server tasks, so plan should land fonts as an early Wave-1 task in parallel with UI scaffolding.

**Missing dependencies with fallback:** browser auto-open — fallback handled in CLI code.

## Dependency / Wave Recommendations

**Hard ordering:**
1. **Wave 0 (foundations, sequential):** boundary-test refactor → allow-list extension → `packages/ui/` package skeleton + jsdom setup → row-projection contract published from `core/`.
2. **Wave 1 (parallelizable across teams once Wave 0 lands):**
   - **Track A (server):** `AppState`, `Projector`, `sse-routes.ts`, `csp.ts`, `Host`-header middleware, integration tests.
   - **Track B (UI shell + states):** `AppShell`, `HeaderBar`, `SourceStrip`, `StatusBar`, all 5 screen-level state components, token CSS, font vendoring.
   - **Track C (CLI):** browser-open wiring, error copy, `--port` validation, `cli-launch.test.ts`, removal of `dir='c2s'` placeholder + direction inference.
   - **Track D (timeline UI):** `TimelineList`, `EventRow`, `ParseErrorRow`, all cell components, virtualization tests. **Depends on row-projection contract from Wave 0** but not on any Track A/B/C runtime — uses fixture `EventRow[]`.
3. **Wave 2 (integration, sequential):** wire Track D to Track A's SSE via Track B's shell; end-to-end Vitest integration test that boots the server with a fixture file and asserts the rendered DOM matches expected row counts. Final Phase-2 gate.

**Critical seam = `EventRow` interface in `packages/core/`.** Define it in Wave 0 and lock it. Tracks A and D both depend on it; if it's still in flux when they start, they will diverge.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite 8 + React 19 + Tailwind v4 + `@tailwindcss/vite` 4.2.4 are mutually compatible without manual config gymnastics | Standard Stack | Low — fall back to Vite 5.x; well-documented downgrade |
| A2 | Real VS Code AHP JSONL contains enough structure for direction inference from JSON-RPC shape alone | Pattern 5 / direction inference | Medium — if not, normalizer must read a sample-specific envelope field; affects only `cli/` + `parser/normalizer.ts` |
| A3 | Node 22's global `EventSource` works for our SSE shape end-to-end (used by integration tests if we adopt it) | Standard Stack note | Low — `eventsource@4.1.0` is the trivial fallback |
| A4 | jsdom (not happy-dom) is the right call for virtualization tests (scroll/getBoundingClientRect fidelity) | Standard Stack — Test additions | Low — both work for non-scroll tests; switching env is config-only |
| A5 | `lucide-react` 1.x exposes `file-json` and `loader-2` icons under those names | Standard Stack | Low — pick from available set; UI-SPEC permits any equivalent file/loader glyph |
| A6 | Phase 5 will accept Phase 2's CSP `style-src 'self' 'unsafe-inline'` as a stepping stone before tightening to hashes | Pattern 4 / CSP | Low — additive change later |
| A7 | Latency banding thresholds (UI-SPEC §5.4) are computed from `latencyMs` only; no per-method calibration in Phase 2 | Row Projection | Low — banding lives in projection, easy to extend |

## Open Questions

1. **Should the snapshot be one large frame or chunked?**
   - What we know: 100K events × ~200 bytes/projection ≈ 20MB JSON. Browser `JSON.parse` of 20MB is ~200ms; SSE write of 20MB pegs the loop briefly.
   - What's unclear: target log size for Phase 2 success criteria ("tens of thousands" — let's bound at 200K).
   - Recommendation: chunk at 2,000 rows always; uniform behavior, predictable memory, one code path. Resolved.

2. **Does AppState belong in `core/` or `server/`?**
   - What we know: `core/` is portable; `server/` already imports `host-node`.
   - What's unclear: future webview host wants symmetry.
   - Recommendation: **place in `server/` for Phase 2** (depends on `host-node`). When the VS Code host arrives, refactor to `core/AbstractAppState` + `server/NodeAppState` + `webview/VsCodeAppState`. Premature now. Resolved.

3. **What happens if the CLI is invoked twice?**
   - What we know: second invocation gets `EADDRINUSE`.
   - What's unclear: should the second invocation `open` the existing tab?
   - Recommendation: out of scope for Phase 2 — the existing UI-SPEC §10 copy `Error: port {port} is in use. Try: ahp-viewer --port {port+1} {path}` is the contract. Defer cross-instance handoff to Phase 4. Resolved.

## Sources

### Primary (HIGH confidence)
- `/Users/roblou/code/ahp-viewer/.planning/phases/01-core-foundations/01-VERIFICATION.md` — Phase 1 capabilities & gaps
- `/Users/roblou/code/ahp-viewer/.planning/phases/02-vertical-slice-cli-server-timeline/02-UI-SPEC.md` — locked design contract
- `/Users/roblou/code/ahp-viewer/packages/{cli,server,host-node,core,shared,parser}/src/**` — actual current code
- `npm view` for every Phase-2 package version (2026-05-07)
- hono.dev — `streamSSE` API contract (`hono/streaming`)
- tanstack.com/virtual/v3 — `useVirtualizer` reference
- developer.mozilla.org — Content-Security-Policy directives
- nodejs.org/api/globals.html#eventsource — Node 22 global EventSource
- github.com/sindresorhus/open — cross-platform browser open

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — recommended stack rationale
- React 19 + RTL 16 patterns — verified via `@testing-library/react` 16.3.2 release notes (peer-deps require react@19)

### Tertiary (LOW confidence — flagged in Assumptions Log)
- Real VS Code AHP JSONL envelope shape (A2)
- Vite 8 + Tailwind 4 + React 19 stack interop (A1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version verified via `npm view` 2026-05-07; Phase-1 stack already proven
- Architecture: HIGH — pattern is canonical (snapshot+tail SSE, projection-on-append, virtualized list); the only novel piece is the `EventRow` projection, which is a small file
- Pitfalls: HIGH — Pitfall 1 (boundary-test conflict) verified by reading the test file; Pitfalls 2–8 are well-known per category research; one assumption (A2) flagged for confirmation against a real VS Code log before locking direction inference

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days — Vite 8 / Tailwind v4 are recent; revalidate if planning slips)
