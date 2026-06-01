---
phase: 28-open-raw-response-in-a-new-browser-tab-as-plain-text-or-json
plan: 01
verified: 2026-05-31T21:06:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
---

# Phase 28 · Plan 01 — Verification Report

**Phase Goal:** From the detail-pane actions menu, the user can open the selected
event's raw payload in a new browser tab as pretty-printed JSON
(`application/json`) or plain text (`text/plain`), backed by a same-origin Blob
URL only (no network/CDN), preserving local-first privacy.
**Requirement:** UX-DETAIL-OPEN-RAW-TAB
**Verified:** 2026-05-31T21:06:00Z
**Status:** ✅ PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Detail-pane menu offers "Open in new tab (JSON)" and "Open in new tab (text)" | ✓ VERIFIED | `CopyMenu.tsx` renders both items in the `role="menu"` list as `role="menuitem"` buttons; tests select both by accessible name (`/open in new tab \(json\)/i`, `/open in new tab \(text\)/i`) |
| 2 | JSON action opens an `application/json` Blob URL of the pretty-printed raw payload | ✓ VERIFIED | `handleOpenInNewTab("application/json")` → `openInNewTab(text, mime)`; test asserts `blobs[0].type === "application/json"` and `await blobs[0].text() === JSON.stringify(rawData, null, 2)` |
| 3 | Text action opens a `text/plain` Blob URL of the pretty-printed raw payload | ✓ VERIFIED | Test asserts `blobs[0].type === "text/plain"` and content equals `JSON.stringify(rawData, null, 2)` |
| 4 | Same-origin Blob URL only — no network/CDN/outbound dependency | ✓ VERIFIED | `openInNewTab.ts` uses only `new Blob(...)` + `URL.createObjectURL` + `window.open`; grep for `fetch\|XMLHttpRequest\|axios\|http\|https\|cdn\|import(` → no matches |
| 5 | Object URL is revoked after the tab loads (no permanent leak) | ✓ VERIFIED | Success path schedules `setTimeout(() => URL.revokeObjectURL(url), 60_000)`; test confirms revoke NOT called immediately, then called after `advanceTimersByTime(60_000)` |
| 6 | Blocked popup (window.open === null) reported via toast, not silent | ✓ VERIFIED | `if (win === null) { revoke; return false }` → caller calls `onCopy("Popup blocked — allow popups to open in a new tab", false)`; test stubs `open` → null and asserts the toast + immediate revoke |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/ui/src/components/detail/openInNewTab.ts` | Blob-URL helper using `createObjectURL` | ✓ VERIFIED | 27 lines, substantive; contains `createObjectURL`, `window.open("...","noopener,noreferrer")`, deferred + immediate revoke; returns `win !== null` |
| `packages/ui/src/components/detail/CopyMenu.tsx` | Two "Open in new tab" menu items wiring `event.raw` | ✓ VERIFIED | Imports `openInNewTab`, defines `handleOpenInNewTab`, renders both items; serializes `JSON.stringify(event.raw, null, 2)` with circular-safe fallback |
| `packages/ui/src/components/detail/CopyMenu.test.tsx` | Tests for MIME, content, window.open, revoke | ✓ VERIFIED | 3 new tests (JSON, text, blocked-popup) plus existing 5; all 8 pass |
| `screenshots/phase28/open-in-new-tab-menu.png` | Visual evidence (fixture data) | ✓ PRESENT | File exists; SUMMARY states captured against `test/fixtures/long-realistic-ahp.jsonl` (fixture-only per repo policy) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `CopyMenu.tsx` | `openInNewTab.ts` | `handleOpenInNewTab` → `openInNewTab(text, mime)` | ✓ WIRED | `import { openInNewTab } from "./openInNewTab.js"`; called in `handleOpenInNewTab`; both menu-item `onClick` handlers invoke it with the correct MIME |
| menu item | `onCopy` toast | success/blocked feedback | ✓ WIRED | `onCopy("Opened in new tab", true)` / `onCopy("Popup blocked …", false)`; DetailPanel passes `onCopy` to toast (no DetailPanel change required) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| CopyMenu open-in-tab | `event.raw` | Selected `AhpEvent` prop from DetailPanel | Yes — serialized live via `JSON.stringify(event.raw, null, 2)` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| CopyMenu unit tests | `vitest run src/components/detail/CopyMenu.test.tsx` | 8 passed | ✓ PASS |
| Detail folder regression | `vitest run src/components/detail/` | 9 files, 71 passed | ✓ PASS |
| TypeScript diagnostics | get_errors on 3 changed files | No errors | ✓ PASS |
| No-network guarantee | grep `fetch\|XHR\|axios\|http\|cdn\|import(` in `openInNewTab.ts` | No matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| UX-DETAIL-OPEN-RAW-TAB | 28-01-PLAN | Open raw payload in new tab as JSON/text via same-origin Blob URL | ✓ SATISFIED | All 6 must-haves verified; helper + menu items + passing tests |

### Anti-Patterns Found

None. No TODO/FIXME/placeholder, no `dangerouslySetInnerHTML`, no `#hex` literals, no `return null` stubs in the changed code paths. The `[Circular or non-serializable value]` string is an intentional serialization fallback, not a stub.

### Local-First Privacy Assessment

✅ Confirmed. The opened tab is backed exclusively by an `object:`/`blob:` URL produced by `URL.createObjectURL(new Blob(...))` — a same-origin, in-memory resource. There is no `fetch`, `XMLHttpRequest`, CDN reference, or dynamic `import()` in `openInNewTab.ts`. `window.open` uses `"noopener,noreferrer"`, mitigating reverse-tabnabbing (threat T-28-02). Content never leaves the machine; the guarantee holds.

### Gaps Summary

No gaps. All six plan must-haves are verified against the actual code, all four key-link/wiring checks pass, both required test suites are green (8 + 71 tests), TypeScript is clean, and the no-network/local-first guarantee is confirmed by code inspection. The phase goal is achieved.

---

_Verified: 2026-05-31T21:06:00Z_
_Verifier: the agent (gsd-verifier)_
_Model: Claude Sonnet 4.5_
