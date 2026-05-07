---
phase: 2
slug: vertical-slice-cli-server-timeline
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-07
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for the CLI → local server → SSE → virtualized timeline vertical slice.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + React Testing Library 16.3.2 + jsdom 29.1.1 |
| **Config file** | `vitest.config.ts`; `packages/ui/vitest.config.ts` for jsdom UI tests |
| **Quick run command** | `pnpm vitest run --changed` |
| **Full suite command** | `pnpm vitest run && pnpm -F @ahp-viewer/ui build && pnpm -F @ahp-viewer/cli build && pnpm typecheck && pnpm lint` |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --changed`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd-verify-work`:** Run `pnpm vitest run && pnpm -F @ahp-viewer/ui build && pnpm -F @ahp-viewer/cli build && pnpm typecheck && pnpm lint`
- **Max feedback latency:** quick changed-file Vitest feedback between task commits

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-00-01 | 00 | 0 | FOUND-02 / FOUND-04 | T-02-01 | UI may import React while portable packages still cannot import UI/Node/host modules | structural | `pnpm vitest run test/boundary.test.ts` | ✅ | ⬜ pending |
| 02-00-02 | 00 | 0 | FOUND-04 | T-02-02 | New UI/runtime dependencies remain allow-listed and local-only | structural | `pnpm vitest run test/security.test.ts` | ✅ | ⬜ pending |
| 02-00-03 | 00 | 0 | TIME-01 / TIME-06 | — | UI package has jsdom test setup and no CDN dependency path | structural | `pnpm vitest run packages/ui/src/components/states/*.test.tsx` | ❌ W0 | ⬜ pending |
| 02-00-04 | 00 | 0 | EVENT-04 / EVENT-05 / TIME-02 / TIME-03 | — | `EventRow` projection exposes row fields, status, latency, and visual-state flags | unit | `pnpm vitest run packages/core/src/row-projection.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-01 | 01 | 1 | INGEST-01 / EVENT-04 | T-02-03 | SSE emits snapshot chunks, append frames, and late-correlation patch frames without exposing absolute paths | integration | `pnpm vitest run test/sse-integration.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | FOUND-04 | T-02-04 | Server responses include CSP and reject invalid Host headers | integration | `pnpm vitest run test/csp.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | TIME-01 / TIME-06 | — | UI foundations + shell chrome (tokens/store/HeaderBar/SourceStrip/StatusBar/DetailRailPlaceholder) wired through Zustand; StatusBar copy verbatim for all four connection states | component | `pnpm vitest run packages/ui/src/components/shell packages/ui/src/styles packages/ui/src/state` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | TIME-02 / TIME-03 | — | Six timeline cells (DirectionGlyph/KindTag/ActionDot/StatusCell/LatencyCell/PayloadPreview) render per UI-SPEC §5 with only design-token colors | component | `pnpm vitest run packages/ui/src/components/timeline/cells` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | TIME-01 / TIME-02 / TIME-03 / TIME-06 / EVENT-05 / INGEST-06 | — | Five screen-level states render UI-SPEC §10 verbatim; virtualized 50K-row TimelineList renders ≤ ~50 DOM rows; EventRow exposes 11 columns; ParseErrorRow shows BAD-line copy; TimelineRegion routes states + keyboard nav; App.tsx routes no-server | component | `pnpm vitest run packages/ui/src/components/states packages/ui/src/components/timeline` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 2 | INGEST-01 | T-02-05 | CLI validates file path and port, prints UI-SPEC copy, and never opens a remote URL | integration | `pnpm vitest run packages/cli/src/cli-launch.test.ts packages/cli/src/cli-errors.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 3 | INGEST-01 / INGEST-06 / EVENT-04 / EVENT-05 / TIME-01 / TIME-02 / TIME-03 / TIME-06 | T-02-01..T-02-05 | Browser UI receives SSE data from fixture log and renders timeline/state contract end-to-end | integration | `pnpm vitest run test/vertical-slice.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/boundary.test.ts` — split portable-package import rules from browser-UI import rules so `packages/ui/src` can import React/Vite while portable packages remain Node/DOM/UI-free.
- [ ] `test/security.test.ts` — extend the dependency allow-list with Phase 2 packages only: `react`, `react-dom`, `@vitejs/plugin-react`, `vite`, `@tanstack/react-virtual`, `zustand`, `lucide-react`, `tailwindcss`, `@tailwindcss/vite`, `open`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.
- [ ] `test/csp.test.ts` — assert CSP response header and Host-header rejection behavior.
- [ ] `test/sse-integration.test.ts` — assert snapshot, append, patch, ping, and bye SSE frame behavior from a fixture JSONL log.
- [ ] `test/vertical-slice.test.ts` — boots server + UI against a synthetic fixture and verifies first timeline render.
- [ ] `packages/ui/package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html` — UI package skeleton.
- [ ] `packages/ui/src/test-setup.ts` — React Testing Library setup with `@testing-library/jest-dom`.
- [ ] `packages/ui/public/fonts/inter/` and `packages/ui/public/fonts/jetbrains-mono/` — vendored `.woff2` fonts and license files; no CDN references.
- [ ] `packages/core/src/row-projection.test.ts` — contract tests for required row fields and visual-state derivation.
- [ ] `packages/server/src/app-state.ts`, `sse-routes.ts`, `csp.ts` test scaffolds — server integration seam.
- [ ] `packages/cli/src/cli-launch.test.ts`, `cli-errors.test.ts` — CLI integration/error-copy tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-browser perceived smoothness on a large log | TIME-01 | jsdom verifies virtualization DOM count but not actual paint/scroll feel | Run `pnpm exec ahp-viewer test/fixtures/large.jsonl`, open the browser, scroll the timeline, and confirm the UI stays responsive. Capture screenshots for USER_GUIDE updates if a guide exists. |

---

## Threat Model

| Ref | Threat | Mitigation | Verification |
|-----|--------|------------|--------------|
| T-02-01 | Browser UI imports leak into portable packages and break future VS Code/webview portability | Boundary tests split UI-specific allowances from portable-package restrictions | `pnpm vitest run test/boundary.test.ts` |
| T-02-02 | New dependencies add telemetry, CDN, or analytics paths | Explicit dependency allow-list and vendored fonts only | `pnpm vitest run test/security.test.ts`; `rg -n "https?://|fonts.googleapis|cdn" packages/ui` returns no runtime asset references |
| T-02-03 | Absolute log paths leak into browser/SSE payloads | Server sends basename-only `LogMeta`; absolute path is terminal-only | `pnpm vitest run test/sse-integration.test.ts` asserts payload excludes the fixture directory |
| T-02-04 | DNS rebinding or cross-origin page reads local server data | Host-header allow-list, CSP `default-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'` | `pnpm vitest run test/csp.test.ts` |
| T-02-05 | Invalid CLI input starts an unintended server or opens a remote URL | Validate path readability and `--port` range before server start; browser open only uses generated `http://127.0.0.1:{port}` | `pnpm vitest run packages/cli/src/cli-errors.test.ts packages/cli/src/cli-launch.test.ts` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency controlled by `pnpm vitest run --changed`
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-07
