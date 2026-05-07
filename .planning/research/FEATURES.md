# Feature Landscape: AHP Log Viewer

**Domain:** Developer protocol / structured log viewer (JSON-RPC traffic timeline)
**Researched:** 2026-05-06
**Confidence:** HIGH for table stakes (well-established category — Chrome DevTools Network, Wireshark, Charles, Postman Console, MCP Inspector, LSP Inspector, vscode-jsonrpc tracing); MEDIUM for AHP-specific differentiators (project is greenfield; protocol is young).

## Reference Products Surveyed

| Product | What we steal | What we skip |
|---------|---------------|--------------|
| Chrome DevTools → Network | Two-pane timeline, request/response correlation, status badges, filter bar, "preserve log", waterfall timing, copy-as-cURL | HAR import/export, throttling, blocking |
| Chrome DevTools → WebSocket Frames | Direction arrows, frame-by-frame inspection, type-based coloring | — |
| VS Code Output / LSP Inspector | Method-name grouping, request↔response pairing, error highlighting | — |
| MCP Inspector | Protocol-aware action/notification rendering, schema-driven detail views | Live protocol manipulation (anti-feature for v1) |
| Wireshark | Display filter language, follow-stream, color rules | Decode-as, packet dissection complexity |
| Charles / mitmproxy | Sequence + structure dual view, breakpoint-style focus | Proxying / interception |
| `jq` / fx / jless | Folded JSON tree, path display, search-in-payload | Full expression language (defer) |
| Datadog / Honeycomb traces | Trace timeline (turn = trace, action = span), latency histogram | Aggregation across files |

This product's positioning: **"DevTools Network panel for AHP."** Information-dense, scrollable, correlation-aware, instantly understandable.

---

## Table Stakes (v1) — Users Will Notice If Missing

These define a minimum credible v1. Each one is something a developer opening the app for the first time will reach for within 60 seconds.

### Ingestion & Discovery

| # | Feature | Complexity | Depends On | Notes |
|---|---------|-----------|------------|-------|
| T1 | Auto-discover likely VS Code AHP log files (well-known paths, `agenthost.*.log` glob in `~`) | Low | — | Show list with mtime/size; one-click open |
| T2 | Manual file open (CLI arg + in-app picker) | Low | — | CLI: `ahp-viewer ./file.jsonl`; in-app: native file dialog |
| T3 | Stream / tail mode — watch file for appends and render incrementally | Med | T2 | `fs.watch` + size-tracking re-read of tail; must handle truncation/rotation |
| T4 | JSONL parser tolerant of malformed lines (skip + flag, never crash) | Low | — | Real logs will have partial writes; surface parse errors as a dedicated event row |
| T5 | Bounded memory on huge logs (100MB+) — index, don't retain full strings in arrays of objects | High | T4 | Store offsets + light index; lazy-load payloads |

### Timeline & Display

| # | Feature | Complexity | Depends On | Notes |
|---|---------|-----------|------------|-------|
| T6 | Virtualized timeline (only render visible rows) | Med | T5 | TanStack Virtual or similar; non-negotiable for responsiveness |
| T7 | Information-dense row: timestamp, direction (→/←), kind (req/resp/notif/action/error), method or action `type`, session/turn ID short, latency (for resp), one-line payload preview | Med | T4 | Fixed-height rows; monospace; column-ish but not table-rigid |
| T8 | Direction & kind visual encoding (color + glyph), e.g. `→` client→server, `←` server→client, `⚑` notification, `✦` action, `✕` error | Low | T7 | Maps to existing `>>`/`<<`/`!!`/`**` markers in current sample |
| T9 | Request ↔ response correlation by JSON-RPC `id`; resp row links to req, req row shows resolved status & latency | Med | T4 | Unmatched requests visually flagged ("pending" or "orphaned") |
| T10 | Click row → detail pane with: pretty-printed JSON, raw JSON toggle, copy-to-clipboard, copy raw line | Low | T7 | Detail pane is right-side or bottom split |
| T11 | Folded JSON tree in detail view with expand/collapse, large-string truncation with "show more" | Med | T10 | Avoid rendering 10k-line payloads by default |
| T12 | Empty state, loading state, parse-error state — each designed, not default | Low | T1, T4 | Polish marker |

### Search & Filter

| # | Feature | Complexity | Depends On | Notes |
|---|---------|-----------|------------|-------|
| T13 | Quick-filter bar with text search across method, action `type`, IDs, and payload | Med | T5 | Debounced; full-text via prebuilt token index on payload |
| T14 | Faceted filters: direction, kind, method, action `type`, session, turn, status (ok/error/pending) | Med | T13 | Sidebar or dropdown chips; multi-select; reflect counts |
| T15 | Time-range filter (drag on a mini-timeline or from/to inputs) | Med | T7 | Useful for long-running sessions |
| T16 | "Jump to next error" / "next unmatched" keyboard shortcut | Low | T9 | `n`/`N` like vim |
| T17 | Persist last-opened file, theme, and filter state across launches | Low | — | localStorage; small but expected |

### Theming & Polish

| # | Feature | Complexity | Depends On | Notes |
|---|---------|-----------|------------|-------|
| T18 | Light, dark, hacker themes — fully styled, not CSS variable swaps with bad contrast | Med | — | Hacker = green-on-black, CRT-ish; explicit project requirement |
| T19 | Keyboard navigation: ↑/↓ rows, Enter to expand, `/` focus search, `Esc` clear | Low | T7 | Power-user table stakes |
| T20 | Responsive layout down to ~1024px; usable up to ultra-wide | Low | — | Don't break on common laptop widths |

---

## Differentiators (v1 if Cheap, Else v1.1)

These match the stated vision of "fast, responsive, digestible, cool/polished." They are not category-standard, and shipping them is what makes this app feel _designed_ rather than generic.

| # | Feature | Complexity | Depends On | Why It Matters |
|---|---------|-----------|------------|----------------|
| D1 | **Session/turn grouping toggle** — collapse a timeline by session or by turn so you can see "this turn produced 47 actions" as one foldable block | Med | T7, T9 | AHP's primary structuring concepts; turns this from a log into a story |
| D2 | **Action type taxonomy with semantic colors** — distinct visual treatment per action `type` family (text, tool-call, tool-result, status, etc.); legend in sidebar | Low–Med | T8 | Makes the timeline scannable at speed; defines "cool" |
| D3 | **Latency heat strip** — a thin column or row background tinted by request latency; outliers pop | Low | T9 | Free perf insight |
| D4 | **`serverSeq` gap detection** — if action envelope sequence numbers skip, render a visible gap marker | Low | T4 | High-signal correctness check unique to AHP |
| D5 | **Auth-failure highlighting** — auth errors get their own treatment (the sample log shows these matter) | Low | T8 | Users will be debugging auth |
| D6 | **Hacker theme that earns its name** — phosphor glow, scanline option, monospace everywhere, terminal-cursor accents | Med | T18 | Stated vision; differentiator if done well, embarrassing if half-done |
| D7 | **Smooth incremental rendering** — appended rows animate in subtly; no jank, no full re-layout | Med | T3, T6 | "Feels alive" during a live session |
| D8 | **Sticky header showing current session/turn while scrolling** | Low | D1 | Context preservation |
| D9 | **Copy as JSON-RPC request** — for any request row, copy a runnable payload | Low | T10 | Low effort, high "oh nice" value |
| D10 | **Mini-timeline / overview ruler** on the right edge showing density, errors, and current viewport | Med | T15 | Wireshark/IDE-style; great spatial awareness |
| D11 | **Schema-aware payload rendering** — use `agent-host-protocol` JSON schemas to label fields and pretty-print known shapes | Med–High | T11 | Real differentiator; check Context7/repo for schema availability |

---

## Deferred (Useful but Explicitly Out of v1)

Standard log-viewer features that are valuable but would distract from shipping a polished v1.

| # | Feature | Reason to Defer |
|---|---------|-----------------|
| F1 | Multi-file / multi-tab viewing | Single-file UX must be excellent first |
| F2 | Saved searches / saved filter presets | Persisted last-used (T17) covers 80% |
| F3 | Export filtered slice as JSONL / HAR-equivalent | Nice for sharing repros, not core |
| F4 | Bookmark / annotate individual events | Niche until users ask |
| F5 | Diff two events or two sessions | Powerful but complex; defer |
| F6 | Aggregate metrics dashboard (counts per method, p50/p95 latency) | Needs design work; out of scope for "viewer" |
| F7 | Wireshark-style display filter expression language | Faceted filters (T14) cover the common case |
| F8 | Trace-style waterfall (Gantt) view of overlapping requests | High effort; timeline + correlation suffices for v1 |
| F9 | Plugin / custom renderer API | Premature abstraction |
| F10 | Remote log streaming (over SSH / HTTP) | Local-first is the constraint |
| F11 | Notifications / alerts on error patterns | Background-watcher behavior; out of scope |
| F12 | Full-text search with regex + boolean operators | Plain substring + facets first |
| F13 | Inline schema validation of payloads | Use schemas for rendering (D11) before validation |
| F14 | VS Code extension / webview packaging | Architecture should _enable_ this; v1 ships standalone |

---

## Anti-Features (Deliberately Avoid in v1)

Things that would actively hurt the product or violate stated scope.

| # | Anti-Feature | Why Avoid | What To Do Instead |
|---|--------------|-----------|--------------------|
| A1 | **Editing or replaying protocol traffic** | v1 is observer-only (PROJECT.md out-of-scope); inviting edits invites bugs and confusion | Provide "copy as request" (D9) so users can replay in their own tooling |
| A2 | **Auto-redaction or "smart" content filtering** | Logs contain tokens/prompts; silently hiding content makes debugging harder and creates a false sense of safety | Be explicit: app is local; warn before any future export feature |
| A3 | **Sending logs / payloads to any external service** (telemetry, AI summarization, error reporting) | Logs are sensitive (auth, prompts, model output); local-first means local-only | If a future "explain this event" feature uses an LLM, it must be opt-in and clearly disclosed |
| A4 | **Heavy framework chrome** (multi-pane IDE shell, command palette, settings tree) before the timeline is excellent | Distracts from the core "digest AHP traffic at a glance" value | Single primary view + detail pane + filter bar; resist sidebars-of-sidebars |
| A5 | **Full-document re-parse on every file append** | Kills responsiveness on growing logs | Incremental tail parsing (T3) with offset index (T5) |
| A6 | **Loading entire payload bodies into the timeline row data structure** | OOM on large logs | Store offset + lazy-fetch on expand (T5, T11) |
| A7 | **Custom DSL or query language in v1** | Learning curve; users want to skim, not query | Faceted filters + substring search (T13, T14) |
| A8 | **Tight coupling to current human-readable sample format** | Sample is transitional; real format is JSONL | Build for JSONL; sample only informs which fields matter |
| A9 | **Theming as CSS-variable swap with no design pass per theme** | "Hacker theme" requires real visual identity, not a hue rotation | Treat each theme as a designed surface (D6) |
| A10 | **Modal dialogs for routine actions** (open file, change theme) | Breaks flow | Inline UI, slide-over panels, keyboard shortcuts |

---

## Feature Dependency Graph

```
T4 (parse JSONL)
 ├── T5 (bounded memory / index) ── T6 (virtualized list) ── T7 (dense row) ── T8 (visual encoding)
 │                                                            │
 │                                                            ├── T10 (detail pane) ── T11 (folded JSON)
 │                                                            └── T19 (keyboard nav)
 ├── T9 (req/resp correlation) ── D3 (latency heat) ── D10 (overview ruler)
 │                              └── T16 (jump to error)
 └── T13 (text search) ── T14 (facets) ── T15 (time range)

T2 (manual open) ── T3 (tail/watch) ── D7 (smooth incremental render)
T1 (auto-discover) ── T17 (persistence)

T18 (themes) ── D6 (hacker theme polish)

D1 (session/turn grouping) ── D8 (sticky header)
D11 (schema-aware rendering) requires T11 + agent-host-protocol schemas
```

Critical path for a usable v1: **T4 → T5 → T6 → T7 → T9 → T10 → T13/T14 → T18 → T3**.

---

## MVP Recommendation (in priority order)

A v1 that ships when these are done; differentiators layered on as time allows:

1. T4 JSONL parser (tolerant)
2. T5 indexed/bounded storage
3. T6 + T7 + T8 virtualized dense timeline with visual encoding
4. T9 request/response correlation
5. T10 + T11 detail pane with folded JSON
6. T13 + T14 search + faceted filters
7. T2 + T1 file open + auto-discovery
8. T3 tail/watch live mode
9. T18 three themes (light/dark/hacker), with D6 polish on hacker
10. T17 + T19 persistence + keyboard nav
11. D1 session/turn grouping (highest-value differentiator)
12. D2 action-type colors, D4 serverSeq gaps, D5 auth highlighting (cheap wins)
13. D9 copy-as-request, D3 latency heat, D10 overview ruler (polish layer)

Defer everything in the F-table. Refuse everything in the A-table.

---

## Open Questions for Requirements Phase

- **Real JSONL schema:** What exact event shape will VS Code emit? Each line a JSON-RPC message, or a wrapper envelope with `direction`, `timestamp`, `payload`? This determines parser and correlation logic. → coordinate with `agent-host-protocol` repo.
- **Log rotation:** Does VS Code rotate `agenthost.*.log` files? Affects T3 (watch behavior) and T1 (discovery — show all rotated siblings?).
- **Multiple concurrent sessions in one file:** Does one log file contain one host's traffic across many sessions, or one session per file? Affects D1 grouping defaults.
- **Schema availability:** Are JSON schemas in `agent-host-protocol` complete enough to drive D11? If not, D11 becomes v1.1.
- **Hacker theme scope:** How far on the CRT/scanline aesthetic? Needs a design call before D6 is scoped.

## Sources

- PROJECT.md (project context, requirements, constraints) — HIGH
- Sample log `~/agenthost.2a22cea9-b08d-4287-83ca-fe6817470628.log` — HIGH (event-marker conventions)
- Category knowledge: Chrome DevTools Network/WebSocket panels, Wireshark, Charles, Postman Console, MCP Inspector, LSP Inspector, vscode-jsonrpc tracing, jless/fx — MEDIUM (training data, established UX patterns)
- `agent-host-protocol` repo referenced but not deep-dived in this pass — flagged for stack/architecture researchers
