# AHP Inspector

AHP Inspector is a local-first GUI for exploring JSONL logs of Agent Host
Protocol traffic. It turns raw JSON-RPC messages between VS Code and agent
hosts into a fast timeline where search highlights and navigates matching events,
faceted filters narrow rows, and event details are expandable.

![AHP Inspector in hacker theme](screenshots/phase3-hacker-theme-columns.png)

## Highlights

- Dense virtualized timeline for large JSONL logs, including direction, kind,
  method/action type, session, turn, status, latency, IDs, and payload preview.
- Full event detail panel with summary fields, Pretty/Raw JSON tabs, copy menu,
  truncation handling, auth-failure banners, and correlation metadata.
- Payload search with match highlighting/navigation, faceted filtering,
  session/turn grouping, server sequence gap banners, keyboard navigation, and
  no-wrap columns.
- Dark, light, and hacker themes through design tokens.
- Local-only architecture: no telemetry, no CDN assets, loopback server only,
  and a host adapter boundary for future VS Code/webview hosting.

## Quickstart

Open the most recent VS Code Agent Host log in the browser:

```bash
npx ahp-inspector
```

This downloads `ahp-inspector` to npx's cache, starts a local HTTP server on
`127.0.0.1`, opens your default browser, and streams the most-recently-modified
AHP JSONL log it can find under your standard VS Code log roots.

Open a specific file:

```bash
npx ahp-inspector path/to/agent-host.jsonl
```

Flags:

- `--port <n>` — choose a specific port (default: 5173; `0` for ephemeral).
- `--no-open` — start the server but don't auto-open the browser.
- `--no-auto-discover` — skip the auto-open-latest-log step on no-arg launches.

### Auto-discovery rule

When invoked with no path argument, `ahp-inspector`:

1. Scans the standard VS Code log roots (Code, Code - Insiders, OSS dev) up to
   a bounded time/stat budget (~1.5s).
2. Skips empty (0-byte) files.
3. For each candidate (newest mtime first), probes the first line to verify it
   parses as an AHP event.
4. Opens the first match. If none qualify, the browser opens to the discovery
   picker so you can browse manually — no error.

### Privacy posture

`ahp-inspector` is local-only by design:

- Server binds to `127.0.0.1` (loopback only).
- No telemetry, no update checks, no outbound network calls.
- Log files are read locally; nothing is uploaded anywhere.

## Status

This is an active private project. Phases 1-3 are complete: core parsing and
correlation, CLI/server/browser vertical slice, and detail/search/filtering.
Phase 4 is planned next: live tail, VS Code log discovery, manual log selection,
pause/resume, and per-log persistence.

## Prerequisites

- Node.js 22 (`.nvmrc` is included)
- pnpm 9.15
- The sibling `../agent-host-protocol` workspace, which provides canonical AHP
  TypeScript protocol types

## Quick start

```bash
pnpm install
pnpm start
```

The dev script starts a local server bound to `127.0.0.1` on a random available
port, opens the browser, and uses the normal no-argument launch path: it
auto-discovers the latest real AHP log under the standard VS Code log roots, or
opens the discovery picker if none is found.

To smoke-test against checked-in sample data instead:

```bash
pnpm start:long
```

To open your own JSONL log:

```bash
pnpm -F @ahp-inspector/ui build
pnpm exec tsx packages/cli/src/index.ts path/to/log.jsonl
```

For a built CLI smoke test:

```bash
pnpm -F @ahp-inspector/ui build
pnpm -F ahp-inspector build
node packages/cli/dist/index.js path/to/log.jsonl
```

## Expected log format

The primary format is one complete JSON-RPC/AHP message per UTF-8 JSONL line.
Lines should be valid compact JSON, not pretty-printed multi-line objects.
Optional root-level metadata such as `_ahpLog` is allowed, but the protocol
payload should remain the original message shape so the parser can preserve raw
details.

Example:

```jsonl
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1,"clientId":"vscode-window"}}
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1,"serverSeq":0}}
{"jsonrpc":"2.0","method":"action","params":{"session":"copilot:/session/frontend-polish","type":"toolCallContentChanged","serverSeq":42}}
```

## Repository layout

| Path | Purpose |
|------|---------|
| `packages/shared` | Shared protocol/event contracts and AHP type re-exports |
| `packages/parser` | JSONL parser, normalizer, and legacy sample adapter |
| `packages/core` | EventStore, correlator, row projection, and core types |
| `packages/host-node` | Node filesystem host adapter, discovery stub, tail reader |
| `packages/server` | Local Hono server, SSE stream, detail/search endpoints |
| `packages/ui` | React UI, Zustand store, timeline/detail/filter components |
| `packages/cli` | `ahp-inspector` CLI entrypoint |
| `test/fixtures` | Scrubbed JSONL fixtures, including long realistic traffic |
| `.planning` | GSD project roadmap, phase plans, reviews, and state |

## Development commands

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm -F @ahp-inspector/ui build
pnpm -F ahp-inspector build
```

The full local verification gate used during development is:

```bash
pnpm test && pnpm -F @ahp-inspector/ui build && pnpm -F ahp-inspector build && pnpm typecheck && pnpm lint
```

## Privacy and security posture

AHP logs may contain prompts, tokens, file paths, model output, and other
sensitive data. The viewer is designed as local developer tooling:

- server binds to `127.0.0.1`
- host guard rejects non-loopback requests
- UI assets are served locally
- raw logs are not sent to external services
- routine metadata avoids exposing absolute paths

See `SECURITY.md` for reporting guidance.

## User guide

See [USER_GUIDE.md](USER_GUIDE.md) for walkthroughs, screenshots, filtering,
search, detail inspection, keyboard shortcuts, and current limitations.

## License

The published `ahp-inspector` CLI package on npm is MIT-licensed (see
`packages/cli/package.json`). The rest of this repository is currently
unlicensed and is for development of that package.
