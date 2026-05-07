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

## Choose a theme

Use the compact theme picker in the header to switch between **Dark**, **Light**, and **Hacker**. The selection is saved in the browser and applies to the timeline, filters, detail panel, and Pretty JSON syntax colors.

![Hacker theme with column labels](screenshots/phase3-hacker-theme-columns.png)

## Read the timeline

The main timeline is a dense, virtualized grid with fixed column labels. Each row shows timestamp, direction, kind, method/action type, session, turn, status, latency, key ID, and a short payload preview. Direction arrows (`→`/`←`), kind tags (`REQ`, `RES`, `ACT`, `BAD`), status pills, and row rails help scan traffic quickly.

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

Phase 2 provides the vertical slice: CLI launch, local server, SSE stream, virtualized timeline, and state handling. Live discovery and tail-mode are planned for later phases.

## Searching events

The search bar (top of the filter bar) performs an instant full-text substring search across every event's method name, session ID, turn ID, key ID, and payload preview. Search is case-insensitive. Results are highlighted in the timeline.

- Press **`/`** from anywhere to focus the search input.
- Press **`Esc`** to clear the search query (press again to clear active filters, then again to deselect the current row).
- Results are capped at **5,000 matches** to keep scrolling smooth on large logs. A "truncated" indicator appears when the cap is reached.

![Search with active chips](screenshots/phase3-active-chips.png)

![No results from search](screenshots/phase3-no-results-search.png)

## Filtering events

Click any of the **8 facet chips** in the filter bar to open a popover with the distinct values for that facet and their counts:

| Chip | Filters by |
|------|-----------|
| **Dir** | Direction (`c2s` / `s2c`) |
| **Kind** | Event kind (`request` / `response` / `action` / `protocol-notification`) |
| **Method** | RPC method name |
| **Action** | Action type family |
| **Session** | Session ID, shortened into a readable label when possible |
| **Turn** | Turn ID (last 6 chars shown) |
| **Status** | Correlation status (`ok` / `error` / `timeout` / pending) |
| **Time** | Time range (from / to) |

Selecting a value within a popover adds an **active chip** below the filter bar. Multiple values within the same facet are OR-combined; values across different facets are AND-combined.

- Click **✕** on an individual chip to remove that filter.
- Click **Clear all** to reset all active chips and the search query.

![Filter bar with all facets](screenshots/phase3-filter-bar.png)

![No results from filters](screenshots/phase3-no-results-filters.png)

## Grouping by session / turn

Use the **Group: None** toggle (right end of the filter bar) to restructure the timeline into logical groups:

| Mode | Effect |
|------|--------|
| **None** | Flat chronological order (default) |
| **Session** | One group header per session; shows a readable session label, event count, and duration |
| **Session + Turn** | Nested sub-headers per turn inside each session |

Group headers are visual-only rows — keyboard navigation (Up/Down/Home/End) moves through event rows only, skipping headers.

![Timeline grouped by session with gap banner visible](screenshots/phase3-grouped-story.png)

### Gap banners

When the `serverSeq` field advances by more than 1 between consecutive events in the same session, a **gap banner** is inserted above the next event. The banner shows the missing range so you can tell at a glance that events were dropped or lost.

![Server sequence gap banner](screenshots/phase3-gap-banner.png)

## Inspecting event details

Click any row in the timeline to open the **detail panel** on the right.

### Summary strip

The top of the panel shows the core AHP fields in a structured strip with colored type stripes:
- Session ID, Turn ID, Key/Request ID
- Direction, kind, and RPC method
- Correlation status and latency
- Error code (highlighted in destructive color if present)
- Authentication failure banner (🔒) when the response carries error code `-32007`

![Detail panel Pretty view](screenshots/phase3-detail-pretty.png)

![Detail panel with auth failure banner and error code](screenshots/phase3-detail-auth-banner.png)

### Pretty vs Raw tab

- **Pretty** — expandable JSON tree rendered by react-json-view-lite. Click a node label or its +/- marker to collapse or expand it. Payloads larger than 256 KB show a truncation warning.
- **Raw** — monospace `<pre>` block containing the full raw JSON for copy-paste.

![Detail panel Raw JSON view](screenshots/phase3-detail-raw.png)

### Copy menu

The **Copy ▾** button opens a menu with three options:

| Option | Copies |
|--------|--------|
| Copy raw JSON | The full `raw` payload as JSON |
| Copy pretty JSON | Human-formatted (2-space indent) JSON |
| Copy summary | The Summary strip fields as plain text |

A brief **"Copied N chars"** toast appears at the bottom-right to confirm the clipboard write.

**Privacy note:** The raw payload may contain tokens, prompts, or file paths. The copy menu shows a reminder; keep this in mind when pasting into logs or tickets.

![Copy menu with toast](screenshots/phase3-detail-copy-toast.png)

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus the search input |
| `↑` / `↓` | Move selection up / down one visible row |
| `Page Up` / `Page Down` | Jump 10 rows |
| `Home` / `End` | Jump to first / last visible row |
| `Esc` | Clear search → clear filters → deselect row (in sequence) |

![/ key focuses the search input](screenshots/phase3-keyboard.png)
