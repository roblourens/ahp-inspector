---
phase: "03-detail-search-and-filtering"
plan: "04"
subsystem: "ui/detail"
tags: ["detail-panel", "http-client", "react", "lru-cache", "accessibility"]
dependency_graph:
  requires: ["03-01", "03-02"]
  provides: ["DETAIL-01", "DETAIL-02", "DETAIL-03", "DETAIL-04"]
  affects: ["packages/ui/src/components/detail/", "packages/ui/src/transport/http-client.ts"]
tech_stack:
  added: ["react-json-view-lite"]
  patterns: ["LRU-16 cache", "AbortController per-fetch", "exactOptionalPropertyTypes-safe conditional spreads"]
key_files:
  created:
    - packages/ui/src/transport/http-client.ts
    - packages/ui/src/components/detail/DetailPanel.tsx
    - packages/ui/src/components/detail/DetailSummary.tsx
    - packages/ui/src/components/detail/AhpFieldStrip.tsx
    - packages/ui/src/components/detail/AhpFieldRow.tsx
    - packages/ui/src/components/detail/DetailTabs.tsx
    - packages/ui/src/components/detail/PrettyJsonView.tsx
    - packages/ui/src/components/detail/RawJsonView.tsx
    - packages/ui/src/components/detail/CopyMenu.tsx
    - packages/ui/src/components/detail/CopyToast.tsx
    - packages/ui/src/components/detail/TruncationBanner.tsx
    - packages/ui/src/components/detail/AuthFailureBanner.tsx
    - packages/ui/src/components/detail/PrivacyCaption.tsx
    - packages/ui/src/components/detail/DetailResizeHandle.tsx
    - packages/ui/src/components/detail/index.ts
    - packages/ui/src/components/detail/DetailPanel.test.tsx
    - packages/ui/src/components/detail/DetailSummary.fields.test.tsx
  modified: []
decisions:
  - "fetchEvent uses conditional `init` object for AbortSignal (exactOptionalPropertyTypes: fetch signal must be AbortSignal|null, not undefined)"
  - "AhpFieldStrip uses conditional spread `...(annotation !== undefined ? { annotation } : {})` pattern for optional props — required by exactOptionalPropertyTypes"
  - "PrettyJsonView casts data as `object` for JsonView (react-json-view-lite types require Object|any[], not unknown)"
  - "Tests populate store rows[] for populated-state tests — DetailPanel reads rows[selectedIdx] to get EventRow for AhpFieldStrip"
metrics:
  duration: "~15min"
  completed: "2026-05-07T18:36:59Z"
  tasks_completed: 3
  files_created: 17
---

# Phase 03 Plan 04: Detail Panel UI — Summary

**One-liner:** Full detail panel with 16-entry LRU fetchEvent, AHP field strip (9 colored rows), Pretty/Raw JSON tabs, clipboard copy menu, resize handle, and all 4 panel states.

---

## What Was Built

### Task 1: http-client + DetailPanel + AhpFieldStrip (TDD)

**`packages/ui/src/transport/http-client.ts`** — Browser-only transport (boundary-safe):
- `fetchEvent(idx, signal?)` with 16-entry LRU cache; `404 → null`, other errors → throw
- AbortController-ready; callers pass signal per-fetch for T-03-04-04 mitigation
- No Node/hono imports (boundary test: 72 tests green)

**`DetailPanel.tsx`** — Orchestrator:
- Reads `selectedIdx` from Zustand; fires `fetchEvent` in `useEffect` with `AbortController` cleanup
- Four states: **empty** (heading "No event selected"), **loading** (Loader2 spinner), **error** (message + Retry button), **populated** (full panel)
- Retry button re-invokes `load(selectedIdx)` on click

**`AhpFieldStrip.tsx`** — 0–9 colored field rows:
- session → `--color-info`, turn → `--color-info`
- toolCall (from `raw.params.toolCall`) → `--action-tool-call`
- actionType (non-NTF) → `--action-text`
- serverSeq → `--color-text-muted` + "gap before" annotation when `gapBefore`
- origin (from `raw.params.origin`) → `--color-text-muted`
- requestId (REQ/RES rows) → `--kind-request`
- errorCode → `--color-destructive` + AHP label (e.g. `-32007 — Authentication required`)
- notificationType (NTF rows) → `--kind-notification`
- Absent fields are completely omitted (variable 0–9 row count)

**`AhpFieldRow.tsx`** — 2px stripe | 96px label | flex value | optional annotation (–color-warning)

**`DetailSummary.tsx`** — 2-line block:
- Line 1: `{tsFmt} · {direction-word} · {kindTag} · {method/actionType/—}` (13px mono)
- Line 2: Status (colored by ok/error/other) · Latency ms or "—" (muted)

### Task 2: Detail tabs, JSON views, and copy menu

**`DetailTabs.tsx`** — `[role="tablist"]` Pretty/Raw; Left/Right arrow key nav; 2px `--color-accent` active border

**`PrettyJsonView.tsx`** — `react-json-view-lite` with 256KB client cap; above cap → `TruncationBanner`; no hex literals

**`RawJsonView.tsx`** — `<pre>{text}</pre>` only; React auto-escapes (T-03-04-01 XSS mitigation); no `dangerouslySetInnerHTML`

**`CopyMenu.tsx`** — Dropdown: "Copy raw JSON" / "Copy pretty JSON" / "Copy summary"; `navigator.clipboard.writeText` with `<textarea>` `execCommand` fallback; calls `onCopy(msg, ok)` for toast

**`CopyToast.tsx`** — 1.5s auto-dismiss toast; success/error coloring via `color-mix`

### Task 3: Detail banners, resize handle, and barrel export

**`TruncationBanner.tsx`** — `color-mix(in srgb, --color-warning 14%, --color-bg)` background; AlertTriangle icon; client-cap / server-cap variants

**`AuthFailureBanner.tsx`** — `--color-auth-fail-banner-bg`; ShieldAlert icon; -32007 vs authRequired body copy

**`PrivacyCaption.tsx`** — T-03-04-03: Info icon + "Copy includes raw payload — may contain tokens, prompts, or paths."

**`DetailResizeHandle.tsx`** — 4px hit area; mouse drag (clientX delta); Left/Right keyboard (16px increments); [360, 720] bounds; `aria-label="Resize detail panel"`

**`index.ts`** — Barrel: `export { DetailPanel } from "./DetailPanel.js"` (AppShell entry point)

---

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm -F @ahp-inspector/ui test src/components/detail/` | ✅ 19/19 tests pass (2 files) |
| `pnpm -F @ahp-inspector/ui build` | ✅ 226KB bundle, no errors |
| `pnpm test test/boundary.test.ts` | ✅ 72/72 tests pass |
| `grep -rn '#[0-9a-fA-F]{3,8}' packages/ui/src/components/detail/` | ✅ 0 results |
| `grep -rn 'dangerouslySetInnerHTML\s*=' packages/ui/src/components/detail/` | ✅ 0 results |
| `pnpm -F @ahp-inspector/ui typecheck` | ✅ No errors |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] exactOptionalPropertyTypes TypeScript strict mode violations**
- **Found during:** Typecheck after Task 3
- **Issue:** `signal?: AbortSignal` incompatible with `RequestInit.signal: AbortSignal | null`; optional props passed as `prop={undefined}` fail with `exactOptionalPropertyTypes: true`
- **Fix:** Conditional `init` object for fetch; conditional spread pattern `{...(val !== undefined ? { prop: val } : {})}` throughout
- **Files modified:** `http-client.ts`, `AhpFieldStrip.tsx`, `PrettyJsonView.tsx`, `DetailPanel.tsx`
- **Commit:** c5e4845

**2. [Rule 2 - Missing] Test store population for populated-state DetailPanel test**
- **Found during:** Task 1 GREEN phase
- **Issue:** `rows[selectedIdx]` returned undefined in test; DetailPanel only renders AhpFieldStrip when `row !== null`
- **Fix:** Added `makeRow()` factory to `DetailPanel.test.tsx`; tests that need populated state set `rows: [makeRow()]` in store
- **Files modified:** `DetailPanel.test.tsx`
- **Commit:** 8a71f66 (inline during RED→GREEN cycle)

---

## Known Stubs

None. All required DetailPanel states are implemented and tested. AppShell still imports `DetailRailPlaceholder` — that wiring is deferred to Plan 03-05 by design (stated in plan objective).

---

## Threat Surface Scan

No new network endpoints or auth paths introduced. Components consume `GET /api/log/event/:idx` (already registered in Plan 03-01). No new trust boundaries created.

---

## Commits

| Commit | Message |
|--------|---------|
| 8a71f66 | feat(03-04): http-client + DetailPanel orchestrator + AhpFieldStrip |
| 9037c75 | feat(03-04): detail barrel export and full task 3 verification |
| c5e4845 | fix(03-04): exactOptionalPropertyTypes TypeScript fixes |

## Self-Check: PASSED
