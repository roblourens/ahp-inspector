---
phase: 17
phase_name: add-drag-and-drop-support-for-opening-jsonl-files
milestone: v1.2
created: 2026-05-11
mode: discuss
---

# Phase 17 — Add drag-and-drop support for opening JSONL files

## Domain

Let the user open (or switch to) a JSONL log in the **standalone web UI** (`pnpm dlx ahp-inspector ...`) by dragging a file from Finder / VS Code Explorer / a terminal into the browser window. The drop becomes the same operation the existing `LogPickerPanel` → `ManualOpenInput` performs today: a `POST /api/sessions/open { path }` against the server, which then tails the file with the unchanged ingest pipeline.

In scope:

- A drop target that covers the whole window at all times (an overlay that lights up on `dragenter`).
- Recover a real filesystem path from the drop event via `event.dataTransfer.getData('text/uri-list')`, decoding the `file://` URI.
- Wire the recovered path into the existing `onOpenPath`/`sessions.open` flow that `ManualOpenInput` already uses.
- Visual + accessible feedback for `dragenter` / `dragleave` / `drop` / error / success.
- A friendly error path when the drop carries no `text/uri-list` (e.g. dragged from an app that doesn't expose a file URI), pointing the user at the existing `ManualOpenInput`.
- First `.jsonl` wins when multiple files are dropped; ignore the rest with a brief toast/inline note.

Out of scope (deferred):

- VS Code extension webview support. The webview needs a different mechanism (postMessage → extension host → `vscode.workspace.fs` / `showOpenDialog`); design that in its own phase.
- Native file picker fallback on drop. If `text/uri-list` is empty we show a friendly error; we do **not** open `<input type="file">`.
- An "upload file content" path (a new server endpoint that ingests the file body into a virtual log) — would require server changes and lose live-tail semantics.
- Multi-file queueing or session history. Single active log, like today.
- Folder drops. Out of scope; treat any non-`.jsonl` URI as the "no file dropped" case.
- Drag-and-drop into the extension custom editor.

## Decisions

### D1 — Surface scope: standalone web only

- Wire drag-and-drop into the standalone Vite UI (`packages/ui`) only. The VS Code extension webview is intentionally deferred.
- Rationale: in standalone, the browser hands us a `file://` URI via `text/uri-list` — enough to call the existing path-based `sessions.open` endpoint with no server changes. The extension webview cannot get a real `fsPath` from a drop without round-tripping through the extension host (`onDidReceiveMessage` + `vscode.window.showOpenDialog` / workspace URI mapping), which is a separate, larger design.
- Phase 11/15 trust posture is unaffected: paths flow client → server only via the already-audited `POST /api/sessions/open` and never appear in error responses (see `packages/server/src/session-routes.ts:53`).

### D2 — Path acquisition: `text/uri-list` first, friendly error otherwise

- On `drop`, read `event.dataTransfer.getData('text/uri-list')`. Take the first non-empty, non-comment line. If it parses as a `file://` URL, decode it (`decodeURIComponent`) and POST it to `/api/sessions/open { path }`.
- If `text/uri-list` is empty, missing, or carries a non-`file:` URI: show an inline error in the drop overlay along the lines of *"That drop didn't include a file path. Drag from Finder / Explorer / VS Code Explorer, or paste the path below."* and surface the existing `ManualOpenInput` as the recovery action.
- No `<input type="file">` fallback. No new server endpoint. No client-side file-content upload.
- Validate extension is `.jsonl` before posting; otherwise show the same "no file path" error variant scoped to *"Only .jsonl files are supported."*.

### D3 — Drop zone: whole window, always active

- A full-viewport drop overlay armed on `window.dragenter` and disarmed on `dragleave`/`drop`. Visible only while dragging or showing an error/success banner.
- Works in every app state — no log open, log open, picker panel open, picker panel closed.
- Drops over an open log replace the active log with no extra confirmation. Acknowledged behavior; same posture as picking a different candidate from `LogPickerPanel` today.
- Z-index must sit above `LogPickerPanel` and the timeline so drag events aren't swallowed by row hover handlers.
- Accessible affordance: the overlay is `role="region"` with an `aria-live="polite"` status message ("Drop a .jsonl file to open" / error text / "Opened &lt;basename&gt;").

### D4 — Multi-file: first `.jsonl` wins

- If `text/uri-list` includes multiple URIs, take the first one whose decoded path ends in `.jsonl`.
- Show a brief toast/inline note: *"Opened &lt;basename&gt;; ignored N other files."* — no queueing, no session-history side effects.
- If none of the URIs end in `.jsonl`, fall through to the D2 error path.

### D5 — Reuse `onOpenPath`, do not duplicate transport

- The drop handler resolves a path string and calls the same `sessions-client` helper `ManualOpenInput` calls today. No new fetch/SSE code paths in the UI.
- Error mapping reuses `ManualOpenInput`'s existing copy table (`bad-request`, `not-found`, `not-readable`, etc.) so dropped vs pasted opens fail with the same wording.

## Code Context

Reusable assets (no new transport, no new server route needed):

- `packages/ui/src/components/picker/ManualOpenInput.tsx` — paste-a-path UI; `onOpen(path: string): Promise<void>` is the contract the drop handler will call.
- `packages/ui/src/components/picker/LogPickerPanel.tsx` — owns the existing `onOpenPath` prop wired to the sessions client.
- `packages/ui/src/components/shell/AppShell.tsx` (around line 114, `onToggleSwitchLog`) — root component that already orchestrates picker open/close; the new `<DropOverlay>` mounts here.
- `packages/server/src/session-routes.ts` — `POST /api/sessions/open { path }` is unchanged. Same error codes already mapped in `ManualOpenInput`.
- `packages/host-node/src/host-adapter.ts` — `openLog(path)` already validates regular file + readable; that's our path-validation layer.

New components anticipated (planner will confirm):

- `packages/ui/src/components/drop/DropOverlay.tsx` — full-viewport drop region with `dragenter`/`dragleave`/`drop` handlers and visual states.
- `packages/ui/src/components/drop/parseDroppedUri.ts` (or inline) — pure function: `(dataTransfer: DataTransfer) => { path: string; ignoredCount: number } | { error: 'no-uri' | 'not-jsonl' }`.

## Canonical Refs

- `.planning/PROJECT.md` — local-first, no telemetry, no CDN; drag-and-drop must respect that.
- `.planning/REQUIREMENTS.md` — current v1 requirements; phase 17 introduces no new functional req beyond "open a file".
- `packages/server/src/session-routes.ts` — authoritative `POST /api/sessions/open` contract.
- `packages/ui/src/components/picker/ManualOpenInput.tsx` — error-message table the drop handler must mirror.
- `packages/host-node/src/host-adapter.ts` — server-side path validation contract.
- Phase 11 / 15 CONTEXT.md — trust posture (paths leave the client only via the audited POST; never echoed back in errors). Still in force.

No external specs/ADRs referenced.

## Deferred Ideas (noted for later phases)

- **VS Code extension webview drag-and-drop** — needs `acquireVsCodeApi()` postMessage → extension host → workspace path resolver. Separate phase.
- **Native file picker integration** — could be its own UX (toolbar button → OS dialog) independent of drag-and-drop.
- **Upload-by-content / virtual log** — would let the standalone UI accept files without a real path (e.g. browser remote, sandboxed contexts). Requires server "in-memory log" mode.
- **Multi-file session history** — open multiple logs and switch between them.
- **Folder drop** — pick the most recent `.jsonl` under the folder, or list candidates.
