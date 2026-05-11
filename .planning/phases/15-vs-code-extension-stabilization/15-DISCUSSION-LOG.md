---
phase: 15
created: 2026-05-10
mode: discuss
---

# Phase 15 — Discussion Log

## Area: Refactor depth for transport routing

**Question:** Refactor depth for transport routing?

**Options presented:**
- (a) Minimal: route 5 components only — trust convention going forward.
- (b) Aggressive: route + boundary-test enforcement — add a boundary-test rule banning runtime `*-client.js` imports from `components/**`. Type-only imports still allowed. **[recommended]**
- (c) Maximalist: route + boundary + collapse standalone clients — fold the 5 `*-client.js` modules into the `AhpViewerClient` interface only.

**Selected:** (b) Aggressive: route + boundary-test enforcement.

**Rationale:** The bug existed because Phase 11 trusted convention. A small boundary test (~10–15 lines) pays for itself the first time someone adds a new feature and reaches for the wrong import. Collapsing the standalone clients (option c) is a bigger refactor whose payoff doesn't justify being part of a stabilization phase.

---

**Follow-up question:** Should the boundary rule apply to test files too?

**Options presented:**
- Tests exempt — tests can mock/import transport modules directly (current pattern stays). Boundary rule applies only to non-test files.
- Tests also forbidden — tests must use the injected client; mock `AhpViewerClient` via a fake passed through `TransportContext`. Bigger churn but uniform. **[recommended]**
- Tests exempt for now — apply rule to non-test files; defer test refactor to a future cleanup phase.

**Selected:** Tests also forbidden (mock the client instead).

**Rationale:** Uniformity. Component tests should exercise the same surface the components actually use in production — the injected `AhpViewerClient`. Mocking the transport module directly was always a leaky test seam; this is a chance to fix it while everything is being touched anyway.

## Areas Not Discussed (User Skipped)

The user was offered six gray areas and selected only #1. The following were not discussed and inherit defaults:

- **#2 Cancellation parity** — Default: keep current behavior (`webview-client` ignores `AbortSignal`). Captured as deferred idea.
- **#3 Test strategy / extension-host integration test** — Default: standard per-package tests + manual webview verification only. No new bridge integration test in this phase.
- **#4 Phase 11 deferred manual UAT** — Default: leave parked, not folded.
- **#5 Webview runtime detection robustness** — Default: trust the existing `isVsCodeWebviewRuntime()` check. Captured as deferred idea.
- **#6 Other extension breakages** — Default: scope Phase 15 to the transport-bypass class only. User did not enumerate other symptoms beyond the 403.

## Deferred Ideas

- Cancellation parity between HTTP and webview transports.
- Phase 11's 7 manual UAT scenarios remaining open from v1.1.
- `isVsCodeWebviewRuntime()` robustness audit.
- Collapsing standalone `*-client.js` modules into `AhpViewerClient` only.
- Broader extension health audit beyond the transport-bypass class.
