---
phase: 11
slug: vs-code-extension-command-palette-custom-editor
status: backfilled
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
backfilled: true
backfill_note: "Retroactively created during v1.1 milestone audit; phase already executed and verified."
---

# Phase 11 — Validation Strategy

> Per-phase Nyquist validation contract for the VS Code extension command-palette + webview.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` (root + `packages/extension`) |
| **Quick run command** | `pnpm test -- packages/extension` |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm lint && pnpm build` |
| **Estimated runtime** | repo-standard |

## Sampling Rate

- After every task commit: focused package test for the modified package.
- After every plan wave: `pnpm test` and `pnpm typecheck`.
- Before `/gsd-verify-work`: full suite green.
- Boundary + security gates run as part of `pnpm test`.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | EXT-01, EXT-05 | T-11-01-03 | Command registration narrow; no shell exec or arbitrary URL open | unit | `pnpm test -- packages/extension/src/extension.test.ts` | ✅ | ✅ green |
| 11-01-02 | 01 | 1 | EXT-02 | T-11-01-01 | Active-editor path stays in extension host; only logKey/basename crosses to webview | unit | `pnpm test -- packages/extension/src/activeLog.test.ts` | ✅ | ✅ green |
| 11-01-03 | 01 | 1 | EXT-05 | T-11-01-02 | CSP webview HTML uses nonce + `webview.asWebviewUri`; no unescaped path interpolation | unit | `pnpm test -- test/security.test.ts` | ✅ | ✅ green |
| 11-02-01 | 02 | 2 | EXT-03, EXT-04 | T-11-02-01 | Typed transport contract; no untyped `unknown` past boundary | type/unit | `pnpm typecheck && pnpm test -- packages/ui/src/transport` | ✅ | ✅ green |
| 11-02-02 | 02 | 2 | EXT-04 | T-11-02-02 | UI-visible metadata is logKey/basename only | unit | `pnpm test -- test/boundary.test.ts` | ✅ | ✅ green |
| 11-02-03 | 02 | 2 | EXT-06 | T-11-02-03 | Stream replacement preserves `close()`; no duplicate listeners | unit/build | `pnpm test && pnpm -F @ahp-inspector/cli build` | ✅ | ✅ green |
| 11-03-01 | 03 | 3 | EXT-03, EXT-04 | T-11-03-01, T-11-03-02 | Discriminated message protocol; unknown kinds ignored; payload validation | unit | `pnpm test -- packages/extension/src/viewerSession.test.ts` | ✅ | ✅ green |
| 11-03-02 | 03 | 3 | EXT-04 | T-11-03-03 | Absolute paths remain extension-host-local in stream responses | unit | `pnpm test -- packages/extension/src/viewerSession.test.ts` | ✅ | ✅ green |
| 11-03-03 | 03 | 3 | EXT-04 | T-11-03-04 | Disposal removes listeners and bounds pending requests | unit | `pnpm test -- packages/ui/src/transport` | ✅ | ✅ green |
| 11-04-01 | 04 | 4 | EXT-05, EXT-07 | T-11-04-02 | Command contribution + activation tested so manifest drift breaks tests | unit | `pnpm test -- packages/extension/src/extension.test.ts` | ✅ | ✅ green |
| 11-04-02 | 04 | 4 | EXT-07 | T-11-04-03 | Boundary gates forbid `vscode`/`@ahp-inspector/extension` imports in portable packages | unit | `pnpm test -- test/boundary.test.ts` | ✅ | ✅ green |
| 11-04-03 | 04 | 4 | EXT-05, EXT-07 | T-11-04-01, T-11-04-03 | CSP and no-loopback gates + docs | unit | `pnpm test -- test/security.test.ts` | ✅ | ✅ green |
| 11-04-04 | 04 | 4 | EXT-06 | T-11-04-03 | Standalone CLI/browser viewer continues to build and run | build | `pnpm -F @ahp-inspector/cli build && pnpm test -- packages/cli/src/cli-launch.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [x] `packages/extension/package.json` — manifest with `engines.vscode`, `activationEvents`, `contributes.commands`, `main`.
- [x] `packages/extension/src/extension.ts` — command registration entry point.
- [x] `packages/extension/src/messageProtocol.ts` — typed discriminated postMessage contract.
- [x] `test/boundary.test.ts` — boundary gates against forbidden imports in portable/UI packages.
- [x] `test/security.test.ts` — CSP/no-CDN + no-loopback-server runtime checks.

## Manual-Only Verifications

The seven manual scenarios in `11-UAT.md` (extension host launch, command palette discovery, no listening port, etc.) are operator validations of the same surface that automated tests cover. Manual UAT remains useful before the first real `code --install-extension` rollout but is not a Nyquist gate.

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all baseline references
- [x] No watch-mode flags
- [x] Feedback latency controlled through focused package commands
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** backfilled and approved 2026-05-09 during v1.1 milestone audit.
