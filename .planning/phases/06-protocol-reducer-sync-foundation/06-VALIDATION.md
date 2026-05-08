---
phase: 6
slug: protocol-reducer-sync-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-08
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for protocol sync and reducer parity.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts`, package `tsconfig.json` files |
| **Quick run command** | `pnpm test -- packages/protocol/src` |
| **Full suite command** | `pnpm test && pnpm typecheck && pnpm lint && pnpm -F @ahp-viewer/protocol build` |
| **Estimated runtime** | repo-standard |

## Sampling Rate

- **After every task commit:** Run the most focused package test/build command for the modified package.
- **After every plan wave:** Run `pnpm test` and `pnpm typecheck`.
- **Before `/gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** use focused package commands before full-suite gates.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | SYNC-01 | T-06-01 | Workspace package skeleton and root sync script contract are declared | static/build | `pnpm install --lockfile-only && test -f packages/protocol/package.json` | ✅ | ✅ green |
| 06-01-02 | 01 | 0 | SYNC-01, SYNC-02 | T-06-01, T-06-02, T-06-05 | Sync script reads only sibling protocol source and copies whitelisted protocol files/fixtures | unit/build | `pnpm sync:ahp && test -f packages/protocol/src/reducers.ts` | ✅ | ✅ green |
| 06-01-03 | 01 | 1 | SYNC-02 | T-06-02 | Generated package is populated and builds | build | `pnpm sync:ahp && pnpm -F @ahp-viewer/protocol build` | ✅ | ✅ green |
| 06-02-01 | 02 | 2 | SYNC-04 | T-06-03 | Package manifests and security allow-list use generated protocol package | static/test | `pnpm install --lockfile-only && pnpm test -- test/security.test.ts` | ✅ | ✅ green |
| 06-02-02 | 02 | 2 | SYNC-04 | T-06-03 | Source imports use generated protocol package or intentional compatibility layer | type/test | `pnpm typecheck && pnpm test -- packages/parser/src/normalizer.test.ts packages/shared/src/ahp.reexport.test.ts` | ✅ | ✅ green |
| 06-03-01 | 03 | 3 | VERIFY-01 | T-06-04 | Reducer fixture parity passes deterministically with `Date.now()` mocked to `9999` | unit | `pnpm test -- packages/protocol/src/reducers.test.ts` | ✅ | ✅ green |
| 06-03-02 | 03 | 3 | SYNC-03, VERIFY-01 | T-06-02, T-06-05 | Source commit diagnostics and fixture privacy are test-visible | unit | `pnpm test -- packages/protocol/src/source-info.test.ts packages/protocol/src/fixture-privacy.test.ts` | ✅ | ✅ green |
| 06-03-03 | 03 | 3 | SYNC-03, SYNC-04, VERIFY-01 | T-06-02, T-06-03, T-06-04, T-06-05 | Focused and full Phase 6 validation passes | full gate | `pnpm sync:ahp && pnpm test -- packages/protocol/src && pnpm -F @ahp-viewer/protocol build && pnpm test && pnpm typecheck && pnpm lint` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [ ] `packages/protocol/src/source-info.ts` — generated source commit metadata.
- [ ] `packages/protocol/src/reducers.test.ts` or equivalent — reducer fixture parity harness.
- [ ] `packages/protocol/test-cases/reducers/*.json` — synced upstream reducer fixtures.
- [ ] `scripts/sync-agent-host-protocol.ts` — deterministic sync command.

## Manual-Only Verifications

All Phase 6 behaviors should have automated verification. Manual review is limited to confirming generated files are clearly marked and do not include real log data.

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency controlled through focused package commands
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-08
