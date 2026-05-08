---
phase: 01-core-foundations
verified: 2025-07-15T02:00:00Z
status: passed
score: 5/5 roadmap success criteria verified
overrides_applied: 0
re_verification: false
---

# Phase 01: Core Foundations Verification Report

**Phase Goal:** Establish a clean architecture with a canonical AHP event model, working parsers, an in-memory EventStore, and a host adapter boundary that keeps Node-only capabilities out of the UI.  
**Verified:** 2025-07-15T02:00:00Z  
**Status:** ✅ PASSED  
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Developer can clone, install, run CLI entrypoint that boots local app shell with no outbound network calls or CDN assets | ✓ VERIFIED | CLI wires `NodeHostAdapter → LineSplitter → EventStore → startHealthServer` on 127.0.0.1; security allow-list test enforces no unlisted runtime deps; all 100 tests pass |
| SC-2 | JSONL parser converts raw lines into canonical event model (timestamp, direction, kind, method/action, IDs, session/turn, sequence, raw payload, parse status) sourced from `../agent-host-protocol` | ✓ VERIFIED | `packages/parser/src/normalizer.ts` normalizes to `AhpEvent` (interface in `event.ts`); AHP types re-exported verbatim from `agent-host-protocol` via `packages/shared/src/ahp/index.ts` |
| SC-3 | Legacy adapter parses human-readable sample log into canonical model without leaking its format into core | ✓ VERIFIED | `packages/parser/src/legacy.ts` exports only `parseLegacyBlock` + `parseLegacyStream`; calls `normalize()` internally; excluded from parser barrel; `legacy.test.ts` confirms 6 canonical events |
| SC-4 | Request/response correlation produces JSON-RPC-safe bidirectional key preserving session, direction, id value, and id type | ✓ VERIFIED | `makeCorrelationKey(session, requestDir, idType, id)` — direction inverted for responses (line 49 of `correlation.ts`); `idType` in key prevents `1 ≠ "1"` collision; Correlator marks non-pairables as `'n/a'` |
| SC-5 | Parser/normalizer tests cover valid JSONL, malformed lines, partial trailing lines, CRLF/BOM, large payloads, correlation, legacy adapter — using scrubbed fixture logs | ✓ VERIFIED | `jsonl.test.ts` (13), `normalizer.test.ts` (15), `large-payload.test.ts` (1), `legacy.test.ts` (7), `fixture-scrub.test.ts` (6), `ahp.reexport.test.ts` (10) — 100 tests total, all green |

**Score:** 5/5 roadmap success criteria verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pnpm-workspace.yaml` | Workspace package list | ✓ VERIFIED | Contains `packages/*` glob; all 6 packages included |
| `biome.json` | Lint+format with noRestrictedImports | ✓ VERIFIED | `noRestrictedImports` present for portable packages |
| `tsconfig.base.json` | Strict TS 5.x base config | ✓ VERIFIED | `"strict": true` + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` |
| `vitest.config.ts` | Vitest 4.x root config | ✓ VERIFIED | Exists; Vitest 4.1.5 runs 100 tests |
| `test/fixtures/generate.ts` | Synthesizes fixtures from canonical envelope shapes | ✓ VERIFIED | Exists (>40 lines); generates JSONL fixtures in-process |
| `test/boundary.test.ts` | AST/regex scan for forbidden imports in portable packages | ✓ VERIFIED | Scans `node:`, `fs`, `chokidar`, `react` patterns in shared/parser/core (16 tests) |
| `test/security.test.ts` | Package dependency allow-list | ✓ VERIFIED | Allow-list includes `hono`, `chokidar`, `agent-host-protocol` etc. (8 tests) |
| `test/fixture-scrub.test.ts` | Secret-pattern scanner for fixtures | ✓ VERIFIED | No Bearer/sk-/ghp_/password=/api_key= in committed fixtures (6 tests) |
| `packages/shared/src/event.ts` | AhpEvent interface, EventKind, Direction, IdType, ParseStatus | ✓ VERIFIED | `export interface AhpEvent` present with all required fields |
| `packages/shared/src/correlation.ts` | CorrelationKey + makeCorrelationKey + correlationKeyForRequest/Response | ✓ VERIFIED | All 3 functions exported; direction-inverting logic in `correlationKeyForResponse` (line 49) |
| `packages/shared/src/host-protocol.ts` | HostMessage union, HostAdapter interface, HostClient, LogHandle, LogCandidate, Disposable | ✓ VERIFIED | `export interface HostAdapter` present |
| `packages/shared/src/ahp/index.ts` | Re-exports AHP types from agent-host-protocol | ✓ VERIFIED | Imports from `agent-host-protocol/types/actions.js`, `messages.js`, `notifications.js` |
| `packages/parser/src/jsonl.ts` | LineSplitter (BOM/CRLF/partial-line aware) + parseLine | ✓ VERIFIED | `export class LineSplitter` with BOM/CRLF/partial-line handling confirmed by tests |
| `packages/parser/src/normalizer.ts` | normalize(raw, meta) → AhpEvent (never throws) | ✓ VERIFIED | `export function normalize(raw, meta): AhpEvent`; classifies 7 event kinds |
| `packages/parser/src/legacy.ts` | parseLegacyBlock + parseLegacyStream — sole exports | ✓ VERIFIED | Exactly 2 exports; calls `normalize()` internally; no leaked helpers |
| `packages/core/src/event-store.ts` | Append-only columnar EventStore with subscribe() | ✓ VERIFIED | `export class EventStore` with parallel columns + `subscribe(fn): () => void` |
| `packages/core/src/correlator.ts` | Correlator pairing requests/responses | ✓ VERIFIED | `export class Correlator`; uses `correlationKeyForRequest/Response`; marks non-pairables `'n/a'` |
| `packages/host-node/src/host-adapter.ts` | NodeHostAdapter implements HostAdapter | ✓ VERIFIED | `export class NodeHostAdapter implements HostAdapter`; uses `node:fs` + chokidar |
| `packages/server/src/health-server.ts` | Hono server bound to 127.0.0.1 | ✓ VERIFIED | `const HOSTNAME = "127.0.0.1" as const`; bind-address test passes |
| `packages/cli/src/index.ts` | ahp-viewer CLI entry — argv → openLog + start health server | ✓ VERIFIED | Imports `NodeHostAdapter`, `startHealthServer`; `.name("ahp-viewer")`; smoke tests pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pnpm-workspace.yaml` | `packages/*/package.json` | workspace include glob `packages/*` | ✓ WIRED | All 6 packages installed and resolved |
| `test/boundary.test.ts` | `packages/{shared,parser,core}/src` | scans for `node:`, `fs`, `chokidar`, `react` | ✓ WIRED | 16 tests pass; shared/parser/core have zero node: imports |
| `packages/parser/src/normalizer.ts` | `packages/shared/src/event.ts` | `import type { AhpEvent, EventKind, IdType, NormalizeMeta }` | ✓ WIRED | Import confirmed |
| `packages/parser/src/legacy.ts` | `packages/parser/src/normalizer.ts` | calls `normalize()` | ✓ WIRED | `return normalize(payload, normMeta)` at end of `parseLegacyBlock` |
| `packages/shared/src/ahp/index.ts` | `agent-host-protocol` | `from "agent-host-protocol/types/*.js"` | ✓ WIRED | Imports `ActionType`, `IActionEnvelope`, `IProtocolMessage`, etc. |
| `packages/cli/src/index.ts` | `packages/host-node/src/host-adapter.ts` | `import { NodeHostAdapter }` | ✓ WIRED | Imports and instantiates `new NodeHostAdapter()` |
| `packages/cli/src/index.ts` | `packages/server/src/health-server.ts` | `import { startHealthServer }` | ✓ WIRED | Called with `hostname: "127.0.0.1"` |
| `packages/core/src/correlator.ts` | `packages/shared/src/correlation.ts` | `correlationKeyForRequest / correlationKeyForResponse` | ✓ WIRED | Both imported and used at lines 38–39 |

---

### Code Review Fix Verification

All 5 warnings from `01-REVIEW.md` confirmed fixed in actual code:

| Fix | Commit | Verified in Code |
|-----|--------|-----------------|
| WR-01: Correlator orphans displaced request on duplicate key | `a2b3ad9` | ✓ Lines 95–98 in `correlator.ts` set `status[displaced] = "orphan"` |
| WR-02: Correlator orphans displaced early-arriving response on duplicate key | `a2b3ad9` | ✓ Lines 113–116 in `correlator.ts` set `status[displaced] = "orphan"` |
| WR-03: TailReader in-flight concurrency guard | `eccf48a` | ✓ `#readInFlight` field; guard at line 73; `.finally()` reset at line 75–76 |
| WR-04: TailReader logs stream errors instead of silencing | `eccf48a` | ✓ `console.warn("[TailReader] read error during tail:", ...)` at line 108 |
| WR-05: `makeParseErrorEvent` caps rawText by UTF-8 bytes not char count | `b40a4c7` | ✓ `TextEncoder().encode()` + `bytes.length > MAX_RAW_TEXT_BYTES` comparison |

---

### Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|----------|
| FOUND-01 | 01-03 | Developer can install and run CLI | ✓ SATISFIED | `cli/src/index.ts` boots NodeHostAdapter + health server; smoke tests pass |
| FOUND-02 | 01-01 | Portable/Node/server/CLI/UI separation | ✓ SATISFIED | Boundary test enforces no node: imports in shared/parser/core; 16 tests pass |
| FOUND-03 | 01-02 | Uses `agent-host-protocol` as source of truth | ✓ SATISFIED | AHP types re-exported verbatim from `agent-host-protocol`; no hand-rolled enums |
| FOUND-04 | 01-01, 01-03 | Local-only security posture | ✓ SATISFIED | Health server hard-coded 127.0.0.1; security allow-list test enforced; no outbound deps |
| INGEST-07 | 01-02 | Legacy adapter without coupling main event model | ✓ SATISFIED | `legacy.ts` only exports `parseLegacyBlock`/`parseLegacyStream`; excluded from parser barrel |
| EVENT-01 | 01-02 | Canonical event model | ✓ SATISFIED | `AhpEvent` interface with all required fields in `event.ts` |
| EVENT-02 | 01-02 | Consistent event classification | ✓ SATISFIED | Normalizer classifies 7 kinds deterministically; tests cover all kinds |
| EVENT-03 | 01-03 | Bidirectional JSON-RPC-safe correlation key | ✓ SATISFIED | Direction-inverting key; idType prevents numeric/string collision; Correlator maps non-pairables to `'n/a'` |
| VERIFY-01 | 01-02 | Parser/normalizer test coverage | ✓ SATISFIED | 13+15+1+7 parser tests + CRLF/BOM/malformed/partial/large-payload all covered |
| VERIFY-04 | 01-01 | Fixture logs scrubbed | ✓ SATISFIED | `fixture-scrub.test.ts` passes; no tokens in committed fixtures |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 100 tests pass | `pnpm vitest run` | 13 test files, 100 tests, 0 failures, 683ms | ✓ PASS |
| Boundary tests: shared/parser/core have no node: imports | Included in test suite | 16 boundary tests green | ✓ PASS |
| Health server binds 127.0.0.1 only | Included in test suite | `addr.address === "127.0.0.1"` passes | ✓ PASS |
| Correlator WR-01 fix (orphan on duplicate key) | Code inspection + test | `status[displaced] = "orphan"` in code; correlator test updated | ✓ PASS |
| Fixtures contain no secrets | `fixture-scrub.test.ts` + manual grep | No Bearer/sk-/ghp_/password=/api_key= | ✓ PASS |

---

### Anti-Patterns Found

No blockers. Minor note:

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `packages/cli/src/index.ts` (comment line 62 of SUMMARY) | CLI defaults `dir='c2s'` for every line as Phase-1 placeholder; real direction inference in Phase 2 | ℹ️ Info | Direction classification is deferred intentionally; does not block Phase 1 goals |

---

### Human Verification Required

None — all Phase 1 goals are programmatically verifiable and confirmed by the test suite.

---

## Gaps Summary

No gaps. All must-haves verified.

- **5/5 roadmap success criteria** verified with code evidence
- **10/10 requirements** (FOUND-01–04, INGEST-07, EVENT-01–03, VERIFY-01, VERIFY-04) satisfied
- **All 100 tests green** (13 test files)
- **All 5 code review warnings** confirmed fixed in actual code
- **All 20 required artifacts** exist, are substantive, and are correctly wired
- **Layer boundary enforced**: shared/parser/core have zero node: imports; host-node correctly uses node:fs + chokidar

---

_Verified: 2025-07-15T02:00:00Z_  
_Verifier: the agent (gsd-verifier)_
