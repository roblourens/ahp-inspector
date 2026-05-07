# Phase 1: Core Foundations — Research

**Researched:** 2026-05-06
**Domain:** TypeScript monorepo scaffolding, JSONL streaming parsing, JSON-RPC bidirectional correlation, host-adapter boundary, columnar event store
**Confidence:** HIGH on architecture and contracts; MEDIUM on exact published library major versions (verified against npm registry today — diverge from project-level research which predates verification)

---

## Summary

Phase 1 is a contracts-and-plumbing phase. It produces no UI; it produces the **types, parsers, store, and host boundary** that every later phase consumes. The cheapest moment to fix the canonical event envelope, the request/response correlation key, the host adapter interface, and the network/security posture is *now* — retrofitting any of these later forces a UI rewrite.

The phase splits into five tightly-scoped deliverables: (1) a pnpm workspace scaffold that physically enforces the layer boundaries (UI cannot import Node), (2) a `shared` package re-exporting AHP types from `../agent-host-protocol` and defining the canonical `AhpEvent` envelope, (3) a tolerant streaming JSONL parser plus a throwaway `legacy.ts` adapter for the current human-readable sample log, (4) a columnar `EventStore` with a `Correlator` keyed on `(session, direction, idType, id)`, and (5) a `HostAdapter` interface (Node implementation in `host-node`) and a `HostClient` interface (consumed by future UI) that share one `HostMessage` discriminated union.

**Primary recommendation:** Build the canonical `AhpEvent` envelope, `HostAdapter`/`HostClient` interfaces, `EventStore` columns, and the `(session, direction, idType, id)` correlation key as a single locked contract in this phase, expressed as TypeScript types in `packages/shared`. Every later phase imports from there. Treat any later change to these as a contract break that requires explicit cross-phase review.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Developer can install dependencies and run a standalone local AHP Log Viewer from the CLI. | Phase 1 produces only a CLI shell that boots the server skeleton; full UI lands in Phase 2. Scaffolding must include a runnable `bin` entry, even if it just prints "open log not yet wired". §"Standard Stack", §"Architecture Patterns / Pattern 1". |
| FOUND-02 | Codebase separates portable core, Node host, server transport, CLI entry, browser UI. | pnpm workspace with `packages/{shared,core,host-node,server,cli,ui}` and lint-enforced import boundaries (forbid `node:*`/`fs`/`chokidar` outside `host-node`). §"Recommended Project Structure", §"Pitfall: Webview compatibility broken late". |
| FOUND-03 | Use `../agent-host-protocol` as source of truth for AHP method/action/notification/schema. | `packages/shared/src/ahp/index.ts` re-exports `IProtocolMessage`, `IActionEnvelope`, `IProtocolNotification`, `ICommandMap`, `INotificationMap`, `ActionType`, `NotificationType` from the sibling repo. No hand-rolled method or action enums. §"Standard Stack / AHP types". |
| FOUND-04 | Local-only security: no telemetry, no CDN assets, no outbound network for viewing. | Bake CSP `default-src 'self'`, ban CDN font/`<script src=https://>` imports, no analytics/error reporting deps in `package.json`, no auto-update calls. Locked here because retrofitting after a single CDN dep is impossible. §"Security Domain", §"Pitfall: Secret leakage". |
| INGEST-07 | Legacy human-readable sample parses through an adapter without coupling main model. | `packages/parser/src/legacy.ts` consumes the `>>` / `<<` / `!!` / `**` headers and produces canonical `AhpEvent` objects. Lives behind the same `parse(line) → AhpEvent \| ParseError` shape as the JSONL parser. §"Pattern: Parser/Adapter split", §"Code Examples / Legacy adapter sketch". |
| EVENT-01 | Each entry normalized to canonical event with ts, direction, kind, method/action, IDs, session/turn/tool, sequence, raw, parse status. | Defined in §"Canonical AhpEvent envelope (TypeScript)". |
| EVENT-02 | Requests / responses / notifications / state actions / protocol notifications / errors / parse errors classified consistently. | `EventKind` discriminant: `'request' \| 'response' \| 'client-notification' \| 'server-notification' \| 'action' \| 'protocol-notification' \| 'log' \| 'parse-error'`. Distinction between JSON-RPC notifications (transport-level) and AHP `action` / `notification` payloads (protocol-level) is non-trivial — see §"Code Examples / Normalizer discriminant". |
| EVENT-03 | Request/response correlation by JSON-RPC-safe bidirectional key preserving session, direction, id value, id type. | Key: `${sessionId ?? '∅'}::${requestDirection}::${typeof id}::${String(id)}`. Lookup uses *request* direction (a response carries the request's direction logically). See §"Pattern: Correlation key (JSON-RPC bidirectional safe)". |
| VERIFY-01 | Parser/normalizer tests cover valid JSONL, malformed, partial trailing, CRLF/BOM, large payloads, correlation, legacy adapter. | Vitest fixture suite enumerated in §"Validation Architecture / Phase Requirements → Test Map". |
| VERIFY-04 | Fixture logs scrubbed — no tokens or private prompt/output content. | All fixtures are synthesized by `test/fixtures/generate.ts` from canonical envelope shapes; no fragments derived from `~/agenthost.*.log`. Pre-commit secret scan (regex for `Bearer `, `sk-`, `ghp_`, `eyJ` JWT prefix). §"Security Domain / Fixture scrubbing". |
</phase_requirements>

---

## Standard Stack

> All versions verified against npm registry on 2026-05-06 with `npm view <pkg> version`. Several diverge from the project-level STACK.md research (which was written before live verification). Use the verified versions.

### Core (Phase 1 only — UI/server libs land in Phase 2)
| Library | Verified version | Purpose | Why standard |
|---------|------------------|---------|--------------|
| `typescript` | 6.0.3 [VERIFIED: npm view] | Language for every package | AHP repo ships TS source; only sane choice for shared types |
| `pnpm` | 9+ (use `packageManager` field) [ASSUMED: still current major] | Workspace manager | Strict isolation, fast installs, first-class monorepo |
| Node.js | 22 LTS [ASSUMED] | Runtime for `host-node`, `server`, `cli` | Current LTS; native `fetch`, stable ESM |
| `commander` | 14.0.3 [VERIFIED: npm view] | CLI argument parsing | Mature, tiny; phase 1 needs only `ahp-viewer <file>` skeleton |
| `chokidar` | 5.0.0 [VERIFIED: npm view] | File watching for `host-node` | Cross-platform reliability vs. raw `fs.watch` |
| `vitest` | 4.1.5 [VERIFIED: npm view] | Unit + fixture testing | Vite-native, instant feedback |
| `@biomejs/biome` | 2.4.14 [VERIFIED: npm view] | Lint + format | One binary, fast; replaces ESLint+Prettier |
| `tsup` | 8.5.1 [VERIFIED: npm view] | CLI bundle (esbuild) | One-line config |
| AHP types | local path: `../agent-host-protocol` [VERIFIED: directory inspected] | Source of truth for protocol shapes | `packages/shared` re-exports `IProtocolMessage`, `IActionEnvelope`, `IProtocolNotification`, `ICommandMap`, `INotificationMap`, `ActionType`, `NotificationType` |

### Deferred to Phase 2+ (do **not** install in Phase 1)
`hono`, `vite`, `react`, `@tanstack/react-virtual`, `zustand`, `tailwindcss`, `orama`, `shiki`, `react-json-view-lite`, `cmdk`, `lucide-react`, `date-fns`, `playwright`. Installing them in Phase 1 risks pulling DOM/server dependencies into `core`/`shared` before lint guardrails exist. (For reference: hono 4.12.18, vite 8.0.10, react 19.2.6, @tanstack/react-virtual 3.13.24, zustand 5.0.13 — all verified today.)

### Notable divergence from project-level STACK.md research
| Library | STACK.md said | npm view says | Action |
|---------|---------------|---------------|--------|
| TypeScript | 5.x | 6.0.3 | Pin to TS 5.x **or** TS 6 — TS 6 is brand new; planner should choose. Recommendation: TS 5.6+ for ecosystem maturity. [ASSUMED — verify TS 6 release notes before adopting] |
| commander | 12 | 14.0.3 | Use 14 |
| chokidar | 4 | 5.0.0 | Use 5 (note: chokidar 4 dropped some platform-specific deps; 5 may be similar — review changelog) |
| Biome | 1.x | 2.4.14 | Use 2.x |
| vite/react/vitest | 5/19/(unstated) | 8/19.2/4.1 | Use verified majors when Phase 2 lands |

**Installation (Phase 1 root only):**
```bash
pnpm add -D -w typescript @biomejs/biome vitest tsup
pnpm add -D -w @types/node
# AHP types via workspace path or relative file: dependency
```

### Alternatives Considered
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Custom line splitter + `JSON.parse` | `stream-json` / `ndjson` | Adds dep tax for behavior we control in <50 lines; rejected in research |
| chokidar | `fs.watch` | Cheaper but flaky on macOS atomic-replace; rejected |
| Biome | ESLint + Prettier | Wider rule coverage but slower and 3× config; accept Biome's narrower coverage |
| pnpm workspace | npm workspaces, Nx, Turborepo | Nx/Turbo are overkill for 6 packages; npm workspaces miss strict isolation |

---

## Architecture Patterns

### Recommended Project Structure

```
ahp-viewer/
├── package.json                 # workspace root
├── pnpm-workspace.yaml
├── biome.json
├── tsconfig.base.json
├── packages/
│   ├── shared/                  # PORTABLE: types only, no Node, no DOM
│   │   └── src/
│   │       ├── ahp/             # re-exports from ../agent-host-protocol
│   │       ├── event.ts         # AhpEvent envelope + EventKind discriminant
│   │       ├── parse-error.ts
│   │       ├── correlation.ts   # CorrelationKey type + builder
│   │       └── host-protocol.ts # HostMessage union (transport-agnostic)
│   ├── parser/                  # PORTABLE: pure functions
│   │   └── src/
│   │       ├── jsonl.ts         # parseLine, parseChunk (with tail buffer)
│   │       ├── normalizer.ts    # raw JSON-RPC → AhpEvent
│   │       └── legacy.ts        # human-readable sample adapter (THROWAWAY)
│   ├── core/                    # PORTABLE: store + correlator + projection
│   │   └── src/
│   │       ├── event-store.ts   # columnar arrays + side indices
│   │       ├── correlator.ts    # pair on append; (session,dir,idType,id) key
│   │       └── event-view.ts    # canonical projection for future search/filter
│   ├── host-node/               # NODE-ONLY: fs, chokidar
│   │   └── src/
│   │       ├── host-adapter.ts  # NodeHostAdapter implements HostAdapter
│   │       ├── tail-reader.ts   # offset-tracked incremental read
│   │       └── discovery.ts     # stub (full impl in Phase 4)
│   ├── server/                  # NODE: deferred to Phase 2 (skeleton dir only)
│   ├── cli/                     # NODE: bin entry + arg parsing
│   │   └── src/index.ts
│   └── ui/                      # BROWSER: deferred to Phase 2 (skeleton dir only)
├── test/
│   └── fixtures/
│       ├── generate.ts          # synth fixtures from canonical shapes
│       └── *.jsonl              # tiny scrubbed fixtures
└── .planning/
```

**Boundary enforcement (lint rule, locked in this phase):**
- `packages/shared/**` and `packages/core/**` MUST NOT import `node:*`, `fs`, `path`, `chokidar`, `react`, `vite`, or any DOM type.
- `packages/ui/**` (when it exists in P2) MUST NOT import `node:*`, `fs`, or anything from `packages/host-node/**`.
- Implement via Biome's `noRestrictedImports` rule per-package, or a custom Node script in `pretest`.

### Pattern 1: Canonical `AhpEvent` envelope (TypeScript)

```ts
// packages/shared/src/event.ts
import type { IProtocolMessage } from './ahp/index.js';

/** Direction relative to the client (VS Code is "client"). */
export type Direction = 'c2s' | 's2c';

export type EventKind =
  | 'request'                  // JSON-RPC request (has method + id)
  | 'response'                 // JSON-RPC response (has id + result|error)
  | 'client-notification'      // c2s JSON-RPC notification
  | 'server-notification'      // s2c JSON-RPC notification (method = 'action' | 'notification')
  | 'action'                   // unwrapped state action (params of a server-notification(action))
  | 'protocol-notification'    // unwrapped protocol notification (params.notification of method='notification')
  | 'log'                      // out-of-band transport/log line
  | 'parse-error';             // synthetic — line could not be parsed

export type ParseStatus = 'ok' | 'error';

export type IdType = 'number' | 'string' | 'null';

export interface AhpEvent {
  /** Monotonic ingest-assigned sequence; primary stable key. */
  readonly seq: number;
  /** Wall-clock timestamp from log header (ISO-8601, normalised to UTC ms when displayed). */
  readonly ts: number;          // epoch ms
  readonly tsRaw: string;       // original string for fidelity
  readonly dir: Direction;
  readonly kind: EventKind;

  /** JSON-RPC method on requests/notifications; `null` on responses. */
  readonly method: string | null;
  /** AHP action type when kind === 'action'; protocol-notification type when kind === 'protocol-notification'. */
  readonly actionType: string | null;

  /** JSON-RPC id; preserves type fidelity (1 ≠ "1"). */
  readonly id: number | string | null;
  readonly idType: IdType;

  /** Lifted for cheap grouping; null if absent. */
  readonly sessionId: string | null;
  readonly turnId: string | null;
  readonly toolCallId: string | null;

  /** AHP action envelope `serverSeq` when kind === 'action'. */
  readonly serverSeq: number | null;

  /** Source byte offset (helpful for "go to line in raw"). */
  readonly byteOffset: number;
  readonly byteLength: number;

  /** Lossless original payload for the detail pane. Stored as `unknown`, not stringified. */
  readonly raw: unknown;

  readonly parse: ParseStatus;
  /** Populated when parse === 'error'. */
  readonly parseError?: { reason: string; rawText: string };
}
```

**Why these fields:**
- `seq` is the only stable identity — array indices change as filters apply; timestamps can collide.
- `tsRaw` plus parsed `ts` lets the detail pane show the source string while the timeline sorts on the number.
- `idType` separates the JSON-RPC id-type spaces (`1` vs `"1"`) — see C4 in PITFALLS.md.
- `actionType`/`serverSeq` lifted from action envelopes so the timeline doesn't walk `raw.params.action.type` on every render.
- `kind` distinguishes JSON-RPC envelopes (`request`/`response`/`client-notification`/`server-notification`) from AHP semantic payloads (`action`/`protocol-notification`). The Normalizer emits *both* a `server-notification` row and an unwrapped `action` row when needed, **or** chooses one canonical kind per line — planner must lock this. Recommendation below.

**Normalizer policy decision (LOCK in Phase 1):** Emit **one** event per JSONL line. When the JSON-RPC method is `'action'` (s2c notification with `IActionEnvelope` params), set `kind = 'action'` directly and lift `actionType`/`serverSeq`. When it is `'notification'` (s2c with `IProtocolNotification` params), set `kind = 'protocol-notification'` and lift the notification's `type`. The original JSON-RPC envelope is preserved in `raw`. This avoids fan-out and keeps `seq` 1:1 with input lines.

### Pattern 2: Streaming line splitter with partial-line buffer

```ts
// packages/parser/src/jsonl.ts
export class LineSplitter {
  private buf = '';
  /** Strip BOM at start of file only. */
  private bomConsumed = false;

  /**
   * Push a chunk; returns zero or more complete lines (without trailing \n).
   * Holds a partial trailing line until the next chunk.
   */
  push(chunk: string): string[] {
    let s = chunk;
    if (!this.bomConsumed) {
      if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
      this.bomConsumed = true;
    }
    s = this.buf + s;
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 0x0a /* \n */) {
        let end = i;
        if (end > start && s.charCodeAt(end - 1) === 0x0d /* \r */) end--;
        if (end > start) out.push(s.slice(start, end));
        start = i + 1;
      }
    }
    this.buf = s.slice(start);
    return out;
  }

  /** Call on stream-end to flush any remaining bytes (treated as a final line). */
  flush(): string[] {
    if (this.buf.length === 0) return [];
    const last = this.buf;
    this.buf = '';
    return [last];
  }
}
```

[VERIFIED: tested manually against fixture inputs during research]

### Pattern 3: Tolerant per-line parser

```ts
// packages/parser/src/jsonl.ts
export interface ParsedLine {
  readonly raw: unknown;
  readonly text: string;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly error?: { reason: string };
}

export function parseLine(text: string, byteOffset: number, byteLength: number): ParsedLine {
  if (text.length === 0 || /^\s*$/.test(text)) {
    return { raw: undefined, text, byteOffset, byteLength, error: { reason: 'empty-line' } };
  }
  try {
    return { raw: JSON.parse(text), text, byteOffset, byteLength };
  } catch (e) {
    return { raw: undefined, text, byteOffset, byteLength, error: { reason: (e as Error).message } };
  }
}
```

The Normalizer wraps either branch into an `AhpEvent` (`kind: 'parse-error'` on failure, preserving `text` in `parseError.rawText` and never throwing).

### Pattern 4: Bidirectional JSON-RPC correlation key

```ts
// packages/shared/src/correlation.ts

/**
 * JSON-RPC ids are unique only within (sender, session). Bidirectional protocols
 * (LSP, AHP) have *two* id spaces. Naive `id`-only matching silently mis-pairs.
 *
 * Key components (in this order):
 *   1. session    — null if no session context (initialize, listSessions, etc.)
 *   2. requestDir — 'c2s' for client-issued requests, 's2c' for server-issued
 *                   The response carries the OPPOSITE wire direction but the
 *                   SAME request direction logically.
 *   3. idType     — typeof id ('number'|'string'|'null'); '1' ≠ 1
 *   4. id         — string-coerced for hashing
 */
export type CorrelationKey = string;

export function makeCorrelationKey(
  session: string | null,
  requestDir: Direction,
  idType: IdType,
  id: number | string | null,
): CorrelationKey {
  return `${session ?? '∅'}::${requestDir}::${idType}::${String(id)}`;
}

/** For a response event, derive the key of the request it would pair with. */
export function correlationKeyForResponse(ev: AhpEvent): CorrelationKey {
  const requestDir: Direction = ev.dir === 's2c' ? 'c2s' : 's2c';
  return makeCorrelationKey(ev.sessionId, requestDir, ev.idType, ev.id);
}

/** For a request event, the key it publishes for a future response to find. */
export function correlationKeyForRequest(ev: AhpEvent): CorrelationKey {
  return makeCorrelationKey(ev.sessionId, ev.dir, ev.idType, ev.id);
}
```

**Notifications are never correlated.** `kind === 'client-notification' | 'server-notification' | 'action' | 'protocol-notification'` carry no JSON-RPC id (or the id field is meaningless for pairing); the Correlator skips them.

**Edge case:** the AHP type `IJsonRpcRequest.id` is typed as `number` only, but JSON-RPC 2.0 permits `string` and `null`. The viewer must accept all three on the wire — never crash on `"id": "abc"` even though the AHP TypeScript types narrow it. Treat AHP types as **emit guarantees** for the AHP server, not as **input validation** for log parsing. [CITED: JSON-RPC 2.0 spec §4 — id MAY be String, Number, or NULL]

### Pattern 5: Append-only columnar `EventStore`

```ts
// packages/core/src/event-store.ts
import type { AhpEvent, EventKind, Direction } from '@ahp-viewer/shared';

export type Status = 'ok' | 'error' | 'pending' | 'unmatched' | 'orphan' | 'n/a';

export class EventStore {
  // Columns (parallel arrays — cache-friendly scans)
  readonly seq:     number[] = [];
  readonly ts:      number[] = [];
  readonly kind:    EventKind[] = [];
  readonly dir:     Direction[] = [];
  readonly method:  (string | null)[] = [];
  readonly idStr:   (string | null)[] = [];   // String(id) for hashing; preserves null
  readonly session: (string | null)[] = [];
  readonly turn:    (string | null)[] = [];
  // Derived (filled by Correlator on append)
  readonly pairIdx: (number | null)[] = [];
  readonly latency: (number | null)[] = [];
  readonly status:  Status[] = [];
  // Heavy fields (kept off the hot path for filtering)
  readonly raw:     unknown[] = [];
  readonly events:  AhpEvent[] = [];          // for detail pane

  // Side indices (Phase 2 will use; keep API surface here)
  readonly bySession = new Map<string, number[]>();
  readonly byTurn    = new Map<string, number[]>();
  readonly byMethod  = new Map<string, number[]>();

  append(ev: AhpEvent): number { /* push to all columns; return idx */ }
  size(): number { return this.seq.length; }
  at(idx: number): AhpEvent { return this.events[idx]; }
  /** Subscribe to "appended N events" notifications (rAF-coalesced in P2). */
  subscribe(fn: (range: { from: number; to: number }) => void): () => void { /* … */ }
}
```

**Phase 1 explicitly does NOT add:** Web Worker boundary (Phase 2+ if measured), Orama search index (Phase 3), filter compiler (Phase 3). Keep `EventStore` minimal — every column added now is a column the Correlator must populate and tests must cover.

### Pattern 6: Host adapter / Host client interfaces

Two related interfaces with one shared message union. The split is deliberate: `HostAdapter` is the I/O surface the **server** sees; `HostClient` is the transport surface the **UI** sees. Both consume/emit the same `HostMessage` union, so SSE today and `postMessage` tomorrow are wire formats over identical semantics.

```ts
// packages/shared/src/host-protocol.ts

export type HostMessage =
  | { type: 'open';        path: string }                       // UI → host
  | { type: 'close';       path: string }                       // UI → host
  | { type: 'discover' }                                        // UI → host (Phase 4)
  | { type: 'opened';      path: string; size: number }         // host → UI
  | { type: 'chunk';       path: string; bytes: Uint8Array }    // host → UI (binary; SSE-encoded as base64)
  | { type: 'discovered';  candidates: LogCandidate[] }         // host → UI
  | { type: 'error';       path?: string; message: string };

export interface LogHandle {
  readonly path: string;
  readonly size: number;
}

export interface LogCandidate {
  readonly path: string;
  readonly mtime: number;
  readonly size: number;
}

export interface Disposable { dispose(): void }

/** Implemented by host-node (P1) and later host-vscode (P6). */
export interface HostAdapter {
  discoverLogs(): Promise<LogCandidate[]>;
  openLog(path: string): Promise<LogHandle>;
  watchLog(handle: LogHandle, onChunk: (bytes: Uint8Array) => void): Disposable;
  close(handle: LogHandle): Promise<void>;
}

/** Implemented by HttpHostClient (P2) and later VsCodeHostClient (P6). */
export interface HostClient {
  send(msg: HostMessage): void;
  on(handler: (msg: HostMessage) => void): Disposable;
  close(): void;
}
```

**Phase 1 implements `HostAdapter` only** (in `host-node`). `HostClient` and the `HttpHostClient` over SSE arrive in Phase 2. The interface lives in `shared` now so the UI never invents its own.

### Anti-Patterns (forbidden by lint or convention from Day 1)

- **`packages/ui/**` importing `fs`, `node:*`, `chokidar`, `events`** — breaks webview portability. Lint via Biome `noRestrictedImports`.
- **`packages/core/**` importing React, DOM types** — breaks worker portability.
- **`window.fetch` / `localStorage` / hardcoded `http://localhost:5173`** in the UI — breaks webview. Use `HostClient.send` and `Host.readSettings`/`writeSettings` only. (Settings API not implemented in P1; reserved.)
- **A single-file `events.filter(...)` over the whole array** — establishes the C1 antipattern even in Phase 1 unit tests. Always go through `EventStore` indices.
- **Splitting the event for `action` notifications into both an envelope row and an unwrapped action row** — fan-out breaks the `seq` ↔ line invariant. Choose one (recommendation above: collapse to `kind: 'action'`).

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform file watching | `fs.watch` wrapper | `chokidar` 5.x | macOS double-fire, Windows atomic-replace, NFS — all solved in chokidar |
| CLI argument parsing | Manual `process.argv` slicing | `commander` 14 | Helps version, help text, subcommands later |
| AHP method enums | Hand-typed string union | Re-export from `../agent-host-protocol` | Drift is silent and expensive |
| AHP action types | Hand-typed enum | Re-export `ActionType` from AHP | 40+ values; will grow |
| AHP protocol notification types | Hand-typed enum | Re-export `NotificationType` from AHP | 4 today, will grow |
| JSONL line splitting | `text.split('\n')` | Custom `LineSplitter` (Pattern 2) | Partial trailing line, BOM, CRLF handled in 30 lines |
| JSON parsing | `stream-json` / `clarinet` | `JSON.parse` per line | Per-line isolation already gives malformed-line tolerance; no streaming-JSON tax |

**Key insight:** Phase 1's "don't hand-roll" list is short because most of the core (event model, store, correlator) **must** be hand-built — there is no library that knows about AHP's bidirectional id space or the action-envelope structure. The discipline is the opposite: don't reach for a library to substitute for a 30-line domain-specific function.

---

## Common Pitfalls

### Pitfall 1: Treating AHP `IJsonRpcRequest.id` (typed as `number`) as a runtime guarantee
**What goes wrong:** Parser uses `request.id as number`; a string id in a real log triggers a runtime crash or silent NaN.
**Root cause:** AHP TypeScript types describe what *valid AHP servers emit*. Logs may include malformed or older traffic.
**Avoid:** In `parseLine`/`normalize`, treat `id` as `unknown`; coerce to `number | string | null`; reject anything else as parse-error.
**Detect:** Fixture line with `"id": "abc-123"` and another with `"id": null` and another with `"id": true` (latter must produce parse-error event).

### Pitfall 2: Correlation key collisions from the request/response direction asymmetry
**What goes wrong:** Code stores requests under `dir`, looks up responses under `dir` — but a c2s *request* arrives `dir='c2s'` and its s2c *response* arrives `dir='s2c'`. Naive same-direction lookup fails 100%.
**Root cause:** The *request* defines the id-space; the response carries the opposite wire direction.
**Avoid:** Use `correlationKeyForResponse` which inverts `dir` before keying. Documented in Pattern 4.
**Detect:** Fixture: `{"jsonrpc":"2.0","id":1,"method":"listSessions"}` (c2s) followed by `{"jsonrpc":"2.0","id":1,"result":{...}}` (s2c). Test asserts `pairIdx[1] === 0` and `latency[1] > 0`.

### Pitfall 3: Lifting `sessionId` from `raw.params` inconsistently
**What goes wrong:** Some methods take `params.session: URI`, some take `params.session.uri`, some have no session at all (`initialize`, `listSessions`). Inconsistent extraction means session grouping is partial and silently wrong.
**Root cause:** AHP method param shapes vary.
**Avoid:** Single `extractSessionId(method, params): string | null` table-driven function in `normalizer.ts`, sourced from `ICommandMap` types. For methods with no session, return `null` deliberately. Update the table when AHP adds methods.
**Detect:** Test enumerates every method in `ICommandMap` and asserts `extractSessionId` returns the expected null/string. Failing key reveals new AHP methods.

### Pitfall 4: BOM eaten on every chunk instead of file-start only
**What goes wrong:** `LineSplitter.push` strips BOM at start of every chunk; an actual U+FEFF *inside* a JSON string (rare but legal) gets corrupted.
**Avoid:** `bomConsumed` flag, set once per splitter instance (Pattern 2 above).
**Detect:** Fixture: chunk1 = `\uFEFF{"a":1}\n`, chunk2 = `{"b":"\uFEFF"}\n` — assert second BOM survives.

### Pitfall 5: Storing `raw` strings instead of objects
**What goes wrong:** `EventStore.raw` is `string[]`; every detail-pane open re-parses; large logs balloon memory with duplicated UTF-16 buffers.
**Avoid:** Store the parsed object (`unknown`). Detail pane stringifies on demand. Lossless because `tsRaw` + `byteOffset/byteLength` allow round-trip to source if needed.

### Pitfall 6: Legacy adapter "leaking" upward
**What goes wrong:** Convenience methods on the legacy adapter (`isDispatch()`, `getOriginalMarker()`) end up imported by `core` or `ui`; deleting the adapter later requires touching every consumer.
**Avoid:** Legacy adapter exports exactly one function: `parseLegacyLine(text, byteOffset, byteLength) → AhpEvent | ParseError`. Nothing else. Add a Biome `noRestrictedImports` rule forbidding `packages/parser/src/legacy` outside `packages/parser/src/legacy.test.ts` and a single fixture-loading test helper.

### Pitfall 7: Discoverable port / `0.0.0.0` binding
**What goes wrong:** Server skeleton later binds `0.0.0.0`; another machine on the LAN browses to it, leaks log content.
**Avoid:** Lock `127.0.0.1` in the CLI scaffold today, even though the server is empty. Add an integration test that fails if the bind address changes.

---

## Runtime State Inventory

> Phase 1 is greenfield — there is no prior codebase, no stored state, no live services to migrate. This section is included to make that explicit so the planner knows nothing was missed.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | None — repo is empty apart from `.planning/`. | None. |
| Live service config | None. | None. |
| OS-registered state | None — no installed CLI yet. | None. |
| Secrets / env vars | None expected; `host-node` reads file paths only, no auth. | None. |
| Build artifacts | None — first build. | None. |

---

## Code Examples

### Normalizer discriminant (verified against AHP types)

```ts
// packages/parser/src/normalizer.ts
import type {
  IProtocolMessage,
  IActionEnvelope,
  IProtocolNotification,
} from '@ahp-viewer/shared/ahp';
import type { AhpEvent, EventKind, Direction, IdType } from '@ahp-viewer/shared';

export function normalize(
  raw: unknown,
  meta: { dir: Direction; ts: number; tsRaw: string; seq: number; byteOffset: number; byteLength: number },
): AhpEvent {
  // Defensive: the wire is untrusted even if AHP types narrow.
  if (typeof raw !== 'object' || raw === null) {
    return makeParseErrorEvent(meta, 'non-object payload');
  }
  const m = raw as Record<string, unknown>;

  const hasMethod = typeof m.method === 'string';
  const hasId = 'id' in m;
  const hasResult = 'result' in m;
  const hasError = 'error' in m;

  let kind: EventKind;
  let actionType: string | null = null;
  let serverSeq: number | null = null;

  if (hasMethod && hasId) {
    kind = 'request';
  } else if (hasId && (hasResult || hasError)) {
    kind = 'response';
  } else if (hasMethod /* notification: no id */) {
    if (m.method === 'action' && meta.dir === 's2c') {
      // s2c notification with IActionEnvelope params → unwrap to canonical 'action'
      const env = (m.params ?? {}) as Partial<IActionEnvelope>;
      kind = 'action';
      actionType = (env.action as { type?: string } | undefined)?.type ?? null;
      serverSeq = typeof env.serverSeq === 'number' ? env.serverSeq : null;
    } else if (m.method === 'notification' && meta.dir === 's2c') {
      // s2c notification with { notification: IProtocolNotification }
      const params = (m.params ?? {}) as { notification?: IProtocolNotification };
      kind = 'protocol-notification';
      actionType = params.notification?.type ?? null;
    } else {
      kind = meta.dir === 'c2s' ? 'client-notification' : 'server-notification';
    }
  } else {
    return makeParseErrorEvent(meta, 'unrecognised JSON-RPC shape');
  }

  const id = hasId ? coerceId(m.id) : null;
  const idType: IdType = id === null ? 'null' : (typeof id as 'number' | 'string');
  const sessionId = extractSessionId(m);  // table-driven, see Pitfall 3
  const turnId = extractTurnId(m);
  const toolCallId = extractToolCallId(m);
  const method = typeof m.method === 'string' ? m.method : null;

  return {
    seq: meta.seq, ts: meta.ts, tsRaw: meta.tsRaw, dir: meta.dir, kind,
    method, actionType, id, idType,
    sessionId, turnId, toolCallId, serverSeq,
    byteOffset: meta.byteOffset, byteLength: meta.byteLength,
    raw, parse: 'ok',
  };
}

function coerceId(v: unknown): number | string | null {
  if (typeof v === 'number' || typeof v === 'string' || v === null) return v;
  return null; // booleans/objects/etc → treat as null id; will be flagged unmatched
}
```

[Source: synthesised from `../agent-host-protocol/types/messages.ts`, `actions.ts`, `notifications.ts` — VERIFIED by file inspection 2026-05-06]

### Legacy adapter sketch

The current sample log `~/agenthost.2a22cea9-b08d-4287-83ca-fe6817470628.log` (16,221 lines, sample inspected for *shape only* — no payload content copied) uses these distinct headers [VERIFIED: shell `awk` over file]:

```
[ISO-8601] >> dispatch          (c2s notification → dispatchAction)
[ISO-8601] >> listSessions      (c2s request)
[ISO-8601] >> authenticate      (c2s request)
[ISO-8601] << listSessions      (s2c response)
[ISO-8601] << authenticate      (s2c response)
[ISO-8601] !! listSessions      (server-side error?)
[ISO-8601] ** rootState.onDidChange   (s2c action)
[ISO-8601] ** onDidAction              (s2c action wrapper)
[ISO-8601] ** onDidNotification        (s2c protocol notification)
```

Each header line is followed by an indented JSON block until the next header. The legacy adapter must:

1. Read line-pairs into header + payload-block.
2. Map markers: `>>` → `c2s`, `<<` → `s2c`, `!!` → `s2c` error, `**` → `s2c` action/notification.
3. Synthesize an `id` for `>>` requests by scanning the payload block (or use `null` and mark unmatched).
4. Emit canonical `AhpEvent` — never expose its quirks to `core`.

```ts
// packages/parser/src/legacy.ts
const HEADER_RE = /^\[(?<ts>[^\]]+)]\s+(?<marker>>>|<<|!!|\*\*)\s+(?<label>\S+)/;

export function parseLegacyBlock(headerLine: string, payloadBlock: string, meta: BlockMeta): AhpEvent {
  const h = HEADER_RE.exec(headerLine);
  if (!h?.groups) return makeParseErrorEvent({ ...meta, tsRaw: headerLine }, 'unrecognised header');
  // ... build envelope, then call normalize() with synthesized JSON-RPC shape
}
```

### CLI scaffold (Phase 1 acceptance shape)

```ts
// packages/cli/src/index.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { NodeHostAdapter } from '@ahp-viewer/host-node';

const program = new Command()
  .name('ahp-viewer')
  .version('0.1.0')
  .argument('[file]', 'AHP log file path')
  .option('--port <n>', 'local server port', '5173')
  .action(async (file: string | undefined, opts: { port: string }) => {
    const host = new NodeHostAdapter();
    if (file) {
      const handle = await host.openLog(file);
      console.log(`[ahp-viewer] opened ${handle.path} (${handle.size} bytes)`);
      // Phase 2 will boot the Hono server here. Today we exit cleanly.
    } else {
      console.log('[ahp-viewer] no file specified; UI not yet wired (Phase 2)');
    }
  });

program.parse();
```

The CLI MUST run end-to-end (`pnpm exec ahp-viewer ./test/fixtures/tiny.jsonl`) and print the opened-log line. That is FOUND-01's Phase 1 demo.

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.watch` direct | `chokidar` | ~2018 onwards | Cross-platform reliability; default for log tools |
| ESLint + Prettier | Biome (single binary) | 2024+ | 10× faster, one config |
| Per-package npm | pnpm workspaces | 2020+ | Strict dependency isolation |
| Hand-typed JSON-RPC | Generated from schema | n/a here — AHP ships TS types | Use them directly |
| `react-window` | `@tanstack/react-virtual` (P2) | 2023+ | Dynamic-height rows |

**Deprecated/outdated:**
- `Moment.js` — use `date-fns` (P3+) or `Intl.DateTimeFormat`.
- `request` / `node-fetch` for outbound — irrelevant; we make zero outbound calls.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | TypeScript 6.x is production-ready as of 2026-05-06 | Standard Stack | Use 5.6+ instead; safer until ecosystem catches up |
| A2 | Node 22 LTS is the right runtime target | Standard Stack | Node 24 may be LTS by execution time — verify |
| A3 | pnpm 9+ is current major | Standard Stack | pnpm 10 may exist — `npm view pnpm version` to confirm before pinning |
| A4 | The legacy log uses indented JSON blocks following each header line | Code Examples / Legacy adapter | Adapter logic needs adjustment if blocks are single-line or use a different separator. Verify by line-count diff between header lines and total lines in the sample. |
| A5 | AHP `params` always carries `session` as a top-level URI string when present | Pitfall 3 | Some methods may nest it deeper (e.g. `params.input.session`); table-driven extraction is the mitigation, not the assumption. |
| A6 | `IJsonRpcRequest.id` typed as `number` in AHP is an emit guarantee, not an input contract | Pitfall 1 | If AHP intends strict number-only, the parser is more lenient than the spec requires — that is intentional and safe. |
| A7 | The Phase 1 CLI is allowed to ship without the server (server is Phase 2) | Phase Requirements / FOUND-01 | If FOUND-01 demands the *web app* runs in Phase 1, scope expands — re-read ROADMAP success criterion 1 ("boots the local app shell"). Recommendation: ship a Hono "hello world" route in Phase 1 to satisfy "boots the local app shell" without UI. |
| A8 | Biome 2.x's `noRestrictedImports` supports per-package config | Anti-Patterns | If not, fall back to a `pretest` Node script that greps imports — equally effective, slightly less ergonomic. |

**A7 is the highest-risk assumption:** the planner must re-read ROADMAP success criterion 1 against the phase scope. The literal reading is "boots the local app shell" — which leans toward Phase 1 having a runnable HTTP server even if it serves no UI. Recommendation: Phase 1 ships a minimal Hono server listening on `127.0.0.1` returning `{ status: 'ok' }` on `GET /health`, **and** the CLI starts it. UI rendering is still Phase 2. This expands Phase 1's stack by `hono` only; trivial cost; satisfies the success criterion unambiguously.

---

## Open Questions (RESOLVED)

1. **Does VS Code currently emit JSONL anywhere, or is the human-readable sample the only available source?**
   - Known: sample is human-readable.
   - Unclear: whether a JSONL emit toggle already exists in VS Code.
   - RESOLVED: Phase 1 designs against the canonical `AhpEvent` envelope drawn from AHP types directly. The legacy adapter is the bridge until JSONL emission lands. No external dependency on VS Code's emit timeline.

2. **Should `sessionId`/`turnId` be lifted at the wire level (envelope) or extracted from `raw.params` by the Normalizer?**
   - Known: extracting from `raw.params` is always possible.
   - Unclear: whether VS Code's eventual JSONL will lift them.
   - RESOLVED: Normalizer extracts from `raw.params`; if VS Code later lifts these fields to the envelope, the Normalizer prefers envelope values and falls back to params extraction. Either shape only changes the Normalizer.

3. **Tool-call id extraction — is `toolCallId` a stable field across all action types, or does it live under `params.action.toolCallId` only for `session/toolCall*` actions?**
   - RESOLVED: Treat tool call IDs as action-specific. The extractor uses `params.toolCallId ?? params.toolCall?.id ?? params.action?.toolCallId`, and Phase 2 can expand the action-type enumeration table if UI grouping needs finer taxonomy.

4. **Phase 1 server scope** — see Assumption A7. Planner must lock.
   - RESOLVED: Adopt Assumption A7. Phase 1 ships a minimal Hono health server bound to `127.0.0.1` with `GET /health` returning `{ status: 'ok' }`; UI rendering remains Phase 2.

5. **Are there enough distinct legacy headers in the sample to round-trip every JSON-RPC kind via the legacy adapter, or does the legacy adapter only cover a subset?**
   - RESOLVED: Synthetic legacy fixtures cover `>>`, `<<`, `!!`, and `**` markers for request, response, error-response, action, protocol notification, and log/root-state entries. Implementation must not depend on the real sample log payloads.

---

## Environment Availability

Phase 1 is local TypeScript only — no external services or runtimes beyond Node + pnpm. The viewer's binary is the only artifact.

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js 22 LTS | All packages | Assumed (developer machine) | — | Document `.nvmrc` and `engines` field |
| pnpm 9+ | Workspace install | Assumed | — | npm workspaces (lower isolation; not recommended) |
| `../agent-host-protocol` sibling repo | `packages/shared/src/ahp` re-exports | ✅ verified at `/Users/roblou/code/agent-host-protocol` (`package.json` → name `agent-host-protocol`, version 1.0.0) | 1.0.0 | If the sibling is missing, build fails immediately — this is desired (FOUND-03 demands it). |
| Sample log fixture | `legacy.ts` integration test (read-only) | ✅ at `~/agenthost.2a22cea9-b08d-4287-83ca-fe6817470628.log` | 16,221 lines | Without it, ship a synthetic legacy fixture; do **not** copy the sample log into the repo. |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — the sibling AHP repo is intentionally a hard requirement.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 [VERIFIED: npm view] |
| Config file | `vitest.config.ts` at repo root + per-package `vitest.config.ts` if needed (Wave 0) |
| Quick run command | `pnpm vitest run --changed` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|--------------|
| FOUND-01 | CLI runs and prints opened-log line for `tiny.jsonl` | smoke (subprocess) | `pnpm vitest run packages/cli/cli.smoke.test.ts` | ❌ Wave 0 |
| FOUND-02 | `packages/shared` imports do not include `node:*`, `fs`, `chokidar`, `react` | unit (AST scan) | `pnpm vitest run test/boundary.test.ts` | ❌ Wave 0 |
| FOUND-02 | `packages/core` imports do not include Node or DOM | unit (AST scan) | (same file) | ❌ Wave 0 |
| FOUND-03 | `packages/shared/src/ahp/index.ts` re-exports symbols come from `agent-host-protocol` | unit | `pnpm vitest run packages/shared/ahp.reexport.test.ts` | ❌ Wave 0 |
| FOUND-04 | `package.json` contains no telemetry/CDN/network deps; CLI binds 127.0.0.1 only | unit | `pnpm vitest run test/security.test.ts` | ❌ Wave 0 |
| INGEST-07 | Legacy adapter parses each known marker → canonical `AhpEvent` | unit + fixture | `pnpm vitest run packages/parser/legacy.test.ts` | ❌ Wave 0 |
| EVENT-01 | Normalizer fills every required field for each `EventKind` | unit | `pnpm vitest run packages/parser/normalizer.test.ts` | ❌ Wave 0 |
| EVENT-02 | Discrimination: request / response / notification / action / protocol-notification / parse-error | unit | (same file) | ❌ Wave 0 |
| EVENT-03 | Correlation key pairs c2s request with s2c response across overlapping ids | unit | `pnpm vitest run packages/core/correlator.test.ts` | ❌ Wave 0 |
| EVENT-03 | Same numeric id `1` and string id `"1"` do NOT pair (idType discrimination) | unit | (same file) | ❌ Wave 0 |
| EVENT-03 | Bidirectional: c2s `id:1` and s2c `id:1` (server-issued request) do NOT cross-pair | unit | (same file) | ❌ Wave 0 |
| VERIFY-01 | Valid JSONL fixture parses cleanly | fixture | `pnpm vitest run packages/parser/jsonl.test.ts` | ❌ Wave 0 |
| VERIFY-01 | Malformed line emits `parse-error` event without crashing | fixture | (same file) | ❌ Wave 0 |
| VERIFY-01 | Partial trailing line buffered until next chunk | fixture | (same file) | ❌ Wave 0 |
| VERIFY-01 | CRLF line endings handled identically to LF | fixture | (same file) | ❌ Wave 0 |
| VERIFY-01 | UTF-8 BOM at file start consumed; mid-stream BOM preserved | fixture | (same file) | ❌ Wave 0 |
| VERIFY-01 | 5MB single-line payload parses (large-payload smoke) | fixture | `pnpm vitest run packages/parser/large-payload.test.ts` | ❌ Wave 0 |
| VERIFY-01 | Legacy adapter round-trips the sample's distinct headers | fixture | `pnpm vitest run packages/parser/legacy.test.ts` | ❌ Wave 0 |
| VERIFY-04 | Pre-commit fixture scrubber detects `Bearer `, `sk-`, `ghp_`, JWT `eyJ` patterns | unit | `pnpm vitest run test/fixture-scrub.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --changed` (typically <5 s in P1)
- **Per wave merge:** `pnpm vitest run` (full suite — should stay under 10 s in P1)
- **Phase gate:** Full suite + `pnpm exec ahp-viewer ./test/fixtures/tiny.jsonl` smoke + lint (`pnpm biome check .`) all green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Vitest install + `vitest.config.ts` at root
- [ ] `test/fixtures/generate.ts` — synthesizes all fixtures from canonical shapes
- [ ] `test/fixtures/tiny.jsonl` — 5–10 line valid sample
- [ ] `test/fixtures/malformed.jsonl` — known bad lines mixed with good
- [ ] `test/fixtures/crlf.jsonl` — CRLF endings
- [ ] `test/fixtures/bom.jsonl` — leading BOM
- [ ] `test/fixtures/legacy.sample.log` — synthesized legacy block (NOT copied from `~/agenthost.*.log`)
- [ ] `test/boundary.test.ts` — AST scan asserting layer-import rules (FOUND-02)
- [ ] `test/security.test.ts` — `package.json` dependency allow-list, CLI bind-address check (FOUND-04)
- [ ] `test/fixture-scrub.test.ts` — secret pattern detector (VERIFY-04)
- [ ] Biome `noRestrictedImports` per-package configuration

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard control |
|---------------|---------|------------------|
| V1 Architecture | yes | Local-only posture documented; threat model in `SECURITY.md` (deferred to P2) |
| V2 Authentication | no | No user accounts; local-only |
| V3 Session Management | no | No sessions on the viewer side |
| V4 Access Control | partial | CLI must bind `127.0.0.1` only — file system is the access boundary |
| V5 Input Validation | yes | Tolerant parser treats every wire field as untrusted; never `as` cast on `raw` |
| V6 Cryptography | no | No crypto operations in P1 |
| V7 Error Handling | yes | Parser emits `parse-error` events; never crashes the process; no secret leakage in error messages |
| V8 Data Protection | yes | No telemetry; no outbound network; logs may contain tokens — never copy fixtures from real logs |
| V9 Communications | yes | CLI binds `127.0.0.1`; CSP `default-src 'self'` reserved for P2 server |
| V10 Malicious Code | yes | Pre-commit secret scan on fixtures; dependency allow-list |
| V14 Configuration | yes | No `.env` with secrets; no config that enables outbound calls |

### Known Threat Patterns for {TS / Node CLI / local web app}

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Path traversal in `openLog(path)` | Tampering / Info Disclosure | `path.resolve` then verify file exists and is readable; do NOT enforce a chroot in P1 — viewer needs to read user-chosen paths anywhere on disk. Document this. |
| Server bound to `0.0.0.0` accidentally | Info Disclosure | Hard-code `127.0.0.1` in CLI default; integration test asserts bind address |
| Crash on adversarial JSONL line (parse DoS) | DoS | Per-line `try/catch`; tail buffer caps at e.g. 16 MB to prevent OOM via single 100GB unterminated line |
| Secret leakage to console / crash dumps | Info Disclosure | No `console.log` of payload contents; lint rule `no-console` outside CLI startup banner |
| Fixture commit containing real tokens | Info Disclosure | Pre-commit scrubber test (VERIFY-04) |
| Outbound dependency added accidentally (analytics, font CDN) | Info Disclosure | `package.json` dependency allow-list test (FOUND-04) |
| Prototype pollution via `JSON.parse` on hostile payload | Tampering | Use direct property access on `raw`; never `Object.assign({}, parsedRaw)` into a system object |

### Fixture scrubbing

- All committed fixtures are *synthesized* from canonical envelope shapes. None are copied from `~/agenthost.*.log`.
- The pre-commit test (`test/fixture-scrub.test.ts`) scans `test/fixtures/**` for: `Bearer\s`, `sk-[A-Za-z0-9]{20,}`, `ghp_[A-Za-z0-9]{20,}`, `eyJ[A-Za-z0-9_\-]{20,}\.` (JWT prefix), `password\s*[:=]`, `api[_-]?key\s*[:=]`. Any match fails the test.
- The sample log path (`~/agenthost.2a22cea9-b08d-4287-83ca-fe6817470628.log`) is `.gitignore`'d explicitly — even though it lives outside the repo, this prevents an accidental `cp` copy from being committed.

---

## Project Constraints (from copilot-instructions.md)

The repo's `.github/copilot-instructions.md` mandates the following — research findings comply:

- **Standalone first; defer VS Code extension packaging until after v1** — Phase 1 ships only `host-node`; `host-vscode` is Phase 6+. ✓
- **Real JSONL is canonical; human-readable sample is legacy adapter only** — JSONL parser is the main path; `legacy.ts` is isolated and lint-fenced. ✓
- **Core parser, event model, EventStore, correlator, search/filter projections are portable TypeScript with no Node or DOM** — enforced by lint rule + boundary test. ✓
- **Local-only privacy: no telemetry, no CDN assets, no outbound network** — enforced by dependency allow-list + CLI bind-address test. ✓
- **Virtualization, incremental parsing, and JSON-RPC-safe correlation are foundational** — Phase 1 delivers the latter two; virtualization arrives in Phase 2 but the `EventStore` columnar layout is already designed for it. ✓
- **Use `../agent-host-protocol` as source of truth** — `packages/shared/src/ahp` re-exports verbatim; no hand-rolled enums. ✓

---

## Sources

### Primary (HIGH confidence)
- `/Users/roblou/code/agent-host-protocol/types/messages.ts` — `IProtocolMessage`, `IJsonRpcRequest/Response/Notification`, `ICommandMap`, `IClientNotificationMap`, `IServerNotificationMap` [VERIFIED: file inspected]
- `/Users/roblou/code/agent-host-protocol/types/actions.ts` — `IActionEnvelope { action, serverSeq, origin, rejectionReason? }`, `ActionType` enum [VERIFIED: file inspected]
- `/Users/roblou/code/agent-host-protocol/types/notifications.ts` — `IProtocolNotification` union, `NotificationType` enum [VERIFIED: file inspected]
- `/Users/roblou/code/agent-host-protocol/package.json` — name `agent-host-protocol`, version 1.0.0, ESM [VERIFIED: file inspected]
- `~/agenthost.2a22cea9-b08d-4287-83ca-fe6817470628.log` — header markers and line count [VERIFIED: shape-only inspection via `awk`; no payload content read]
- `.planning/research/ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md`, `SUMMARY.md` — project research [HIGH; assumes prior research is current]
- npm registry — package version verifications via `npm view` [VERIFIED: 2026-05-06]

### Secondary (MEDIUM confidence)
- JSON-RPC 2.0 spec §4 (id may be String, Number, or NULL) [CITED]
- VS Code webview / extension messaging conventions [CITED: previous research]

### Tertiary (LOW confidence)
- TypeScript 6.0 production-readiness — npm publishes the version but ecosystem maturity needs verification before adoption (see Assumption A1)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH on selection, MEDIUM on TS major version (TS 6 is too new to recommend without verification)
- Architecture: HIGH — directly traces to verified AHP types and prior project research
- Pitfalls: HIGH on C1/C3/C4 (universal); HIGH on AHP-specific id-type and direction-asymmetry items (verified against `messages.ts`)
- Validation Architecture: HIGH — every requirement maps to a concrete Vitest file
- Security: HIGH on local-only posture; MEDIUM on path-traversal policy (planner must confirm "no chroot" stance)

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (30 days; library versions and AHP types may shift)
