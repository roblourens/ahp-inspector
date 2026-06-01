---
phase: 28-open-raw-response-in-a-new-browser-tab-as-plain-text-or-json
plan: 01
type: execute
status: COMPLETE
requirements: [UX-DETAIL-OPEN-RAW-TAB]
files_modified:
  - packages/ui/src/components/detail/openInNewTab.ts
  - packages/ui/src/components/detail/CopyMenu.tsx
  - packages/ui/src/components/detail/CopyMenu.test.tsx
commit: TBD
---

# Phase 28 · Plan 01 — Summary

## Objective

Let the user open the selected event's raw payload in a new browser tab — as
pretty-printed JSON (`application/json`) or plain text (`text/plain`) — from the
detail-pane actions menu, so large payloads can be inspected with the browser's
own find/scroll/JSON rendering.

## Changes

- **packages/ui/src/components/detail/openInNewTab.ts** (new) — helper
  `openInNewTab(text, mime)` that builds a `Blob`, creates a same-origin
  `URL.createObjectURL` object URL, opens it via
  `window.open(url, "_blank", "noopener,noreferrer")`, and schedules
  `URL.revokeObjectURL` after 60s so the tab can load first. Returns `false`
  (and revokes immediately) when the popup is blocked. No network, no CDN — the
  content never leaves the machine.
- **packages/ui/src/components/detail/CopyMenu.tsx** — added two menu items,
  "Open in new tab (JSON)" and "Open in new tab (text)", below the existing copy
  actions. Each serializes the selected `event.raw` with
  `JSON.stringify(raw, null, 2)` and calls `openInNewTab` with the matching MIME
  type, surfacing "Opened in new tab" or "Popup blocked …" through the existing
  `onCopy` toast. No DetailPanel change required.
- **packages/ui/src/components/detail/CopyMenu.test.tsx** — added a test group
  covering both actions (Blob MIME type, pretty-printed content via
  `await blob.text()`, `window.open` args), deferred URL revocation, and the
  popup-blocked path. Added `vi.unstubAllGlobals()` to `afterEach`.

`DetailPanel.tsx`, `PrettyJsonView`, `RawJsonView`, and the JSON_STYLES mapping
were left unchanged.

## Verification

- `pnpm -F @ahp-inspector/ui exec vitest run src/components/detail/CopyMenu.test.tsx`
  — 8 tests pass (3 new open-in-tab tests).
- `pnpm -F @ahp-inspector/ui exec vitest run src/components/detail/` — 9 files,
  71 tests pass, no regressions.
- TypeScript: no errors in the three changed files.
- Visual: rebuilt the UI and opened an event against
  `test/fixtures/long-realistic-ahp.jsonl`. The actions menu shows both
  "Open in new tab (JSON)" and "Open in new tab (text)". Evidence:
  `screenshots/phase28/open-in-new-tab-menu.png` (fixture data only).

## Must-Haves

- ✅ Menu offers "Open in new tab (JSON)" and "Open in new tab (text)".
- ✅ JSON action opens an `application/json` Blob URL of the pretty payload.
- ✅ Text action opens a `text/plain` Blob URL of the pretty payload.
- ✅ Same-origin Blob URL only — no network/CDN/outbound dependency.
- ✅ Object URL is revoked after a load delay (no permanent leak).
- ✅ Blocked popups are reported via the toast instead of failing silently.

## Threat Model

- T-28-01 (Information disclosure — raw payload in a new tab) — explicit user
  action at the same trust level as copy; content stays in a same-origin Blob URL
  with no network egress; PrivacyCaption discloses payload sensitivity. **Accepted.**
- T-28-02 (Reverse-tabnabbing via `window.open`) — mitigated with
  `"noopener,noreferrer"`; the opened Blob URL has no opener back-reference.
