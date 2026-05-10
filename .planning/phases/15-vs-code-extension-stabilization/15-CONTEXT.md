---
phase: 15
phase_name: vs-code-extension-stabilization
milestone: v1.2
created: 2026-05-10
mode: discuss
---

# Phase 15 — VS Code Extension Stabilization

## Domain

Stabilize the VS Code extension webview so the `postMessage` transport actually carries every UI feature it advertises (the EXT-04 contract from Phase 11), eliminate the regression where row-click / search / state-inspector / log-switch fall through to raw HTTP `fetch('/api/...')` and 403 inside the webview, and add structural prevention so this class of regression cannot recur silently.

In scope:

- Convert the five UI components that still import HTTP transport functions directly to use the injected `AhpViewerClient` from `useAhpViewerClient()`.
- Add a `boundary.test.ts` rule that forbids runtime imports from `transport/(http|sse|search|state|sessions)-client.js` anywhere under `packages/ui/src/components/**` (and tests). Type-only imports remain allowed.
- Update affected component tests to mock the injected `AhpViewerClient` (via `<AhpViewerClientProvider>` with a fake) instead of mocking the transport modules directly.
- Verify the extension end-to-end: row click, search, state inspector, log switch, and reconnect all work in the webview.

Out of scope (deferred):

- Cancellation parity between HTTP and webview transports (`AbortSignal` is honored by `http-client` but ignored by `webview-client`). Captured under "Deferred Ideas".
- Phase 11's 7 manual UAT scenarios still flagged in v1.1 deferred-items. Not folded; remain parked.
- Webview runtime detection robustness audit (`isVsCodeWebviewRuntime`).
- Collapsing the standalone `*-client.js` modules into the `AhpViewerClient` interface only.
- Investigating other extension breakages beyond the transport-bypass class. (User did not enumerate other symptoms during discussion.)

## Carried Forward (Locked from Phase 11)

These are decisions from Phase 11 that govern this phase. **Not re-asking.**

- **Direct postMessage bridge** — the extension does NOT spawn the loopback HTTP server (EXT-03). All extension-host ↔ webview traffic goes through `vscode.Webview.postMessage` and `onDidReceiveMessage`, mediated by `ViewerSessionBridge` in `packages/extension/src/viewerSession.ts`.
- **Transport abstraction** — `AhpViewerClient` is the single transport surface for the UI. It is injected via `<AhpViewerClientProvider>` mounted in `packages/ui/src/main.tsx`, which picks `createWebviewAhpViewerClient()` when `acquireVsCodeApi` is present and `createBrowserAhpViewerClient()` otherwise.
- **CSP** — `default-src 'none'`, `connect-src ${cspSource}` only (no outbound), per-load nonce on the single bundled script (T-11-01-02).
- **Trust posture** — webview only sees basenames and opaque `logKey`s, never absolute `fsPath`. Path/id payloads are length-clamped at the bridge.
- **Standalone parity (EXT-06)** — the browser HTTP/SSE transport must continue to work after this refactor. The standalone `npx ahp-inspector` flow is the regression baseline.

## Decisions

### Refactor depth: aggressive (route + boundary-test enforcement)

- Route all five runtime-import components through `useAhpViewerClient()`:
  - `packages/ui/src/components/detail/DetailPanel.tsx` — `fetchEvent`
  - `packages/ui/src/components/detail/StateInspectorPanel.tsx` — `fetchStateAt`
  - `packages/ui/src/components/filters/useSearch.ts` — `searchEvents`
  - `packages/ui/src/components/shell/AppShell.tsx` — `connectLogStream`, `fetchCandidates`, `openSessionByCandidate`, `openSessionByPath`
  - `packages/ui/src/components/timeline/TimelineRegion.tsx` — `connectLogStream` (inside `defaultReconnect`)
- Add a boundary-test rule (in `test/boundary.test.ts` or a new `test/transport-boundary.test.ts`) that scans `packages/ui/src/components/**/*.{ts,tsx}` and fails if any file contains a runtime import from `transport/(http|sse|search|state|sessions)-client(\.js)?`. **Type-only imports** (`import type { ... }`) remain permitted — components legitimately need types like `DetailResponse`, `StateAtSelectedResource`, `ReplayConfidence`.
- The boundary rule applies to **test files too**. Component tests must mock the injected `AhpViewerClient` (e.g. by rendering with a `<AhpViewerClientProvider client={fakeClient}>` wrapper or via `vi.mock` of `transport-context.js`), not the transport modules. Existing test refactor is part of this phase.
- Rationale: the bug existed because Phase 11 trusted convention. The 10–15 line boundary test pays for itself the first time someone adds a new feature and reaches for the wrong import.

### Verification approach

- Standard automated tests: per-package `pnpm test` + `pnpm typecheck` + `pnpm exec biome check` clean.
- The new boundary test must catch a deliberately-reverted import (test-the-test).
- Manual extension verification (since Phase 11 deferred its real-extension UAT): in a Code OSS dev session, install the built extension, open an AHP JSONL, then exercise row-click → detail loads, search → results highlight, state inspector → opens with confidence, log switch → picker swaps the log, and confirm no `Failed to load event: 403` (or any HTTP-style failure) appears in the webview.
- `pnpm -F @ahp-inspector/ui build && pnpm -F @ahp-inspector/extension build` continues to succeed and the bundled `ui-dist` is correctly copied into the extension package.

## Deferred Ideas

- **Cancellation parity** — `http-client.fetchEvent` honors `AbortSignal`; `webview-client.fetchEvent` ignores it (parameter named `_signal`). After this refactor the bug shifts: fast row-clicks in the extension may land stale responses on the wrong selection. Mitigation candidates: extend the `WebviewRequest` protocol with a `cancel` request kind, or guard at the component level with a requestId-vs-current-state check. Capture as a follow-up phase or quick task.
- **Phase 11 deferred manual UAT (7 scenarios)** — left parked per the v1.1 deferred-items table; not folded into Phase 15.
- **Webview runtime detection robustness** — verify `isVsCodeWebviewRuntime()` cannot false-negative under StrictMode double-invoke or in odd `enableScripts` configurations.
- **Collapse standalone clients** — fold `http-client.ts`, `sse-client.ts`, `search-client.ts`, `state-client.ts`, `sessions-client.ts` into the `AhpViewerClient` interface only, with `browser-client.ts` as the sole runtime entry. Current shape is fine for this phase.
- **Extension health audit** — broader sweep for other extension breakages beyond the transport-bypass class. User did not enumerate symptoms beyond the 403; defer until needed.

## Canonical Refs

Downstream agents (researcher, planner, executor) MUST read these:

- `.planning/milestones/v1.1-REQUIREMENTS.md` — EXT-01..EXT-07 contract definitions (esp. EXT-04 "shared transport contract" and EXT-06 "standalone continues to work").
- `.planning/milestones/v1.1-ROADMAP.md` (lines 138–152) — Phase 11 plan summaries describing what the postMessage bridge was supposed to deliver.
- `packages/ui/src/transport/client.ts` — the `AhpViewerClient` interface (the locked contract).
- `packages/ui/src/transport/transport-context.tsx` — `useAhpViewerClient()` and the provider.
- `packages/ui/src/transport/browser-client.ts` — HTTP/SSE implementation of `AhpViewerClient`.
- `packages/ui/src/transport/webview-client.ts` — postMessage implementation of `AhpViewerClient`.
- `packages/ui/src/main.tsx` — runtime selection between browser and webview clients.
- `packages/extension/src/viewerSession.ts` — `ViewerSessionBridge` (the extension-host counterpart).
- `packages/extension/src/extension.ts` — webview panel creation and message wiring.
- `test/boundary.test.ts` — current boundary rules; the new transport-boundary rule lives here or in a sibling file using the same pattern.
- `packages/ui/src/components/detail/DetailPanel.test.tsx` — reference for the existing transport-mock pattern that needs to migrate.

## Code Context

Components currently bypassing the injected client (runtime imports of `*-client.js`):

| File | Bypassing call | Used in |
|------|----------------|---------|
| `packages/ui/src/components/detail/DetailPanel.tsx:22` | `fetchEvent(idx, signal, logKey)` | Row click → 403 in webview (the visible bug). |
| `packages/ui/src/components/detail/StateInspectorPanel.tsx:3` | `fetchStateAt(idx, opts)` | "State at this point" action in detail panel. |
| `packages/ui/src/components/filters/useSearch.ts:3` | `searchEvents(q, signal)` | Debounced search effect mounted in `AppShell`. |
| `packages/ui/src/components/shell/AppShell.tsx:6,11` | `fetchCandidates`, `openSessionByCandidate`, `openSessionByPath`, `connectLogStream` | Switch-log picker + post-open stream replacement. |
| `packages/ui/src/components/timeline/TimelineRegion.tsx:13,37` | `connectLogStream()` | `defaultReconnect()` after disconnect banner. |

Initial connect happens to work in the extension because `App.tsx` already routes through the injected client — that is why timeline rows render. The bypassing imports only manifest after the user interacts (click row, type query, open state inspector, switch log, reconnect).

Type-only imports (allowed under the new rule):

- `StateSummaryView.tsx`, `PinnedStatePanel.test.tsx`, `state-pins.ts`, `StateResourceSelector.tsx`, `StateCopyMenu.tsx`, `state-compare.ts`, `StateConfidenceBadge.tsx`, `StateCopyMenu.test.tsx` — all `import type { ... } from "../../transport/state-client.js"`.
- `DetailPanel.test.tsx` — `import type { DetailResponse } from "../../transport/http-client.js"` is fine; the runtime `import { fetchEvent } from ...` is what the boundary rule must reject (along with the test's existing `vi.mock("../../transport/http-client.js")`).

## Next Steps

`/clear` then:

`/gsd-plan-phase 15`

The planner will break this into wave-able tasks (boundary test first as TDD gate, then component-by-component routing, then test refactor, then extension manual verification).
