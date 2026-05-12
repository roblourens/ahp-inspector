---
phase: 17
phase_name: add-drag-and-drop-support-for-opening-jsonl-files
date: 2026-05-11
mode: discuss
---

# Phase 17 — Discussion Log

Raw record of the discuss-phase exchange. Authoritative output is `17-CONTEXT.md`.

## Pre-context loaded

- `PROJECT.md`, `REQUIREMENTS.md`, `STATE.md`
- Recent CONTEXTs scanned: 11, 13, 14, 15.
- No spike/sketch findings packaged.
- No `.continue-here.md`, no SPEC.md, no DISCUSS-CHECKPOINT.json.

## Codebase scout

- `ManualOpenInput.tsx` — paste-a-path UI; calls `onOpen(path)` → `sessions.open({path})`.
- `LogPickerPanel.tsx` — owns `onOpenPath`.
- `AppShell.tsx:114` — `onToggleSwitchLog` orchestration site; root for new overlay.
- Server: `POST /api/sessions/open` accepts `{path}` (or `{id}`); error responses **never** echo the user-typed path (T-04-03-02).
- Host adapter: `openLog(path)` validates regular file + readable.
- No existing `dragover`/`drop`/`DataTransfer` handling anywhere in the workspace.

## Gray areas presented

| # | Area | Why it matters |
|---|------|----------------|
| 1 | **Surface scope** | Standalone vs VS Code webview have completely different path-acquisition mechanics. |
| 2 | **Path strategy** | Browser File API hides absolute paths; need a real path to reuse the tail-by-path pipeline. |
| 3 | **Drop zone** | Whole-window vs picker-only changes z-index, accessibility, and "switch log" UX. |
| 4 | **Multi-file** | Single-active-log model has to decide what to do with extra files. |

## Q&A

**Q1 — Where should drag-and-drop work?**
Options: Both surfaces (recommended) / Standalone only / Extension only.
**A:** Standalone web only.
*Note:* User narrowed scope from the recommended "both" — extension webview drop deferred to a later phase. Captured as deferred idea.

**Q2 — Standalone path strategy?**
Options: `text/uri-list` first, friendly error / uri-list then native picker / Upload content (virtual log).
**A:** `text/uri-list` first, friendly error otherwise.
*Note:* No native picker fallback, no new server endpoint. If the drop carries no `file://` URI, surface `ManualOpenInput` as the recovery path.

**Q3 — Where on screen should accept the drop?**
Options: Whole window (no log) + picker / Whole window always / Picker only.
**A:** Whole window always.
*Note:* Drops over an active log silently replace it (same posture as picking a different candidate).

**Q4 — Multi-file or folder drop?**
Options: First .jsonl wins / Reject / Open first, queue others.
**A:** First .jsonl wins, ignore the rest with a brief toast.

## Scope creep / deferred

None raised by user. Things explicitly punted by the agent's analysis:

- VS Code extension webview drag-and-drop (separate phase).
- Native file picker as a fallback (separate UX surface).
- Upload-by-content / virtual log (server change).
- Multi-file session history (single-active-log model preserved).
- Folder drops.

## Outcome

CONTEXT.md captures four decisions (D1–D5):

- D1 standalone web only
- D2 `text/uri-list` first, friendly error otherwise (no picker, no upload)
- D3 whole-window overlay always armed
- D4 first `.jsonl` wins
- D5 reuse `onOpenPath` / `sessions.open`; no new transport or server route

ROADMAP.md goal updated from `[To be planned]` to a concrete one-liner reflecting D1–D5.
