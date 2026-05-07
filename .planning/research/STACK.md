# Technology Stack — AHP Log Viewer

**Project:** AHP Log Viewer
**Researched:** 2026-05-06
**Mode:** Ecosystem (Stack dimension)
**Overall confidence:** HIGH for core picks (TypeScript / Vite / React / TanStack Virtual / chokidar / Vitest / Playwright); MEDIUM for newer picks (Hono on Node, Orama, Biome) where the ecosystem has multiple defensible choices.

---

## 1. Recommended Stack at a Glance

| Layer | Pick | Why (one-liner) |
|---|---|---|
| Language | TypeScript 5.x (strict) | Required by AHP types; only sane choice for shared types across CLI + UI. |
| Runtime | Node.js 22 LTS | Current LTS; native `fetch`, `--watch`, stable ESM, fast `node:test` — but we'll still use Vitest. |
| Package manager | pnpm 9+ (workspaces) | Fast, strict, first-class monorepo for `cli` / `host` / `shared` / `ui`. |
| CLI framework | `commander` 12 | Mature, tiny, zero-drama; we need ~3 commands. |
| Local server | `hono` 4 (Node adapter) | Tiny, TS-native, web-standard `Request`/`Response`; trivially portable if we ever embed elsewhere. |
| Live tail transport | Server-Sent Events (SSE) | One-way server → UI is exactly our shape; survives reloads, no socket lifecycle. |
| File watching | `chokidar` 4 | Cross-platform reliability; `fs.watch` is still flaky on macOS/Windows for log rotation. |
| JSONL parsing | Custom line splitter + `JSON.parse` per line | Trivial, fastest path; no dependency tax. |
| UI framework | React 19 + Vite 5 | Best ecosystem for the *specific* widgets we need (virtualization, JSON tree, cmdk) and runs unchanged inside a VS Code webview. |
| Virtualization | `@tanstack/react-virtual` 3 | De-facto standard; dynamic row heights, which we need for expanded events. |
| Client state | `zustand` 5 | Tiny, no boilerplate, fits a single-document viewer. |
| Styling | Tailwind CSS v4 + CSS variables | v4's CSS-first config + CSS vars give us 3 themes (light / dark / hacker) without runtime cost. |
| Primitives | Radix UI primitives | Accessible, unstyled — pairs cleanly with Tailwind for dialogs, popovers, tooltips. |
| Command palette | `cmdk` | Small, the de-facto palette UX; nice keyboard handling. |
| JSON tree view | `react-json-view-lite` | Tiny (~5KB), fast in virtualized rows; we render heavy payloads via Shiki instead. |
| Syntax highlighting | `shiki` 1.x | Uses VS Code TextMate grammars — visual parity with the editor users came from. |
| Search / index | `orama` 2 | TS-first in-memory full-text + filter + facet; perfect fit; no native deps. |
| Icons | `lucide-react` | Tree-shakable, large coverage, MIT. |
| Dates | `date-fns` 3 (subpath imports) | Tree-shakable, no Moment-style bloat. |
| Schemas / types | Import AHP TS types directly from `../agent-host-protocol` | Single source of truth; avoids hand-rolled drift. |
| Runtime validation | `valibot` 0.x (deferred) | Smaller and faster than Zod; only adopt if/when malformed log defense matters. LOW priority for v1. |
| Lint + format | `biome` 1.x | One tool, fast, replaces ESLint+Prettier; sensible defaults for TS+React. |
| Unit / component tests | `vitest` + `@testing-library/react` | Vite-native, instant feedback; best DX in this stack. |
| E2E tests | `playwright` | Industry default; needed for keyboard / virtualization smoke tests. |
| Build (UI) | Vite 5 | Already implied by React choice. |
| Build (CLI / host) | `tsup` (esbuild) | One-line bundler for the CLI/server output; fast, no config. |

---

## 2. Runtime Architecture (CLI → Local Server → UI)

```
┌──────────────────────────────────────────────────────────────────┐
│                    ahp-viewer (CLI, Node 22)                     │
│                                                                  │
│   commander parses args ──► boots Hono server on 127.0.0.1:PORT  │
│                              │                                   │
│                              ├── serves built UI (Vite output)   │
│                              ├── GET  /api/logs        (discover)│
│                              ├── GET  /api/log         (snapshot)│
│                              ├── GET  /api/log/stream  (SSE tail)│
│                              └── uses LogHost (Node impl)        │
│                                  ├── chokidar watcher            │
│                                  └── incremental tail reader     │
└──────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │ HTTP + SSE (default Host adapter)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  Browser tab (Vite-built React app)                              │
│                                                                  │
│   UI ──► HostClient interface ──► HttpHostClient (default)       │
│                              └──► VsCodeHostClient (future)      │
│                                                                  │
│   Zustand store ◄── parsed events ◄── Orama index                │
│   TanStack Virtual rows ◄── filtered/searched view               │
└──────────────────────────────────────────────────────────────────┘
```

**Workspace layout (pnpm):**

```
packages/
  shared/    # AHP type re-exports, event model, JSONL parser, host interface
  host-node/ # NodeLogHost: discover, watch, tail (chokidar + fs)
  server/    # Hono app, SSE endpoint, static asset serve
  cli/       # commander entry, opens browser, wires server + host
  ui/        # Vite + React app (transport-agnostic via HostClient)
```

The `HostClient` interface in `shared/` is the seam that lets the same UI later run in a VS Code webview by swapping `HttpHostClient` for a `postMessage`-based `VsCodeHostClient`.

---

## 3. Why These Picks (Where It Matters)

### React 19 over Solid / Svelte 5
- We rely on three component ecosystems that are all first-class in React: **TanStack Virtual**, **cmdk**, **Radix**. Solid/Svelte equivalents exist but are less battle-tested for dynamic-height virtualization with thousands of rows.
- VS Code webviews are just Chromium; React runs unchanged. No SSR concerns.
- Confidence: **HIGH**.

### Hono over Fastify / Express
- Fastify is excellent but Node-shaped; Hono uses the web `Request`/`Response` standard which means the server code is portable and the SSE handler is ~20 lines. For a 3-route local server, Hono wins on simplicity.
- Express is unmaintained-feeling and not TS-first. Skip.
- Confidence: **MEDIUM** (Fastify is a perfectly fine alternative).

### SSE over WebSocket
- Traffic is one-directional (server pushes new log lines). SSE auto-reconnects, works through any proxy, and needs no client library.
- WebSockets add bidirectional complexity we don't use.
- Confidence: **HIGH**.

### TanStack Virtual over react-window / react-virtuoso
- `react-window` doesn't handle dynamic heights well, which we need when rows expand to show payloads.
- `react-virtuoso` is good but heavier and more opinionated; TanStack Virtual is unstyled, headless, and lets us own layout.
- Confidence: **HIGH**.

### Tailwind v4 + CSS variables for theming
- Three themes (light / dark / hacker) are trivial with `[data-theme="hacker"]` overriding CSS variables that Tailwind utilities consume. No runtime theme provider needed.
- v4's Lightning CSS engine is fast enough we can keep Vite HMR snappy even with thousands of utility classes.
- Confidence: **HIGH**.

### Orama over MiniSearch / FlexSearch / brute-force filter
- We need (a) full-text on payload strings, (b) facet/filter on method, direction, session, status. Orama supports all three with one index; MiniSearch needs us to bolt on filtering.
- Pure in-memory; no native modules; ~30KB.
- Index can be rebuilt incrementally as new lines arrive.
- Confidence: **MEDIUM** (MiniSearch is a safe fallback if we hit perf cliffs with very large logs).

### Shiki over highlight.js / Prism
- Uses the same TextMate grammars as VS Code → identical look to where users came from. Important for a tool whose users *live* in VS Code.
- Async tokenization fits well behind a "Raw JSON" expansion panel.
- Confidence: **HIGH**.

### Biome over ESLint + Prettier
- One config, one binary, ~10× faster on this size of repo. Covers TS + React + import sorting.
- Risk: rule coverage is narrower than ESLint; we accept that trade for a small project.
- Confidence: **MEDIUM**.

### Import AHP types directly (don't regenerate)
- `../agent-host-protocol/types/*.ts` already exists. Re-export from `packages/shared`. Generating from JSON Schema adds toolchain weight and creates drift.
- Confidence: **HIGH**.

---

## 4. What NOT to Use (and Why)

| Rejected | Reason |
|---|---|
| **Electron** | Heavy runtime, slow iteration, and we'd still need a server-ish layer for file access. The browser-served local app is lighter and ports to VS Code webview unchanged. |
| **Tauri** | Adds a Rust toolchain. Buys nothing for v1: we already have Node for filesystem access, and the UI can't be reused inside a VS Code webview if it depends on Tauri APIs. |
| **Next.js / Remix** | No SSR or routing-heavy needs; Vite SPA is simpler and works in webviews. |
| **Redux / Redux Toolkit** | Overweight for a single-document viewer; Zustand fits in a page. |
| **Moment.js** | Deprecated, huge. Use `date-fns`. |
| **Lodash (full)** | Modern JS covers everything we need; cherry-picked utilities at most. |
| **Webpack / CRA** | CRA is dead; Webpack is slow vs Vite. |
| **MUI DataGrid / AG Grid** | Heavy, opinionated styling, hard to make information-dense and theme three ways. We want full control. |
| **Express** | Not TS-first, slower than Hono/Fastify, ecosystem stagnating. |
| **Socket.IO** | Server pushes one-way data; SSE is the right primitive. |
| **stream-json / oboe** | `JSON.parse` per line on JSONL is faster and simpler than streaming JSON parsers, which target single huge JSON documents. |
| **node-tail / tail-file** | A 30-line tail using `fs.createReadStream(start: lastOffset)` + chokidar size events is more reliable and avoids a dependency that's mostly unmaintained. |
| **Zod for v1** | Defer until we hit a malformed-log bug; AHP TS types are sufficient at compile time. Valibot when needed. |
| **react-json-view (the original)** | Unmaintained, large bundle. Use `react-json-view-lite`. |
| **Storybook** | Useful at scale, overkill here; component test files in Vitest cover our needs. |

---

## 5. Capability Mapping (Requirement → Pick)

| Requirement | Library / Approach |
|---|---|
| Auto-discover VS Code AHP logs | NodeLogHost scans known paths (`~/Library/Application Support/Code/logs/...`, `%APPDATA%\Code\logs\...`, `~/`); plus manual `--file` arg via commander. |
| Watch growing JSONL files | chokidar 4 (`usePolling: false`, fall back to polling on network mounts) + offset-tracked `fs.createReadStream`. |
| Incremental parsing | Buffer partial last line between reads; `JSON.parse` each completed line; emit batches via SSE. |
| Render large lists | TanStack Virtual with measured dynamic row heights. |
| Search across payloads | Orama index built incrementally; queries debounced from the UI. |
| Filter by method / direction / session / status / time | Orama `where` filters on indexed facets; same code path as text search. |
| Expand event details | Row state in Zustand; payload pretty-printed via Shiki on demand (lazy). |
| Request/response correlation | Build a `Map<requestId, {request, response, latencyMs}>` during ingestion; UI joins responses to their parent row. |
| Light / dark / hacker themes | CSS variables driven by `[data-theme]`; Tailwind v4 utilities reference the variables. |
| Future VS Code webview | `HostClient` interface in `shared/`; UI never imports Node APIs directly. |
| Privacy (no cloud) | Server binds `127.0.0.1` only; CSP forbids external origins; Shiki ships grammars locally. |

---

## 6. Versions to Pin (Initial)

> Confidence on exact patch numbers is MEDIUM; minors should be verified at install time.

```jsonc
{
  "dependencies": {
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "commander": "^12.1.0",
    "chokidar": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-virtual": "^3.10.0",
    "zustand": "^5.0.0",
    "@orama/orama": "^2.1.0",
    "shiki": "^1.22.0",
    "react-json-view-lite": "^1.4.0",
    "cmdk": "^1.0.0",
    "lucide-react": "^0.460.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tsup": "^8.3.0",
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@playwright/test": "^1.48.0",
    "@biomejs/biome": "^1.9.0"
  }
}
```

---

## 7. Open Questions for Later Phases

- **Real JSONL schema** — current sample is human-readable; once VS Code emits real JSONL, validate field names against `agent-host-protocol/types/messages.ts` and decide whether Valibot guards are warranted.
- **Very large logs (>500MB)** — Orama is in-memory; we may need a windowed index (last N events fully indexed, older events on-disk). Defer until measured.
- **Log rotation** — chokidar handles renames, but we should decide UX: follow rotated file? show a "log rotated" marker?
- **Auth tokens in payloads** — consider a redaction toggle before any future "share" feature; not a v1 concern but flag in PITFALLS.

---

## 8. Sources

- AHP repo (local): `/Users/roblou/code/agent-host-protocol/` — types, schemas, transport docs (HIGH confidence; primary source of truth).
- Hono docs: https://hono.dev (Node adapter + SSE helpers) — MEDIUM, verified against repo activity.
- TanStack Virtual: https://tanstack.com/virtual — HIGH, de-facto standard.
- Tailwind v4: https://tailwindcss.com/blog/tailwindcss-v4 — HIGH, official.
- Orama: https://docs.orama.com — MEDIUM, verify perf at v1 dataset sizes.
- Shiki: https://shiki.style — HIGH, official.
- chokidar 4 release notes — HIGH.
- Biome: https://biomejs.dev — MEDIUM.

WebSearch / Context7 were not invoked for this round; recommendations rest on stable, well-known 2024–2026 ecosystem positions plus direct inspection of `agent-host-protocol`. Items marked MEDIUM should be sanity-checked against current npm versions during Phase 1 setup.
