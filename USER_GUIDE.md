# AHP Log Viewer User Guide

## Open a JSONL log

Run the viewer from the repository root with a JSONL file path:

```bash
pnpm exec tsx packages/cli/src/index.ts path/to/log.jsonl
```

For a built CLI smoke test, build first and run:

```bash
pnpm -F @ahp-viewer/ui build
pnpm -F @ahp-viewer/cli build
node packages/cli/dist/index.js path/to/log.jsonl
```

The CLI prints a loopback URL, opens the browser by default, and serves the UI locally from `127.0.0.1`.

## Read the timeline

The main timeline is a dense, virtualized grid. Each row shows timestamp, direction, kind, method/action type, session, turn, status, latency, key ID, and a short payload preview. Direction arrows (`→`/`←`), kind tags (`REQ`, `RES`, `ACT`, `BAD`), status pills, and row rails help scan traffic quickly.

![Large timeline](screenshots/phase2-uat-fixed-large.png)

Large logs stay virtualized; a 50,000-line synthetic JSONL log renders only the visible rows while scrolling.

![Scrolled large timeline](screenshots/phase2-uat-fixed-scrolled.png)

## Screen states

If the browser UI is open without the local API server, it shows the CLI command hint.

![No server state](screenshots/phase2-uat-no-server-fixed.png)

An empty JSONL file renders an informative empty state.

![Empty log state](screenshots/phase2-uat-empty-state.png)

If every line fails to parse, the viewer shows a no-valid-events banner and parse-error rows.

![Parse error state](screenshots/phase2-uat-parse-errors.png)

If the log stream disconnects after data has loaded, the viewer keeps the last rows visible and shows a retry banner.

![Disconnected state](screenshots/phase2-uat-fixed-disconnected.png)

## Current limitations

Phase 2 provides the vertical slice: CLI launch, local server, SSE stream, virtualized timeline, and state handling. Event detail expansion, search, filters, grouping, live discovery, and full light/dark/hacker theme switching are planned for later phases.
