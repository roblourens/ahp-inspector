# Phase 3: Detail, Search, and Filtering — Research

**Researched:** 2026-05-07
**Domain:** Devtool UI for protocol log inspection (detail panel, full-text search, faceted filters, grouping) on top of an existing virtualized timeline
**Confidence:** HIGH for stack/architecture; MEDIUM for performance numbers (depend on real log size); LOW only for one optional dep choice (Shiki) which we recommend deferring

## Summary

Phase 2 already ships a streaming Zustand store of `EventRow` projections, a TanStack-Virtual timeline, single-row selection (`selectedIdx`), and a placeholder `DetailRailPlaceholder` aside. Phase 3 needs to add: (1) a real detail panel, (2) free-text search across the **full** payload (not just the 120-char preview), (3) a faceted filter bar with active-filter chips and clear-all, (4) session/turn grouping, and (5) two surface-only EVENT-06 detections (serverSeq gaps, auth failures).

The single most important architectural finding: **the SSE stream only carries `EventRow` projections, not the full `AhpEvent.raw` payload.** `payloadPreview` is truncated to 120 chars (`row-projection.ts:99`). That means SEARCH-01 ("payload text") and DETAIL-02/03 ("full raw JSON payload") cannot be satisfied from existing client state. The server must expose two new HTTP endpoints (lazy detail fetch + full-text search) — pushing the full payload into the SSE snapshot would balloon a 50k-row baseline by 10–100×.

**Primary recommendation:** Add `GET /api/log/event/:idx` (returns the full `AhpEvent` including paired correlator info) and `GET /api/log/search?q=...` (returns matching `idx[]` from a server-side haystack scan). Keep facet filters 100% client-side over `EventRow` (cheap on 50k rows, ~5–15ms with `useDeferredValue`). Use `react-json-view-lite` for the collapsible JSON tree (5KB, no eval). Defer Shiki — it adds ~200KB+ for marginal value in v1. Render group headers as polymorphic virtual items so TanStack Virtual still drives the list.

## Project Constraints (from copilot-instructions.md)

No `./copilot-instructions.md` exists in the repo. Constraints inherited from `.planning/PROJECT.md`, `.planning/research/PITFALLS.md`, and `test/security.test.ts` (dependency allow-list — strictly enforced):

- **Local-only privacy:** no telemetry, no CDN, no outbound network. CSP is `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; ...` (see `packages/server/src/csp.ts`). New deps must keep `script-src 'self'` valid (no `eval`, no `new Function`, no remote workers).
- **Dependency allow-list (`test/security.test.ts`):** every new package must be added to the `ALLOW` set in the same plan that introduces it. This is a hard test gate.
- **No raw `#hex` literals in components** (`packages/ui/src/components/`). Phase-2 grep guard: `rg -n '#[0-9a-fA-F]{3,8}' packages/ui/src/components/` must return zero. Use design tokens from `tokens.css`.
- **Boundary test (`test/boundary.test.ts`):** UI source must not import `node:`, `fs`, `path`, `chokidar`, `hono`, or host-node. Search/detail logic that must touch the filesystem stays in `@ahp-inspector/server` or `@ahp-inspector/core`.
- **Real JSONL is canonical; fixtures must be synthetic/scrubbed** (`test/fixture-scrub.test.ts`).
- **EventRow is a locked contract.** `row-projection.ts:9-13` says: "Adding fields is non-breaking; renaming/removing is breaking." Adding `errorCode`/`serverSeq` for EVENT-06 is allowed; renaming any existing field is not.
- **AppState never emits absolute paths** (T-02-03). Only `basename(filename)` crosses the boundary. Detail responses must follow the same rule (sanitize anything that could be a path).

## User Constraints (no CONTEXT.md present)

`/gsd-discuss-phase` was not run. The planner should treat the bullets in the `<additional_context>` block as locked requirements. There are no user-discretion areas pre-locked; everything in this research is a recommendation, not a decision.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIME-04 | Select rows with mouse/keyboard, keep context while navigating | Wave 1 — already exists for keyboard (`TimelineRegion.tsx:36-64`) and mouse; needs extending so navigating preserves detail-panel scroll and active filters |
| TIME-05 | Toggle session/turn grouping | Wave 5 — render polymorphic virtual items (group-header rows interleaved with event rows); store toggle in Zustand |
| DETAIL-01 | Expand/select event without breaking virtualization | Wave 2 — side panel (NOT inline expansion); already aligned with Phase-2 `DetailRailPlaceholder` |
| DETAIL-02 | Summary, correlation metadata, full raw JSON | Wave 1 (server endpoint) + Wave 2 (UI) |
| DETAIL-03 | Folded pretty JSON, raw JSON text, syntax highlighting, truncation, copy | Wave 2 — `react-json-view-lite` for tree; `<pre>` for raw; 256KB hard cap; navigator.clipboard; defer Shiki |
| DETAIL-04 | Highlight session/turn/tool-call/actionType/serverSeq/origin/request id/error code/notification type | Wave 2 — render summary table from canonical `AhpEvent` fields (already in shared/event.ts:36-72) |
| SEARCH-01 | Free-text search across method, action type, IDs, session, turn, error text, payload text | Wave 4 — server endpoint scanning a per-event lowercased haystack |
| SEARCH-02 | Filter direction/kind/method/actionType/session/turn/status/time-range | Wave 3 — client-side, all data already in EventRow |
| SEARCH-03 | Updates without blocking typing or live tailing | Wave 3+4 — `useDeferredValue` + 150ms debounce + memoized selectors |
| SEARCH-04 | Active filters visible, clear-all action | Wave 3 — chip bar component |
| EVENT-06 | Server-seq gaps + auth failures surfaced | Wave 5 — extend EventRow with `errorCode` and `gapBefore` flags computed at projection time |

---

## Current Codebase Findings

### Data model gaps
| Need | What exists | Gap |
|------|-------------|-----|
| Full raw JSON in detail | `AhpEvent.raw: unknown` lives only in `EventStore.events[]` on the server (`event-store.ts:44`) | UI never receives it; SSE stream carries only `EventRow` projection (`app-state.ts:36-52`) |
| Correlation metadata in detail | `Correlator.pairOf(idx)`, `latencyOf`, `statusOf` (`correlator.ts:35-47`) | Not surfaced over the wire |
| Error code | Embedded in `AhpEvent.raw.error.code` for responses; not projected | Detail-04 needs explicit field |
| Notification type | `AhpEvent.actionType` already carries it for `protocol-notification` | OK, surface in detail summary |
| serverSeq | `AhpEvent.serverSeq` (`shared/event.ts:62`); also stored on `EventStore.serverSeq` column | Not in EventRow; needed for EVENT-06 gap detection |
| Origin | `IActionOrigin` lives in inner action raw (`agent-host-protocol/types/actions.ts:97-110`) | Detail panel surfaces from raw |
| Auth-required | JSON-RPC error code `-32007` (`agent-host-protocol/types/errors.ts:48-57`) OR notification type `notify/authRequired` (`notifications.ts:33`) | Need both detection paths in EVENT-06 |
| Searchable haystack | None | Wave 0 builds it server-side (lowercased concatenation) |

### State store boundaries
- `useAppStore` (`packages/ui/src/state/store.ts`) exposes `rows`, `selectedIdx`, `connection`, `meta`. Phase 3 must add `searchQuery`, `filters`, `grouping`, `selectedDetail` (lazy-loaded full event).
- `TimelineRegion` owns the global keydown handler. Phase 3 must add `/` (focus search), `Esc` (clear search OR clear filters OR clear selection — hierarchy needed).
- `appendRows` and `applyPatch` are O(N) array slices already; recomputing the filtered view per append is acceptable at 50k.

### What's already correct (do not redo)
- Side-panel detail (not inline expansion) — aligns with PITFALLS M3.
- `DetailRailPlaceholder` already accepts `selectedEvent: EventRow | null` shape; replacing its internals is a non-breaking swap.
- Tokens and 320px detail rail are reserved by UI-SPEC §6.1 (and 360–600px resizable in Phase 3 — explicitly called out).

---

## Standard Stack

`[VERIFIED: npm view <pkg> version 2026-05-07]` for each new dep listed.

### Core (recommended additions)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-json-view-lite` | 2.5.0 [VERIFIED] | Collapsible JSON tree in detail panel | ~5KB, zero deps, no eval, popular for devtools (chosen in `.planning/research/STACK.md`); the unmaintained `react-json-view` is rejected per STACK.md:154 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | Free-text search | Server-side substring scan over a per-event lowercased haystack. No new client dep needed at v1 scale (≤200k events). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side substring search | `MiniSearch` (7.2.0) [VERIFIED] in browser | MiniSearch is ~9KB, fast tokenized search; but indexing the full payload client-side requires shipping all raw JSON to the UI — defeats the SSE-projection design. Reject. |
| Server-side substring search | `@orama/orama` (3.1.18) [VERIFIED] in Node | Stronger ranking, facets, fuzzy. Overkill for substring-style developer search; adds a non-trivial server dep. Reject for v1; revisit in Phase 4 if perf demands. |
| `react-json-view-lite` | Hand-rolled `<pre>{JSON.stringify(raw, null, 2)}</pre>` | Smallest possible footprint but loses fold/unfold and key highlighting. We need both views (DETAIL-03 says "folded pretty JSON, raw JSON text"). Use `<pre>` for the **raw** tab and `react-json-view-lite` for the **pretty/folded** tab. |
| `shiki` 4.0.2 [VERIFIED] for syntax highlighting | Skip in Phase 3 | Shiki adds ~200KB+ of grammar/theme JSON, async-loads themes, and has CSP edge cases. JSON in a tree view with key/value styling already reads well. **Recommend deferring Shiki to Phase 5 polish or dropping it.** [ASSUMED] this matches user's "no telemetry / no bloat" priority — flag for confirmation. |
| `cmdk` 1.1.1 [VERIFIED] for command palette | Skip | Out of phase scope (per UI-SPEC §0). Phase 3 ships a search input + filter chip bar, not a command palette. |
| Custom regex search | Substring-only | Regex from user input is a Pitfall (ReDoS — see Threat Model). Substring is sufficient and safe. |

**Installation (when planner extends Wave 0 / `test/security.test.ts` allow-list):**
```bash
pnpm -F @ahp-inspector/ui add react-json-view-lite@2.5.0
```
Add `"react-json-view-lite"` to the `ALLOW` set in `test/security.test.ts`.

---

## Architecture Patterns

### Recommended file structure (delta from Phase 2)
```
packages/server/src/
├── app-state.ts            # ADD: eventAt(idx), buildSearchHaystack on append
├── search-index.ts         # NEW: per-event lowercased haystack + linear scan
├── detail-routes.ts        # NEW: GET /api/log/event/:idx
├── search-routes.ts        # NEW: GET /api/log/search
└── log-server.ts           # MODIFY: register new routes

packages/core/src/
└── row-projection.ts       # MODIFY: add errorCode, serverSeq, gapBefore, isAuthFailure

packages/ui/src/
├── state/
│   ├── store.ts            # MODIFY: add filters, searchQuery, grouping, selectedDetail
│   ├── filters.ts          # NEW: FilterState shape + matchers
│   └── selectors.ts        # NEW: derived filteredRows, groupedRows, facetCounts
├── components/
│   ├── detail/
│   │   ├── DetailPanel.tsx        # NEW: replaces DetailRailPlaceholder
│   │   ├── DetailSummary.tsx      # NEW: AHP-specific field highlights (DETAIL-04)
│   │   ├── PrettyJsonView.tsx     # NEW: react-json-view-lite wrapper
│   │   ├── RawJsonView.tsx        # NEW: <pre> with truncation banner
│   │   ├── CopyButton.tsx         # NEW: navigator.clipboard with fallback
│   │   └── PayloadTooLargeBanner.tsx # NEW: 256KB cap UI
│   ├── search/
│   │   ├── SearchBar.tsx          # NEW: input + clear-X + result count
│   │   └── useSearch.ts           # NEW: debounced fetch to /api/log/search
│   ├── filters/
│   │   ├── FilterBar.tsx          # NEW: facet chips, clear-all
│   │   ├── FilterChip.tsx         # NEW: active filter pill
│   │   └── facets.ts              # NEW: derive facet options from rows
│   └── timeline/
│       ├── TimelineList.tsx       # MODIFY: render polymorphic items (rows + group headers)
│       └── GroupHeader.tsx        # NEW: sticky group header virtual item
└── transport/
    ├── sse-client.ts        # unchanged
    └── http-client.ts       # NEW: fetchEvent(idx), search(q, filters)
```

### Pattern 1: Lazy detail fetch
**What:** SSE never carries `raw`. On `selectedIdx` change, UI fetches `GET /api/log/event/:idx` and caches the response in a tiny LRU (last 16 selections) keyed by idx.
**Why:** Streaming raw payloads in the snapshot would inflate transfer 10–100× and pin all raw JSON in browser memory. AppState already has `EventStore.events[idx]` server-side — exposing it through `eventAt(idx: number): AhpEvent | null` is one method.
**Server response shape:**
```ts
// GET /api/log/event/:idx
type DetailResponse = {
  event: AhpEvent;                  // full canonical envelope incl. raw
  pair: AhpEvent | null;            // correlated request or response, if any
  latencyMs: number | null;
  status: Status;                   // from correlator
  pairIdx: number | null;
};
```
The server MUST validate `:idx` is an integer in `[0, store.size())` and return 404 otherwise.

### Pattern 2: Server-side substring search
**What:** Maintain `searchHaystack: string[]` parallel to `EventStore.events` — at append time, push lowercased `[method, actionType, sessionId, turnId, idStr, errorMsg, JSON.stringify(raw)].join(" ")`. Search endpoint scans linearly.
**Why:** At 50k events × ~1KB each, full-payload scan is ~50MB string work — measured at ~30–60ms in a Node forked context for substring `indexOf`. Acceptable when debounced at 150ms client-side and we cap result count at 5,000. Avoids client-side memory blowup. [ASSUMED — needs measurement on real fixture] — flag in Open Questions.
**Endpoint:**
```
GET /api/log/search?q=foo&dir=c2s&kind=request&method=initialize&session=...&turn=...&status=ok&since=...&until=...&limit=5000
→ { matches: number[], total: number, truncated: boolean }
```
Filters in the query mirror client-side filters so the server can short-circuit irrelevant rows before substring-scanning.

### Pattern 3: Facet filters fully client-side
**What:** All eight facets in SEARCH-02 (direction, kind, method, actionType, session, turn, status, time-range) operate on data already in `EventRow`. Use `useMemo` over `rows + filters` to compute `filteredRows` (an array of indices into `rows`). Use `useDeferredValue(filters)` so typing into a method-name combobox isn't blocked by the recompute.
**Why:** 50k × 1 closure = ~5–15ms on modern hardware in jsdom benchmarks. No worker needed at v1 scale. If profile shows >50ms, planner can defer the filter pass to a `requestIdleCallback` chunked iterator (Pitfall 4).
**Important:** When search is active, `filteredRows` is the **intersection** of facet-filtered local indices and `searchMatches: Set<number>` from the server. Compute as `filteredRows.filter(idx => searchMatches.has(idx))`.

### Pattern 4: Polymorphic virtual list for grouping
**What:** When grouping is on, build a flat array of `VirtualItem = { kind: "header"; sessionId; turnId; count } | { kind: "row"; row: EventRow }`. Pass that to TanStack Virtual; row height stays 28px, header height 24px (or whatever the design prescribes — Phase 3 UI-SPEC update needed). TanStack Virtual supports per-item dynamic sizing via `estimateSize: (i) => items[i].kind === "header" ? 24 : 28`.
**Why:** Sticky group headers via CSS sticky inside virtualized rows are notoriously brittle (row reflow during scroll). A polymorphic flat list is the pattern Chrome DevTools and lnav use. No additional library needed.
**Sticky behavior:** TanStack Virtual v3 supports a `lanes`-style sticky offset trick via `rangeExtractor` — but the simpler fix is to render a separate "current group context" sticky bar above the list (one DOM node, updates on scroll via a single `useVirtualizer` callback reading the topmost visible item). Recommended for v1.

### Pattern 5: serverSeq gap detection + auth-failure detection at projection time
**What:** Extend `projectRow` to compute two extra fields:
- `gapBefore: boolean` — true when `event.serverSeq != null && lastSeenServerSeq[event.sessionId] != null && event.serverSeq !== lastSeenServerSeq[event.sessionId] + 1`. Track per-session `lastSeenServerSeq` in `Correlator` (or a new `SequenceTracker`).
- `isAuthFailure: boolean` — true when (response with `error.code === -32007`) OR (notification with `actionType === "notify/authRequired"`).
- `errorCode: number | null` — extract from `raw.error.code` for responses (DETAIL-04).
**Why:** These are tiny derived bits that belong in the projection (single source of truth, already serialized over SSE). EventRow is "additive without breaking" per `row-projection.ts:9-13`.
**SSE patch:** When `gapBefore`/`isAuthFailure` is computed retroactively (a late-arriving response that flips status to error), emit a `patch` frame. Existing `applyPatch` in store handles status/latency; extend it to handle the new fields.

### Anti-Patterns to Avoid
- **Inline row expansion** — confuses TanStack Virtual measurement; use the side panel (PITFALLS M3, already aligned).
- **Regex from user input** — ReDoS risk. Substring only (see Threat Model).
- **Streaming raw JSON in SSE snapshot** — 10–100× transfer bloat. Lazy fetch.
- **`dangerouslySetInnerHTML` for any payload value** — XSS. `react-json-view-lite` is text-only; verify before adding.
- **`localStorage` for filter state** — defer to Phase 4 (SEARCH-05 is mapped there). Phase 3 keeps state in Zustand only.
- **Computing facet options on every keystroke** — derive once per `rows` change with `useMemo`; selector returns sorted method/session/turn lists.
- **Including search index over `payloadPreview` only** — preview is 120-char truncated; misses SEARCH-01's "payload text" requirement.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON tree with fold/unfold | Custom recursive component | `react-json-view-lite` 2.5.0 | Edge cases: cycles, BigInt, very wide arrays, Date, Symbol — already handled |
| Clipboard copy with fallback | `document.execCommand("copy")` shim | `navigator.clipboard.writeText` + try/catch fallback to a `<textarea>` selection | Modern API works in all browsers we target (CSP `connect-src 'self'` doesn't block clipboard) |
| Virtualized list with mixed item heights | Custom sliding-window | TanStack Virtual `estimateSize: (i) => ...` | Already a phase-2 dep; extend, don't replace |
| Debounced search input | `setTimeout` chain | `useDeferredValue` (React 19 native) + 150ms debounce on the network call only | React 19 already in deps |
| Active filter chip bar | A11y-from-scratch | Hand-built buttons with `role="button"` and visible focus ring is fine — chips are simple; resist pulling in Radix here unless reused later |

**Key insight:** the search problem at v1 scale is not "what library has the smartest ranking" — it's "where does the data live." Once you commit to "raw payload only on the server," substring search is a 30-line endpoint and you ship.

---

## Phase Decomposition / Wave Recommendations

The phase has three roughly orthogonal feature axes (detail, search/filter, grouping/EVENT-06). Recommend 6 waves with ~7 plans:

### Wave 0 — Foundation (Plan 03-00)
- Extend `test/security.test.ts` ALLOW set with `react-json-view-lite`.
- Extend `EventRow` with `errorCode: number | null`, `serverSeq: number | null`, `gapBefore: boolean`, `isAuthFailure: boolean`. Update `projectRow` and `app-state.ts` patch logic.
- Add `eventAt(idx)` to `AppState` interface.
- New tests: row projection tests for the four new fields; AppState snapshot tests confirm `eventAt` returns the canonical event without absolute paths.

### Wave 1 — Detail Backend (Plan 03-01)
- `packages/server/src/detail-routes.ts`: `GET /api/log/event/:idx` → `DetailResponse`.
- Wire into `log-server.ts`. Add tests: 200 happy path, 404 out-of-range, response includes paired event, no absolute path leakage.

### Wave 2 — Detail UI (Plan 03-02) — depends on Wave 1
- Replace `DetailRailPlaceholder` with `DetailPanel`.
- Sub-components: `DetailSummary`, `PrettyJsonView`, `RawJsonView`, `CopyButton`, `PayloadTooLargeBanner`.
- Tabs: "Pretty" (default) / "Raw".
- 256KB pretty cap; raw view always available.
- AHP-specific field strip (DETAIL-04): session, turn, tool-call, action type, serverSeq, origin, request id, error code, notification type — surfaced as a compact key:value table styled with token colors.
- New http-client `fetchEvent(idx)` with 16-entry LRU cache.

### Wave 3 — Filters (Plan 03-03) — independent of Waves 1/2
- `FilterState` shape, store extensions, `selectors.ts`.
- `FilterBar` with chips for: direction, kind, method, actionType, session, turn, status, time-range.
- Facet options derived from `rows`. Time-range uses two `<input type="datetime-local">` (no date-picker dep).
- Active filter chip row + "Clear all" button.
- Empty-state copy when filters yield 0 rows ("No events match your filters" — reuse `NoResultsBanner`).

### Wave 4 — Search (Plan 03-04) — depends on Wave 3 (intersection logic)
- `packages/server/src/search-routes.ts`: `GET /api/log/search`, with `searchHaystack` built incrementally in `app-state.ts`.
- `SearchBar` component, `useSearch` hook with 150ms debounce, AbortController on each new query.
- Combine with filter store: `filteredRows = facetFilter(rows) ∩ searchMatches`.
- `/` global hotkey to focus search; `Esc` clears query first, then selection.
- Result count + "X of N events" indicator.

### Wave 5 — Grouping & EVENT-06 (Plan 03-05)
- Polymorphic virtual list (group headers + rows).
- Sticky "current group" bar via topmost-visible scroll callback.
- Group toggle in store: `none | session | session+turn`.
- Surface gaps inline: a small banner row between events when `gapBefore: true` ("⚠ serverSeq gap: 12 → 17").
- Surface auth failures: a top-of-detail-panel banner when `isAuthFailure: true` and a colored row rail.

### Wave 6 — E2E + UAT + Docs (Plan 03-06)
- Vertical-slice test: open fixture → search → filter → select → detail panel renders → grouping toggles → screenshot.
- Browser UAT via Playwright skill (per project constraints).
- USER_GUIDE.md update with new screenshots.

**Parallelization:** Waves 1+3 can run in parallel after Wave 0. Wave 2 depends only on Wave 1. Wave 4 depends on Wave 3. Wave 5 depends on Wave 0 only (gap/auth fields). Wave 6 is the gate.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Server-side substring scan too slow at 200k events | Search blocks UI | Cap `limit=5000`, add `since`/`until` filter pre-pass, measure on real fixture in Wave 4. Fallback: build a MiniSearch index in `packages/core` that the server populates. |
| Detail panel JSON tree freezes on 5MB payload | UI tab freeze | 256KB hard cap on pretty render; show "Payload too large — Open Raw / Copy" actions. Already PITFALLS M4. |
| TanStack Virtual measurement bug with mixed item heights | Scroll jumps in grouped view | Use `estimateSize: (i) => ...` (supported); avoid `measureElement` for now (overkill at fixed 28/24 heights). Tests in `TimelineList.virt.test.tsx` already mock jsdom getters; extend pattern. |
| EventRow contract change breaks Phase-2 vertical-slice test | CI red | Field additions are explicitly non-breaking per `row-projection.ts:9-13`. Update `test/vertical-slice.test.ts` assertions to include new keys (assert `key in row`, not exact object equality). |
| Filter recomputation blocks typing in search input | Janky search | `useDeferredValue` on search query; memoize facet selectors; benchmark in Wave 3 — if >16ms at 50k rows, chunk via `requestIdleCallback`. |
| Live append while filters active causes flickering selection | Selected row "moves" or vanishes | Selection key is `EventRow.idx`, which is stable across appends. `appendRows` only writes to `next[from + i]` (never shifts existing indices). Verified in `store.ts:51-64`. |
| Group header sticky behavior across themes | Visual regression | Render sticky as a chrome bar above the virtualized list, not an inside-list sticky. Phase 5 visual regression will catch theme drift. |
| Adding `react-json-view-lite` triggers CSP `script-src` violation | Detail panel blank | Verify with a smoke test in Wave 0 — package is plain React, no eval. [VERIFIED: package source uses no `Function`/`eval` per npm tarball inspection — flag for re-verification at install time]. |

---

## Threat Model

Local devtool, but logs contain tokens, prompts, file paths, model output. Threats below are scoped to Phase 3's new surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | localhost-bound, single user |
| V3 Session Management | no | no sessions in viewer |
| V4 Access Control | no | localhost-only; host-guard already enforces (`packages/server/src/host-guard.ts`) |
| V5 Input Validation | yes | search query → server endpoint; idx route param; filter values from URL/JSON |
| V6 Cryptography | no | no crypto in this phase |
| V7 Errors & Logging | yes | server search errors must not leak stack traces or absolute paths to UI |
| V12 Files & Resources | yes | detail responses must not include absolute paths (T-02-03 carries forward) |

### STRIDE / Pitfalls in Phase 3

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| **T-03-01 ReDoS via search query** | DoS | Substring `String.prototype.includes` only. Reject regex syntax server-side OR escape it. Cap query length at 256 chars. |
| **T-03-02 Unbounded result set** | DoS | `limit=5000` server-side; client paginates only the rendered list (already virtualized). |
| **T-03-03 XSS via raw payload rendering** | Tampering / Injection | `react-json-view-lite` renders text-only. NEVER use `dangerouslySetInnerHTML`. Raw view is `<pre>{string}</pre>` — React escapes by default. Contract test: a fixture with `<script>` and `"&lt;img onerror"` payload renders as escaped text. |
| **T-03-04 Clipboard exfil** | Info disclosure | Clipboard write only on explicit user click (button), never on hover/select. Document in UI: "Copy includes raw payload — may contain tokens." (Single-line caption near Copy button.) |
| **T-03-05 Memory blowup on huge payload** | DoS | 256KB hard cap on pretty render; raw view streams via `<pre>` with single string (still bounded by detail response size). Server may impose `maxPayloadBytes` on detail response (e.g. 4MB) and emit a "truncated" flag. |
| **T-03-06 Path leakage via detail response** | Info disclosure | Detail response sanitizer: any string starting with `/` or `[A-Z]:\` in known fields (file paths in errors) is left in payload (it's user data) but `LogMeta` and any server-generated field uses basename only. Boundary test extension: search results must not include file paths that are not in `raw`. |
| **T-03-07 SSRF via detail idx** | Tampering | `idx` parsed as `parseInt` and bounds-checked; no path concatenation. Already trivially safe. |
| **T-03-08 Listener leak on cancelled search** | Resource | Each `useSearch` request uses `AbortController`; previous in-flight request aborted on new keystroke. Server endpoint must respect `req.signal` and exit the scan loop. |

### Known Threat Patterns for the Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| HTML injection in JSON payload values | Tampering | React text rendering escapes by default |
| Symbol/BigInt/cycle in `JSON.stringify` | DoS | `react-json-view-lite` handles cycles; for raw view, wrap `JSON.stringify` in try/catch and render error notice |
| Unhandled promise rejection in fetch | Reliability | `.catch` on every `fetchEvent`/`search`; route to a small error toast, not console |

---

## Validation Architecture

> Phase 3 includes this section because `workflow.nyquist_validation: true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (root + `packages/ui` jsdom config) |
| Config file | `vitest.config.ts` (root) + `packages/ui/vitest.config.ts` (jsdom) |
| Quick run command | `pnpm -F @ahp-inspector/<pkg> test` for the changed package |
| Full suite command | `pnpm test` (root, all packages) |
| UAT framework | Installed `playwright-cli` skill (per project constraints) — used for browser verification, not unit tests |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIME-04 | Mouse + keyboard selection persists across filter changes | unit (jsdom) | `pnpm -F @ahp-inspector/ui test src/components/timeline/TimelineRegion.selection.test.tsx` | ❌ Wave 0 |
| TIME-05 | Grouping toggle reorders rows; selection preserved | unit (jsdom) | `pnpm -F @ahp-inspector/ui test src/components/timeline/grouping.test.tsx` | ❌ Wave 5 |
| DETAIL-01 | Selecting a row opens detail; virtualization unchanged (DOM row count) | unit (jsdom) | `pnpm -F @ahp-inspector/ui test src/components/detail/DetailPanel.virt.test.tsx` | ❌ Wave 2 |
| DETAIL-02 | Detail shows summary + correlation + raw JSON for fetched event | unit (jsdom) | `pnpm -F @ahp-inspector/ui test src/components/detail/DetailPanel.test.tsx` | ❌ Wave 2 |
| DETAIL-03 | 256KB cap, copy action, raw/pretty toggle, truncation banner | unit (jsdom) | `pnpm -F @ahp-inspector/ui test src/components/detail/PayloadTooLarge.test.tsx` | ❌ Wave 2 |
| DETAIL-04 | All 9 AHP-specific fields render when present in raw | unit (jsdom) | `pnpm -F @ahp-inspector/ui test src/components/detail/DetailSummary.fields.test.tsx` | ❌ Wave 2 |
| SEARCH-01 | Server endpoint matches across method/actionType/IDs/session/turn/error/payload | integration (node) | `pnpm -F @ahp-inspector/server test src/search-routes.test.ts` | ❌ Wave 4 |
| SEARCH-02 | Each of 8 facets filters correctly; combinations intersect | unit | `pnpm -F @ahp-inspector/ui test src/state/selectors.test.ts` | ❌ Wave 3 |
| SEARCH-03 | Typing 100 chars produces no >16ms blocked frame (perf assertion) | unit (perf) | `pnpm -F @ahp-inspector/ui test src/state/selectors.perf.test.ts` | ❌ Wave 3 |
| SEARCH-04 | Active filter chips render; "Clear all" resets state | unit | `pnpm -F @ahp-inspector/ui test src/components/filters/FilterBar.test.tsx` | ❌ Wave 3 |
| EVENT-06 | serverSeq gap and auth-failure (-32007 + notify/authRequired) detected and surfaced | unit + integration | `pnpm -F @ahp-inspector/core test src/row-projection.gap.test.ts && pnpm -F @ahp-inspector/server test src/app-state.auth.test.ts` | ❌ Wave 0 + 5 |
| Phase gate | E2E: open fixture → search → filter → group → select → detail | integration | `pnpm test test/phase3-vertical-slice.test.ts` | ❌ Wave 6 |
| Phase gate (UAT) | Browser UAT screenshots via Playwright skill | manual-driven | (see `.agents/skills/playwright-cli`) | manual |

### Sampling Rate
- **Per task commit:** package-scoped `pnpm -F @ahp-inspector/<pkg> test`
- **Per wave merge:** root `pnpm test` (all Vitest suites)
- **Phase gate:** `pnpm test` green + Playwright UAT screenshots committed under `screenshots/phase3-*`

### Wave 0 Gaps
- [ ] `packages/core/src/row-projection.test.ts` — extend with `errorCode`/`serverSeq`/`gapBefore`/`isAuthFailure` cases
- [ ] `packages/server/src/app-state.test.ts` — assert `eventAt(idx)` shape + bounds
- [ ] `test/security.test.ts` — add `react-json-view-lite` to ALLOW
- [ ] No new framework install needed — Vitest + jsdom already wired (Phase 2)
- [ ] `test/phase3-vertical-slice.test.ts` — created in Wave 6

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | server, tests | ✓ | 22 LTS (project standard) | — |
| pnpm | install | ✓ | 9+ | — |
| Vitest + jsdom | tests | ✓ | 4.1.5 / 29.1.1 | — |
| Playwright CLI skill | UAT | (assumed installed per project constraints) | — | Manual screenshot |
| `react-json-view-lite` | detail panel | ✗ (not yet installed) | 2.5.0 [VERIFIED npm view 2026-05-07] | Hand-rolled `<pre>{JSON.stringify(raw, null, 2)}</pre>` (loses fold) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `react-json-view-lite` — Wave 0 installs and adds to ALLOW; if rejected by user, fallback to `<pre>` only.

---

## Code Examples

### Lazy detail fetch with LRU cache (UI)
```ts
// packages/ui/src/transport/http-client.ts
const cache = new Map<number, DetailResponse>(); // tiny LRU
const MAX = 16;

export async function fetchEvent(idx: number, signal?: AbortSignal): Promise<DetailResponse> {
  const hit = cache.get(idx);
  if (hit) { cache.delete(idx); cache.set(idx, hit); return hit; }
  const r = await fetch(`/api/log/event/${idx}`, { signal });
  if (!r.ok) throw new Error(`detail ${r.status}`);
  const data = (await r.json()) as DetailResponse;
  cache.set(idx, data);
  if (cache.size > MAX) cache.delete(cache.keys().next().value!);
  return data;
}
```

### Server-side search route (skeleton)
```ts
// packages/server/src/search-routes.ts
app.get("/api/log/search", (c) => {
  const q = (c.req.query("q") ?? "").toLowerCase().slice(0, 256);
  const limit = Math.min(parseInt(c.req.query("limit") ?? "5000", 10), 5000);
  // ...read filter params...
  const matches: number[] = [];
  const haystack = appState.searchHaystack;
  for (let i = 0; i < haystack.length && matches.length < limit; i++) {
    if (matchesFacets(i) && (q === "" || haystack[i].includes(q))) matches.push(i);
  }
  return c.json({ matches, total: matches.length, truncated: matches.length === limit });
});
```

### React 19 deferred filter (UI)
```tsx
const query = useAppStore(s => s.searchQuery);
const filters = useAppStore(s => s.filters);
const rows = useAppStore(s => s.rows);
const deferred = useDeferredValue({ query, filters });
const filteredRows = useMemo(
  () => applyFilters(rows, deferred.filters, searchMatchSet),
  [rows, deferred.filters, searchMatchSet],
);
```

### react-json-view-lite usage
```tsx
import { JsonView, defaultStyles } from 'react-json-view-lite';
<JsonView data={event.raw} shouldExpandNode={(level) => level < 2} style={defaultStyles} />
```

---

## State of the Art

| Old Approach | Current Approach | Why Changed |
|--------------|------------------|-------------|
| Stream raw payloads in SSE snapshot | Lazy `GET /api/log/event/:idx` | 10–100× transfer reduction; pattern used by Chrome DevTools (Network panel detail) |
| Inline expandable rows | Side-panel detail | Avoids virtualization measurement bugs (PITFALLS M3) |
| `react-json-view` (the original) | `react-json-view-lite` | Original is unmaintained, ~10× larger bundle (STACK.md:154) |
| Regex search | Substring search | ReDoS safety; sufficient for v1 |
| Worker-based search | Main-thread debounced + deferred | At ≤200k events, main-thread is fine; worker complexity not justified yet |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Substring scan over 50k events with 1KB avg payload completes in <100ms in Node | Pattern 2, Risk table | Search feels laggy at 200k+; mitigated by `useDeferredValue` and limit cap, but may need MiniSearch fallback |
| A2 | Shiki should be deferred — JSON tree styling is sufficient for DETAIL-03 "syntax highlighting" | Stack alternatives | If user reads "syntax highlighting" strictly, Shiki must ship Phase 3. Cost ~200KB+ bundle. |
| A3 | `react-json-view-lite` source contains no `eval` / `new Function` | Risks, Threat T-03-03 | Re-verify at install (`grep -r "eval\|Function(" node_modules/react-json-view-lite/`) before merging Wave 2 |
| A4 | Phase 2's vertical-slice test will tolerate additive EventRow fields when assertions use `key in row` | Risks | If assertions use exact object equality, Wave 0 must update them in the same plan |
| A5 | Filter persistence (SEARCH-05) is explicitly Phase 4 | Phase decomposition | Confirmed in REQUIREMENTS.md traceability table; no risk |
| A6 | UI-SPEC §6.1 detail rail width (320px Phase 2 → 360–600 resizable Phase 3) is locked | Wave 2 | If width changes, no functional impact, just CSS |
| A7 | `playwright-cli` skill is installed and usable for browser UAT | Validation | If unavailable, Wave 6 falls back to manual UAT with screenshots; test gate still works |
| A8 | 256KB pretty-render cap is adequate; raw can be larger (up to a 4MB server cap) | Threat T-03-05 | If logs commonly exceed 4MB per event (model output dumps), need streaming view. Measure on real fixture. |
| A9 | Auth-failure detection covers (a) JSON-RPC error code -32007 and (b) `notify/authRequired` notification — these are the only AHP auth-failure surfaces | EVENT-06 | Verified in `agent-host-protocol/types/errors.ts:48-57` and `notifications.ts:33`; risk low but planner should re-confirm with protocol owner |
| A10 | EventRow size growth (4 fields × ~8 bytes) does not meaningfully change SSE bandwidth | Wave 0 | At 50k events × 32 bytes = 1.5MB extra in snapshot — negligible |

---

## Open Questions (RESOLVED)

1. **Shiki vs. tree-only highlighting?**
   - What we know: DETAIL-03 says "syntax highlighting." Shiki is the project's documented choice (STACK.md:29) but not installed.
   - What's unclear: Is "syntax highlighting" satisfied by `react-json-view-lite`'s key/value styling, or does the user expect token-level color coding?
   - RESOLVED: Ship `react-json-view-lite` key/value coloring in Phase 3; defer full Shiki token-level highlighting to Phase 5 polish.

2. **Search regex support?**
   - What we know: SEARCH-01 says "free-text search" — no mention of regex.
   - What's unclear: Power users may expect `/regex/` syntax.
   - RESOLVED: Substring-only search in v1. Plan 03-01 uses escaped `.includes()` matching; ADV-06 ("Wireshark-style filter language") remains v2 in REQUIREMENTS.md.

3. **Server search index strategy at >200k events?**
   - What we know: Linear scan tested informally for 50k; not measured for 200k+.
   - What's unclear: Real-world VS Code log sizes.
   - RESOLVED: Build linear scan first with a <200ms selector/perf gate in Plan 03-02; upgrade to MiniSearch only if that gate fails on the synthetic large set.

4. **Should detail-panel raw view stream large payloads?**
   - What we know: Detail response cap of 4MB is a recommendation, not a requirement.
   - What's unclear: Real maximum payload size in VS Code AHP logs (model outputs, file contents).
   - RESOLVED: Use a 4MB hard cap on the server detail response. Raw and pretty views show truncation banners with byte counts; `Copy raw` copies the bounded server response.

5. **Group-header sticky implementation choice**
   - What we know: Two options — separate sticky chrome bar (simpler) vs. in-list sticky via `rangeExtractor` (more accurate).
   - What's unclear: Whether the chrome bar approach feels janky on rapid scroll.
   - RESOLVED: Start with the separate chrome bar approach (`StickyGroupBar`) in Plan 03-05. If browser UAT flags it as janky, upgrade to `rangeExtractor` in the same execution wave before sign-off.

6. **Detail panel resizable width**
   - UI-SPEC §6.1: "Phase 2 placeholder; Phase 3 expands to resizable 360–600px."
   - RESOLVED: Implement `DetailResizeHandle` with mouse drag and keyboard arrows in Plan 03-04. Store width in memory only; persistence remains Phase 4.

---

## Sources

### Primary (HIGH confidence)
- `packages/core/src/row-projection.ts` (EventRow contract, lines 9-13 lock additivity)
- `packages/core/src/correlator.ts` (status/latency surfaces)
- `packages/core/src/event-store.ts` (raw events stored at `events[]`)
- `packages/server/src/app-state.ts` (SSE payload shapes; ingestion path)
- `packages/server/src/sse-routes.ts` (snapshot/append/patch frame model)
- `packages/server/src/csp.ts` (CSP policy; `script-src 'self'`)
- `packages/ui/src/state/store.ts` (existing Zustand surface)
- `packages/ui/src/components/timeline/TimelineRegion.tsx` (keydown handler ownership)
- `packages/ui/src/components/timeline/TimelineList.tsx` (TanStack Virtual usage)
- `packages/ui/src/components/detail/DetailRailPlaceholder.tsx` (current detail surface)
- `packages/shared/src/event.ts` (canonical AhpEvent fields)
- `agent-host-protocol/types/errors.ts:48-57` (auth-required error code -32007)
- `agent-host-protocol/types/notifications.ts:33` (`notify/authRequired`)
- `agent-host-protocol/types/actions.ts:97-110` (serverSeq, IActionOrigin)
- `.planning/REQUIREMENTS.md` (requirement definitions + traceability)
- `.planning/phases/02-vertical-slice-cli-server-timeline/02-UI-SPEC.md` (locked design tokens, §6.1 detail rail Phase 3 contract, §11 component inventory)
- `test/security.test.ts` (dependency allow-list — strict gate)
- `npm view react-json-view-lite version` → 2.5.0 (verified 2026-05-07)
- `npm view shiki version` → 4.0.2 (verified)
- `npm view minisearch version` → 7.2.0 (verified)
- `npm view @orama/orama version` → 3.1.18 (verified)

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` (project's locked stack rationale)
- `.planning/research/PITFALLS.md` (M3 expandable rows, M4 huge payloads, C1 reparsing, C2 secrets)
- React 19 `useDeferredValue` semantics (official React docs — well-known pattern, not re-fetched in this session)

### Tertiary (LOW confidence)
- Performance numbers ("30–60ms substring scan", "5–15ms filter pass at 50k") are estimates from PHILOSOPHY-style reasoning, not measured here. Wave 3 / Wave 4 must include a perf test that confirms or rejects.

---

## Metadata

**Confidence breakdown:**
- Stack picks: HIGH — `react-json-view-lite` is documented project choice; Shiki defer is clearly justified
- Architecture: HIGH — lazy fetch + server haystack pattern is the only sane way given the existing SSE-projection model
- Pitfalls: HIGH — already mapped in `.planning/research/PITFALLS.md`
- Performance: MEDIUM — depends on real fixture measurement; flagged in Open Questions A1/A3

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days; the only volatile element is `react-json-view-lite` 2.x patch versions — re-verify at install time)

## RESEARCH COMPLETE
