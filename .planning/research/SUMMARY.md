# Project Research Summary

**Project:** AHP Log Viewer
**Domain:** Local-first developer tool — JSON-RPC / AHP protocol log viewer (DevTools-Network-style)
**Researched:** 2026-05-06
**Confidence:** HIGH (well-trodden category; primary unknowns are the exact real-JSONL shape VS Code will emit and theme/UX scope)

---

## Executive Summary

AHP Log Viewer is a "DevTools Network panel for AHP" — a local, single-document viewer for JSONL logs of JSON-RPC 2.0 traffic between VS Code and an agent host. The category is mature (Chrome DevTools, Wireshark, Charles, LSP Inspector, MCP Inspector, lnav), so table-stakes UX is well known: a dense, virtualized timeline; request↔response correlation; expandable detail with raw + pretty JSON; faceted filters + free-text search; live tail. The differentiator opportunity is *polish and density done right* (three real themes, session/turn grouping, action-type coloring, latency heat, smooth incremental rendering) on top of an architecture that won't choke on growing logs.

Recommended approach: a **TypeScript pnpm monorepo** with a strict layered architecture — `shared` (types + JSONL parser + canonical `AhpEvent` envelope) → `host-node` (chokidar + tail) → `server` (Hono + SSE) → `cli` (commander) → `ui` (Vite + React 19 + TanStack Virtual + Zustand + Tailwind v4 + Shiki + Orama). The single critical seam is a `HostAdapter` / `HostClient` interface so the same UI can later run unchanged inside a VS Code webview by swapping HTTP/SSE for `postMessage`. Core (parser, store, correlator, search index) is pure TS — no DOM, no Node — making it portable, testable, and worker-ready.

The dominant risks are architectural-debt risks that must be designed in from Phase 1: (1) **incremental, append-only ingest** (never reparse the whole file); (2) a **columnar event store with correlate-on-append** so filtering and rendering stay O(window); (3) **virtualization from day one** with dynamic row heights; (4) a **strict local-only network posture** (CSP `connect-src 'self'`, no telemetry, no CDN fonts) because logs contain tokens, prompts, and model output; and (5) **bidirectional JSON-RPC id correlation** keyed by `(session, direction, id, idType)` — naive `id`-only matching will silently mis-pair events. Build the host abstraction in P1; retrofitting it later is the single most expensive mistake available.

---

## Key Findings

### Recommended Stack

A small, opinionated, web-standards-leaning stack chosen for (a) running unchanged in a future VS Code webview and (b) staying responsive on 100K+ event logs. See `STACK.md` for full rationale and rejection list.

**Core technologies:**
- **TypeScript 5.x (strict) + Node 22 LTS + pnpm workspaces** — shared types between CLI/server/UI; mature monorepo story.
- **Hono 4 + SSE (server) + commander 12 (CLI)** — tiny web-standard server; one-way push fits log tailing exactly; no WebSocket lifecycle.
- **chokidar 4 + offset-tracked `fs.createReadStream`** — cross-platform reliable file watching; avoids `fs.watch` quirks and atomic-replace breakage.
- **React 19 + Vite 5 + `@tanstack/react-virtual` 3** — best ecosystem for the specific widgets we need (dynamic-height virtualization, cmdk, Radix); runs unchanged in webviews.
- **Zustand 5** — single-document app, no Redux ceremony.
- **Tailwind v4 + CSS variables** — three themes via `[data-theme]` overrides; zero runtime cost; trivially maps to `--vscode-*` tokens later.
- **Orama 2** — TS-first in-memory full-text + facets in one index; rebuilds incrementally; no native deps.
- **Shiki 1** for raw-JSON highlighting (VS Code TextMate parity); **`react-json-view-lite`** for folded trees; **cmdk** for palette; **lucide-react** + **date-fns** for icons/dates.
- **Biome** (lint/format), **Vitest + Testing Library** (unit), **Playwright** (e2e), **tsup** (CLI bundler).
- **AHP types imported directly from `../agent-host-protocol`** — single source of truth; no schema regen.

Explicitly rejected: Electron, Tauri, Next.js, Redux, Express, Socket.IO, MUI/AG-Grid, stream-json, Moment, Storybook, Zod-for-v1.

### Expected Features

See `FEATURES.md` for the full landscape. Positioning: *"DevTools Network panel for AHP."*

**Must have (table stakes — v1 is not credible without these):**
- Auto-discover VS Code AHP log files + manual file open (CLI arg + in-app picker).
- Tolerant JSONL parser (skip + flag malformed lines; never crash); incremental tail with offset tracking.
- Bounded-memory indexed store; virtualized dense timeline (timestamp, direction glyph, kind, method/action type, session/turn, latency, payload preview).
- Direction + kind visual encoding mapping to existing `>>`/`<<`/`!!`/`**` markers.
- Request↔response correlation by JSON-RPC `id`; visible flag for unmatched/orphan events.
- Click-to-expand detail pane: pretty JSON, raw JSON toggle, copy actions, folded tree with truncation.
- Quick text search across method/IDs/payload + faceted filters (direction, kind, method, action type, session, turn, status); time-range filter.
- Light, dark, hacker themes — fully designed, not hue-rotated; keyboard nav (`/`, `j/k`, `Enter`, `Esc`); persisted last-opened/theme/filters.
- Designed empty/loading/parse-error states; responsive 1024px → ultra-wide.

**Should have (cheap differentiators worth shipping in v1 if possible):**
- **Session/turn grouping toggle** (D1) — turns the log into a story; AHP's primary structuring concept.
- **Action-type taxonomy with semantic colors** (D2) + **auth-failure highlighting** (D5) + **`serverSeq` gap detection** (D4).
- **Hacker theme that earns the name** (D6) — phosphor/scanline/cursor accents, not a green color swap.
- **Latency heat strip** (D3), **mini-timeline overview ruler** (D10), **sticky session/turn header** (D8).
- **Copy-as-JSON-RPC-request** (D9), **smooth incremental row rendering** during live tail (D7).
- **Schema-aware payload rendering** (D11) — labels via `agent-host-protocol` schemas; v1.1 if schemas aren't ready.

**Defer (v2+):** multi-file/tab, saved searches, JSONL export, bookmarks/annotations, diff, aggregate metrics dashboard, Wireshark-style filter DSL, Gantt waterfall, plugin API, remote streaming, error notifications, regex/boolean search, full schema *validation*, VS Code extension packaging.

**Anti-features (refuse):** editing/replaying traffic, auto-redaction without user control, *any* outbound network call (telemetry, CDN fonts, "explain with LLM"), heavy IDE chrome before timeline is excellent, full-document re-parse on append, loading whole payloads into row data, custom DSL in v1, tight coupling to the human-readable sample format, modal dialogs for routine actions.

### Architecture Approach

A six-layer, downward-only-dependency design with a single `HostAdapter` seam at the I/O boundary. The Core (Store/Correlator/Index) is pure TS — no DOM, no Node — so it ports unchanged into a webview and into a Web Worker when needed. See `ARCHITECTURE.md` for the layered model, the canonical `AhpEvent` JSONL envelope, and the build-order matrix.

**Major components:**
1. **HostAdapter (interface)** — `discoverLogs / openLog / watchLog / readChunk / close`. CliHost (Node + chokidar) today; VsCodeHost (workspace API + FileSystemWatcher + postMessage) later. UI never imports either.
2. **Transport** — bytes → newline-delimited lines with partial-line buffering across chunks; backpressure; reconnection. Same `HostMessage` discriminated union over WebSocket/SSE today and `postMessage` tomorrow — not two protocols.
3. **Parser + Normalizer** — per-line `JSON.parse` with try/catch; emits `ParseError` events inline. Normalizer discriminates JSON-RPC kind, attaches `eventId`/`sessionId`/`turnId` from the canonical envelope. Includes a throwaway `legacy.ts` adapter for the current human-readable sample.
4. **EventStore (columnar, append-only)** — parallel typed arrays (`ts`, `kind`, `dir`, `method`, `reqId`, `session`, `turn`, plus `raw[]`); side indices by id/method/session/turn. Cache-friendly, GC-light, worker-transferable.
5. **Correlator + SearchIndex** — pair responses on append by `(session, direction, id, idType)`; write `pairIdx`/`latency`/`status` to the row. Orama index built incrementally over a canonical `EventView` projection used by both search and filters.
6. **FilterModel + ViewModel + UI** — filters compile to predicates applied via index intersection (O(matches), not O(events)); ViewModel slices for the visible window. UI = TimelineList (virtualized, dynamic-height), EventRow, DetailPane, FilterBar, SessionPicker, ThemeProvider; theme is one DOM attribute change driving CSS variables.

**Canonical wire envelope (target VS Code emits this):** `{ ts, tsMono?, dir, kind, sessionId, turnId, channel, seq, raw }` with kind-specific `raw` payloads mirroring JSON-RPC 2.0 + AHP action envelopes (`serverSeq`, `origin`, `action`).

### Critical Pitfalls

Top pitfalls that must be designed-in, not retrofitted. See `PITFALLS.md` for the full catalog and phase-mapped warning matrix.

1. **Reparsing the whole log on every change (C1)** — design append-only streaming ingest with byte-offset tail, in-memory event store keyed by monotonic seq, derived indices at ingest. Never re-scan from the raw string.
2. **Leaking secrets — tokens, prompts, model output (C2)** — strict `connect-src 'self'` CSP, zero outbound calls (no telemetry, no CDN fonts, no update pings), self-hosted assets, fixture scrubbing pre-commit, console-log lint rule. Lock this in P1 — a single CDN font dependency makes it un-retrofittable.
3. **Brittle JSONL parser (C3)** — per-line try/catch emitting `ParseError` events; tail buffer for partial trailing lines across chunks; explicit BOM/CRLF/empty handling; fuzz tests (truncation, embedded `\n`, invalid UTF-8, 10MB payloads).
4. **Wrong request/response correlation (C4)** — bidirectional JSON-RPC has *two* id spaces. Key on `(session, direction, id, idType)`; treat notifications as never-correlatable; surface unmatched/orphan events as first-class UI states; preserve id type (`1` ≠ `"1"`).
5. **Full timeline re-render on every appended event (C5)** — virtualize from day one (TanStack Virtual with `measureElement` for dynamic heights); coalesce appends per `requestAnimationFrame`; rows subscribe to store slices, not the whole list; explicit `following` vs `paused` tail states with a "jump to live" pill.
6. **Search/filter that's wrong (C6)** — define one canonical `EventView` projection in the core; both search and faceted filters operate on it; AND-by-default chips; case-insensitive method match; UTC-normalized timestamps; first-class derived facets (`isError`, `isUnmatched`, `isSlow`).
7. **VS Code webview compatibility broken late (M9)** — define `HostAdapter` / `HostClient` in P1; UI never imports `fetch`/`fs`/`localStorage` or hardcodes URLs. Add a lint rule once the abstraction exists.

---

## Implications for Roadmap

The architecture and pitfalls converge on one ordering: **lock the contracts (envelope + HostAdapter + EventStore) before any UI; prove an end-to-end vertical slice on a static file; layer on growth, polish, and themes; defer the VS Code host to last.**

### Phase 1: Core Foundations — Types, Parser, Store, Host Abstraction
**Rationale:** The `AhpEvent` envelope, `HostAdapter` interface, and EventStore contract underpin every other phase. They're the cheapest things to get right with fixture/unit tests and the most expensive to change later. Critical pitfalls C1, C2, C3, C4 are all *prevented here or not at all*.
**Delivers:** pnpm monorepo skeleton; `shared` (AHP type re-exports, canonical envelope, JSONL line splitter + tolerant parser, `ParseError` events, `HumanLogAdapter` legacy shim); `core` (columnar EventStore, Correlator with `(session, direction, id, idType)` key, SearchIndex stub, `EventView` projection); `host-node` (discoverLogs, openLog, watchLog with chokidar + offset tail); `HostAdapter` interface; CSP/no-network posture documented and lint-enforced; Vitest fixture suite (well-formed, malformed, partial line, overlapping bidirectional ids, BOM/CRLF, large payloads); generated AHP method/action enum.
**Addresses:** T4, T5 foundations; M1 (adapter split), M6 (chokidar), M10 (fixtures), m6 (no-console), m8 (generated enums).
**Avoids:** C1, C2, C3, C4, M9.

### Phase 2: First Vertical Slice — CLI + Server + Minimal Virtualized Timeline
**Rationale:** First end-to-end slice proves the `HostAdapter` and Transport contracts under real I/O before adding features. Validates that the UI can render a static file via `HttpHostClient` over SSE — and incidentally proves the abstraction is webview-compatible.
**Delivers:** `cli` (commander; binds `127.0.0.1`; opens browser); `server` (Hono + SSE; serves built UI; `/api/logs` discover, `/api/log` snapshot, `/api/log/stream` tail); `ui` (Vite + React 19 shell; `HostClient` interface with `HttpHostClient`; Zustand store; TanStack Virtual TimelineList with fixed-height dense rows showing T7 fields; T8 visual encoding with direction + kind glyphs; T9 correlation rendered from precomputed `pairIdx`/`latency`/`status`).
**Uses:** Hono, SSE, commander, Vite, React, TanStack Virtual, Zustand, Tailwind v4 (default theme only).
**Implements:** Transport, ViewModel, TimelineList, EventRow.
**Avoids:** C5 (virtualization from day one), M3 (decide inline-vs-pane now — recommend detail pane, not inline).

### Phase 3: Detail Pane, Filters, Search
**Rationale:** Pure additions on top of a working pipeline. Pitfall C6 (filter correctness) is prevented by reusing the `EventView` projection from P1. Detail pane sidesteps the dynamic-height-virtualization scaling concern (M3).
**Delivers:** DetailPane (formatted + raw JSON tabs, Shiki highlighting capped at 64KB with "show full"; copy-raw vs copy-displayed); folded JSON tree via `react-json-view-lite`; FilterBar with faceted chips (direction, kind, method, action type, session, turn, status), AND-by-default; Orama-backed text search debounced 50–100ms; time-range filter; jump-to-next-error keyboard shortcut; designed empty/loading/parse-error states; design tokens (CSS custom properties) for every color/surface/semantic state.
**Addresses:** T10, T11, T13, T14, T15, T16, T19; m1 (copy semantics), m3 (empty-state onboarding).
**Avoids:** C6, M4 (bounded pretty-print), M5 (UTC-normalized timestamps, no fake-precision latencies), M8 (tokens defined before themes).

### Phase 4: Live Tail, Auto-Discovery, Persistence
**Rationale:** Layer growth on top of proven static rendering — debugging tailing on an unproven UI is debugging two unknowns. Discovery and persistence are small but high-value polish.
**Delivers:** Auto-discovery of well-known VS Code AHP log paths per OS (no recursive home scan; content-sniff to confirm); discovery list with mtime/size; tail mode with chokidar atomic-replace + truncation handling ("log rotated" marker); explicit `following` vs `paused` UI states with "jump to live" pill + new-event count; smooth incremental rendering (D7) coalesced per rAF; persisted last-opened file, theme, filter state via `Host.readSettings/writeSettings` (not direct `localStorage`).
**Addresses:** T1, T2, T3, T17.
**Avoids:** M2, M6, M7, m5.

### Phase 5: Themes & Differentiator Polish
**Rationale:** Themes and differentiators are isolated to the UI layer and benefit from a stable feature surface. Hacker theme is an explicit project requirement and a stated identity differentiator — must earn its name, not be a hue swap.
**Delivers:** Three fully designed themes (light, dark, hacker — phosphor/scanline/cursor accents) driven entirely by the P3 design tokens; visual-regression Playwright snapshots per theme; D1 session/turn grouping toggle with D8 sticky header; D2 action-type semantic colors; D3 latency heat strip; D4 `serverSeq` gap markers; D5 auth-failure highlighting; D9 copy-as-JSON-RPC-request; D10 mini-timeline overview ruler. Color always paired with shape/icon/text (m4). Hidden source maps (m7). Self-hosted fonts (no CDN).
**Addresses:** T18, T20, D1–D5, D6, D8, D9, D10.
**Avoids:** M8, m4, m7.

### Phase 6: VS Code Webview Host (later, not v1)
**Rationale:** The whole architecture has been engineered to make this a packaging exercise rather than a rewrite. If the `HostAdapter` boundary held, this is mostly `postMessage` glue and theme-token mapping to `--vscode-*` variables.
**Delivers:** `host-vscode` package (`vscode.workspace.fs`, `FileSystemWatcher`, `webview.postMessage`); `VsCodeHostClient` swap-in; `HostMessage` reused unchanged; theme token bridge to VS Code editor theme; webview state persistence; extension packaging.
**Avoids:** M9 (already prevented by P1 abstraction).

### Phase Ordering Rationale

- **Contract-first (P1) before any UI** — research's strongest signal: the envelope, HostAdapter, EventStore, and correlation key are the things that are expensive to change and cheap to fix early. Pitfalls C1/C3/C4 cannot be retrofitted.
- **Static slice (P2) before tailing (P4)** — debugging virtualization + ingest + correlation simultaneously is debugging too many unknowns. Prove rendering on a known file first.
- **Filters/search (P3) before live tail (P4)** — the UX for "I opened a 200MB log" depends on filter responsiveness; debug that before adding event-stream timing pressure.
- **Themes (P5) after feature-complete UI** — themes that ride on design tokens defined in P3 are a swap; themes built before token discipline silently rot.
- **VS Code host (P6) last** — proves the boundary held; isn't blocked by anything earlier.
- **Cross-phase security (C2) is a posture, not a phase** — locked in P1, audited every milestone.

### Research Flags

Phases likely needing deeper research during planning (`/gsd-research-phase`):

- **Phase 1:** Real JSONL shape — confirm against `../agent-host-protocol/types/messages.ts` and any current VS Code emit code; decide whether `sessionId`/`turnId` get lifted to the envelope or extracted from `raw.params` by the Normalizer. AHP action-envelope semantics (`serverSeq`, `origin`).
- **Phase 5:** Hacker-theme aesthetic scope — design call (CRT/scanline/cursor accents); needs a concrete reference set before scoping D6 properly.
- **Phase 6:** VS Code webview specifics — `getState`/`setState` persistence, CSP within webviews, theme-token bridging to `--vscode-*`. Defer; only relevant when P6 is approached.

Phases with standard, well-documented patterns (skip dedicated research):

- **Phase 2:** Vite + React + Hono + SSE + TanStack Virtual is fully established; no research needed beyond reading official docs at implementation time.
- **Phase 3:** Orama, `react-json-view-lite`, Shiki, cmdk all have first-class docs; faceted-filter UX is conventional.
- **Phase 4:** chokidar caveats are well-documented; `following`/`paused` UX is a known pattern from Chrome DevTools / lnav / Logdy.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core picks (TS, Vite, React, TanStack Virtual, chokidar, Vitest, Playwright) are de-facto standards; MEDIUM only on swappable picks (Hono vs Fastify, Orama vs MiniSearch, Biome vs ESLint+Prettier). |
| Features | HIGH | Category is mature; reference products surveyed (DevTools, Wireshark, Charles, MCP/LSP Inspectors, lnav, jless). MEDIUM on AHP-specific differentiators (D11 schema-aware rendering depends on schema availability). |
| Architecture | HIGH on layering (columnar store, correlate-on-append, host abstraction, virtualization — all proven in DevTools/Perfetto/Jaeger); MEDIUM on tuning numbers (chunk size, virtualization thresholds, when to move Core to a Worker — depend on real log volumes). |
| Pitfalls | HIGH on C1/C3/C5/M3/M6/M10 (universal log-viewer/devtool wisdom); HIGH+domain-specific on C4 (LSP/DAP precedent) and C2 (well-established local-DevTool secret-handling guidance); MEDIUM on UX-flavored items (M2, M5, M7, M8, M9). |

**Overall confidence:** HIGH. The category is well-trodden, the constraints are clear, the architecture has prior art, and the unknowns are localized to (a) the exact JSONL shape VS Code emits and (b) hacker-theme design scope — both resolvable in the relevant phases.

### Gaps to Address

- **Real JSONL event shape:** the canonical `AhpEvent` envelope in `ARCHITECTURE.md §4` is a recommendation, not a confirmed VS Code output. Resolve in P1 by reading `../agent-host-protocol/types/messages.ts` and any VS Code emit code; if VS Code already emits a different shape, the Normalizer adapts (don't re-fight the source). Keep `HumanLogAdapter` as the throwaway bridge for the current sample.
- **`sessionId` / `turnId` placement:** if VS Code emits these only inside `raw.params`, the Normalizer must lift them; performance is unaffected, but the correlation/grouping code path differs. Decide in P1 once a real sample exists.
- **Schema availability for D11:** confirm `agent-host-protocol` ships TS types and/or JSON schemas complete enough for schema-aware payload rendering. If thin, demote D11 to v1.1.
- **Log rotation UX:** chokidar handles rotation mechanically, but the UX (follow rotated file? show "log rotated" marker only? open the new file as a peer?) needs a product decision in P4.
- **Performance inflection points:** §8 numbers (10K / 100K / 1M events) are order-of-magnitude. Validate against a real long-running session in P4; the columnar layout supports moving Core into a Worker without restructuring if needed.
- **Hacker-theme aesthetic scope:** explicitly flagged as needing a design call before P5 — phosphor glow + scanlines + terminal cursor sounds great in prose; needs a concrete reference look before scope/effort is real.

## Sources

### Primary (HIGH confidence)
- `/Users/roblou/code/agent-host-protocol/` — AHP TS types, JSON schemas, transport docs (single source of truth for protocol).
- `PROJECT.md` — product vision, constraints, scope boundaries.
- AHP sample log path (referenced for event-marker conventions only — *no payload contents quoted*).
- VS Code Extension API docs — webview `postMessage`, `FileSystemWatcher`, theme variables.
- TanStack Virtual official docs — virtualization with dynamic heights.
- Tailwind v4 official blog/docs — CSS-first config + variable theming.
- Shiki official docs — TextMate grammar parity with VS Code.
- chokidar 4 release notes & README — platform quirks, atomic-replace handling.
- JSON-RPC 2.0 spec — id semantics, error shape, notification rules.

### Secondary (MEDIUM confidence)
- Hono docs — Node adapter + SSE; verified against repo activity.
- Orama docs — performance to be validated at v1 dataset sizes.
- Biome docs — newer tool; rule coverage narrower than ESLint, accepted trade.
- Pattern references: Chrome DevTools Network/WebSocket panels, Wireshark, Charles/Proxyman, MCP Inspector, LSP Inspector, vscode-jsonrpc tracing, Datadog/Honeycomb traces, lnav, Logdy, OkLog, jless/fx — for category UX and architectural patterns (columnar event stores, correlate-on-append, follow/pause UX, dynamic-height virtualization).

### Tertiary (LOW confidence — needs validation)
- Specific version pins in `STACK.md §6` — verify minors at install time.
- Performance numbers in `ARCHITECTURE.md §8` (10K / 100K / 1M event budgets) — order-of-magnitude only; validate in P2/P4 against real logs.

---
*Research completed: 2026-05-06*
*Ready for roadmap: yes*
