---
phase: 01
slug: core-foundations
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-06
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` at repo root |
| **Quick run command** | `pnpm vitest run --changed` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | <10 seconds for Phase 1 suite |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --changed`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd-verify-work`:** Run `pnpm vitest run`, `pnpm biome check .`, and `pnpm exec ahp-viewer ./test/fixtures/tiny.jsonl`
- **Max feedback latency:** 10 seconds for the Phase 1 full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-W0-01 | Wave 0 | 1 | VERIFY-01 | — | Test harness exists before parser/core work | setup | `pnpm vitest run --changed` | ❌ W0 | ⬜ pending |
| 01-W0-02 | Wave 0 | 1 | VERIFY-04 | T-01 | Fixtures are synthetic and scrubbed | unit | `pnpm vitest run test/fixture-scrub.test.ts` | ❌ W0 | ⬜ pending |
| 01-FOUND-01 | TBD | TBD | FOUND-01 | T-02 | CLI binds local app shell to localhost only | smoke | `pnpm vitest run packages/cli/cli.smoke.test.ts` | ❌ W0 | ⬜ pending |
| 01-FOUND-02 | TBD | TBD | FOUND-02 | T-03 | Portable packages cannot import Node, DOM, React, or host-only modules | unit | `pnpm vitest run test/boundary.test.ts` | ❌ W0 | ⬜ pending |
| 01-FOUND-03 | TBD | TBD | FOUND-03 | — | AHP symbols are re-exported from `../agent-host-protocol` | unit | `pnpm vitest run packages/shared/ahp.reexport.test.ts` | ❌ W0 | ⬜ pending |
| 01-FOUND-04 | TBD | TBD | FOUND-04 | T-01 | Dependencies and startup paths do not introduce telemetry, CDN assets, or outbound network calls | unit | `pnpm vitest run test/security.test.ts` | ❌ W0 | ⬜ pending |
| 01-INGEST-07 | TBD | TBD | INGEST-07 | T-04 | Legacy sample adapter emits canonical events without copying real secrets into fixtures | unit | `pnpm vitest run packages/parser/legacy.test.ts` | ❌ W0 | ⬜ pending |
| 01-EVENT-01 | TBD | TBD | EVENT-01 | T-04 | Normalizer fills required canonical fields for every event kind | unit | `pnpm vitest run packages/parser/normalizer.test.ts` | ❌ W0 | ⬜ pending |
| 01-EVENT-02 | TBD | TBD | EVENT-02 | T-04 | Requests, responses, notifications, actions, protocol notifications, logs, and parse errors classify deterministically | unit | `pnpm vitest run packages/parser/normalizer.test.ts` | ❌ W0 | ⬜ pending |
| 01-EVENT-03 | TBD | TBD | EVENT-03 | T-05 | Correlation key preserves session, wire direction, id value, and id type | unit | `pnpm vitest run packages/core/correlator.test.ts` | ❌ W0 | ⬜ pending |
| 01-VERIFY-01 | TBD | TBD | VERIFY-01 | T-04 | Parser handles valid JSONL, malformed lines, partial trailing lines, CRLF, BOM, large payloads, and legacy adapter fixtures | unit/fixture | `pnpm vitest run packages/parser/jsonl.test.ts packages/parser/large-payload.test.ts packages/parser/legacy.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Threat References

| Ref | Threat | Required Mitigation |
|-----|--------|---------------------|
| T-01 | Sensitive log contents leave the machine through telemetry, CDN, analytics, or external requests | No outbound dependencies; dependency allow-list test; CSP/server posture prepared for `default-src 'self'` |
| T-02 | Local server accidentally exposes logs on the LAN | CLI/server binds `127.0.0.1` by default; test asserts bind address |
| T-03 | Future UI/webview portability breaks because core imports Node or DOM APIs | Boundary tests and Biome import restrictions for `packages/shared`, `packages/parser`, and `packages/core` |
| T-04 | Adversarial or malformed log lines crash parsing or leak payloads in errors | Per-line tolerant parser emits `parse-error`; error summaries avoid raw payload echoing |
| T-05 | JSON-RPC request/response IDs are mispaired across directions or id types | Correlator key includes session, logical request direction, id type, and stringified id |

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — root test configuration.
- [ ] `test/fixtures/generate.ts` — synthesizes all fixtures from canonical event shapes.
- [ ] `test/fixtures/tiny.jsonl` — 5-10 valid canonical JSONL events.
- [ ] `test/fixtures/malformed.jsonl` — valid lines mixed with malformed lines.
- [ ] `test/fixtures/crlf.jsonl` — CRLF line-ending fixture.
- [ ] `test/fixtures/bom.jsonl` — leading BOM fixture.
- [ ] `test/fixtures/legacy.sample.log` — synthesized legacy-format blocks, not copied from `~/agenthost.*.log`.
- [ ] `test/boundary.test.ts` — import-boundary assertions for portable packages.
- [ ] `test/security.test.ts` — dependency allow-list and localhost bind-address checks.
- [ ] `test/fixture-scrub.test.ts` — secret pattern detector for committed fixtures.
- [ ] Biome import restrictions for portable packages.

---

## Manual-Only Verifications

All Phase 1 behaviors have automated verification. Manual review is limited to confirming generated fixture contents are synthetic and non-sensitive before commit.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10 seconds
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-06
