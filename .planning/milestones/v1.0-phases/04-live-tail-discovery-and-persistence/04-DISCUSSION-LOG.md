# Phase 4: Live Tail, Discovery, and Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 04-live-tail-discovery-and-persistence
**Areas discussed:** Discovery and manual open, Active log session lifecycle, Live tail behavior, Pause/resume and reading context, Persistence, UI shape

---

## Autonomous routing note

`/gsd-progress` found Phase 3 complete and Phase 4 unstarted with no context or plans. The user was unavailable at the next-step prompt and requested autonomous progress, so this discussion used the recommended Route B default and auto-selected the safest builder defaults for all Phase 4 gray areas. These choices should be reviewed before planning if the user wants different product behavior.

---

## Discovery and manual open

| Option | Description | Selected |
|--------|-------------|----------|
| No-file CLI launches picker | Let the app start without a file and show discovery/manual-open UI | ✓ |
| Keep CLI file required | Preserve current CLI behavior and add discovery later | |
| Browser upload | Use browser file input/upload semantics | |

**User's choice:** Auto-selected no-file CLI launches picker.
**Notes:** This directly satisfies the roadmap's "discover likely logs" and "manual open" success criteria while preserving current direct-open as a convenience path.

---

## Active log session lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Add server-side log session/catalog manager | Server can have no active log, switch logs, and keep real paths server-side | ✓ |
| Keep one AppState per server process | Simpler but cannot support in-app discovery/open without restart | |
| Move all log handling into browser | Conflicts with local filesystem watching and future host adapter boundary | |

**User's choice:** Auto-selected server-side log session/catalog manager.
**Notes:** Existing `startLogServer` takes a fixed `AppState`; Phase 4 needs a layer above it so the app can launch before a log is selected.

---

## Live tail behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse TailReader + append/patch SSE | Build on existing initial-read and appended-byte pipeline | ✓ |
| Replace stream transport | Higher risk and duplicates working Phase 2/3 behavior | |
| Poll whole file repeatedly | Simpler conceptually but violates large-log responsiveness goals | |

**User's choice:** Auto-selected reuse TailReader + append/patch SSE.
**Notes:** Planning should harden truncation/rotation/errors and keep partial trailing JSONL buffering, not replace the core ingest path.

---

## Pause/resume and reading context

| Option | Description | Selected |
|--------|-------------|----------|
| Pause live-follow/read position only | Continue ingesting, preserve scroll/selection, show "N new events" | ✓ |
| Stop server-side parser/watch | Saves some work but risks missing or delaying traffic semantics | |
| Disable pause until later | Fails Phase 4 success criteria | |

**User's choice:** Auto-selected pause live-follow/read position only.
**Notes:** This matches typical log viewer behavior: pause protects the reader from jumps, not the system from receiving data.

---

## Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| LocalStorage keyed by sanitized server log key | Persist per-log UI state without exposing absolute paths as normal UI metadata | ✓ |
| Store raw path directly in browser keys | Easier but conflicts with prior path-privacy posture | |
| No persistence until later | Fails Phase 4 success criteria | |

**User's choice:** Auto-selected sanitized per-log key.
**Notes:** Persist search, filters, grouping, collapsed groups, selected row when valid, detail width, and live-follow state as convenience state only.

---

## UI shape

| Option | Description | Selected |
|--------|-------------|----------|
| Integrated polished picker | Use existing shell visual language, newest-first list, origin/confidence badges, safe labels | ✓ |
| Raw file table | Dense but less polished and harder to scan | |
| Modal-only picker | Possible later, but less natural for the no-active-log launch state | |

**User's choice:** Auto-selected integrated polished picker.
**Notes:** Empty states should distinguish "server not running", "server running but no log selected", and "no discovered logs found."

---

## the agent's Discretion

- Exact candidate confidence scoring.
- Exact origin/badge copy.
- Discovery refresh cadence.
- Hash algorithm for stable sanitized log keys.
- Final placement of pause/resume controls.

## Deferred Ideas

- Full VS Code extension packaging.
- Advanced analytics or new visualization modes beyond live/discovery/persistence.
