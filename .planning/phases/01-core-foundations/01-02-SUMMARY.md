---
phase: 01
plan: 02
subsystem: parser
tags: [parser, normalizer, ahp-types, jsonl, legacy-adapter, host-protocol]
requires:
  - "@ahp-viewer/shared (Plan 01-01 stub)"
  - "@ahp-viewer/parser (Plan 01-01 stub)"
  - "agent-host-protocol sibling repo at ../agent-host-protocol"
  - "test/fixtures/{tiny,malformed,crlf,bom}.jsonl + legacy.sample.log (Plan 01-01)"
provides:
  - "@ahp-viewer/shared: AhpEvent envelope + EventKind/Direction/IdType/ParseStatus/NormalizeMeta"
  - "@ahp-viewer/shared: makeParseErrorEvent (8 KiB rawText cap)"
  - "@ahp-viewer/shared: makeCorrelationKey / correlationKeyForRequest / correlationKeyForResponse"
  - "@ahp-viewer/shared: HostMessage union + HostAdapter / HostClient / LogHandle / LogCandidate / Disposable"
  - "@ahp-viewer/shared/ahp: verbatim re-exports of the AHP type surface"
  - "@ahp-viewer/parser: LineSplitter + parseLine + ParsedLine + MAX_BUF_BYTES + ParseOverflowError"
  - "@ahp-viewer/parser: normalize(raw, meta) → AhpEvent (never throws)"
  - "@ahp-viewer/parser/legacy: parseLegacyBlock + parseLegacyStream (isolated, not in main barrel)"
affects:
  - "test/security.test.ts (allow-list now includes agent-host-protocol)"
  - "test/boundary.test.ts (now excludes *.test.ts so test files may use node:fs)"
tech-stack:
  added:
    - "agent-host-protocol@file:../../../agent-host-protocol — sibling repo dependency for AHP types"
  patterns:
    - "RESEARCH Pattern 1 — locked AhpEvent envelope (one event per JSONL line)"
    - "RESEARCH Pattern 2 — streaming LineSplitter with single-shot BOM strip + 16 MiB tail-buffer cap"
    - "RESEARCH Pattern 3 — tolerant per-line parseLine (never throws)"
    - "RESEARCH Pattern 4 — direction-inverting correlation key (Pitfall 2)"
    - "RESEARCH Pattern 6 — HostAdapter / HostClient seam (types-only in shared)"
    - "RESEARCH §Code Examples / Normalizer discriminant — collapse method:'action' / 'notification' to canonical kinds"
    - "RESEARCH §Code Examples / Legacy adapter — header + indented JSON block via normalize()"
key-files:
  created:
    - "packages/shared/src/event.ts"
    - "packages/shared/src/parse-error.ts"
    - "packages/shared/src/correlation.ts"
    - "packages/shared/src/host-protocol.ts"
    - "packages/shared/src/ahp/index.ts"
    - "packages/shared/src/ahp.reexport.test.ts"
    - "packages/parser/src/jsonl.ts"
    - "packages/parser/src/extract.ts"
    - "packages/parser/src/normalizer.ts"
    - "packages/parser/src/legacy.ts"
    - "packages/parser/src/jsonl.test.ts"
    - "packages/parser/src/normalizer.test.ts"
    - "packages/parser/src/large-payload.test.ts"
    - "packages/parser/src/legacy.test.ts"
  modified:
    - "packages/shared/package.json (exports./ahp + agent-host-protocol dep)"
    - "packages/shared/src/index.ts (barrel re-exports)"
    - "packages/parser/src/index.ts (barrel — legacy intentionally excluded)"
    - "test/security.test.ts (allow-list += agent-host-protocol)"
    - "test/boundary.test.ts (exclude *.test.ts files)"
    - "pnpm-lock.yaml"
decisions:
  - "AHP `const enum`s (ActionType / NotificationType) re-exported as TYPES only — verbatimModuleSyntax + isolatedModules forbid runtime re-export of const enums; consumers narrow against the type instead of reading runtime members."
  - "Re-exports use sibling-file subpaths (`agent-host-protocol/types/messages.js` / `actions.js` / `notifications.js`) instead of the package barrel — the barrel transitively pulls in `reducers.ts`, which fails our stricter `exactOptionalPropertyTypes: true` (the AHP package compiles under looser settings)."
  - "LineSplitter emits empty lines (Research Pattern 2 dropped them); without this, malformed.jsonl loses its blank line and VERIFY-01's per-line fixture counts no longer hold. parseLine immediately flags empty/whitespace lines so downstream sees them as parse-errors."
  - "MAX_BUF_BYTES set to 16 MiB and surfaced as ParseOverflowError — caller (Plan 03 LogStream feeder) will translate this into a parse-error event and continue."
  - "Parser barrel intentionally excludes `./legacy` (Pitfall 6); a runtime test enumerates non-parser packages and fails on any `parser/legacy` import."
  - "TextEncoder used for byte-length in legacy.ts instead of Node `Buffer` so the parser stays portable to a browser/webview host (T-03)."
metrics:
  duration: "~30 minutes"
  completed: "2026-05-07"
  commits: 3
  files_created: 14
  files_modified: 6
  tests_added: 46
  total_test_count: 73
---

# Phase 01 Plan 02: Event Model + JSONL Parser + Legacy Adapter Summary

Locked the canonical `AhpEvent` envelope, correlation key, and host-protocol seam in `@ahp-viewer/shared`, then shipped a tolerant streaming JSONL parser plus an isolated legacy sample-log adapter — all behind a single `parse → AhpEvent` surface that never throws.

## Commits

| # | Hash    | Type   | Scope    | Subject                                                                       |
| - | ------- | ------ | -------- | ----------------------------------------------------------------------------- |
| 1 | 8bc05f7 | feat   | 01-02    | lock shared AHP contracts, AhpEvent envelope, and host-protocol types         |
| 2 | cc898bb | feat   | 01-02    | tolerant JSONL parser, normalizer, and per-line fixture coverage              |
| 3 | a52e48a | feat   | 01-02    | isolated legacy sample-log adapter (INGEST-07)                                |

## What Shipped

### Locked Contracts (`@ahp-viewer/shared`)

| Symbol                                | File                              | Purpose                                                              |
| ------------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `AhpEvent` (interface, all readonly)  | src/event.ts:31                  | Canonical envelope — one per JSONL line.                             |
| `EventKind` (8-member union)          | src/event.ts:14                  | request, response, client/server-notification, action, protocol-notification, log, parse-error. |
| `Direction` / `IdType` / `ParseStatus`| src/event.ts:7,28,24             | Discriminant primitives.                                             |
| `NormalizeMeta`                       | src/event.ts:81                  | Caller-supplied envelope context (seq/ts/dir/byte coordinates).      |
| `makeParseErrorEvent`                 | src/parse-error.ts:17            | Tolerant fallback. Caps `rawText` at 8 KiB (T-02-03).                |
| `makeCorrelationKey` + helpers        | src/correlation.ts:30,45,58      | Direction-inverting JSON-RPC pairing key (Pitfall 2).                |
| `HostAdapter` / `HostClient` / `HostMessage` | src/host-protocol.ts:34,45,90 | Future-VS-Code-webview seam — types only.                          |

### AHP Re-exports (`@ahp-viewer/shared/ahp`)

| Re-exported symbol                   | Upstream source                                  | Kind |
| ------------------------------------ | ------------------------------------------------ | ---- |
| `IProtocolMessage`                   | agent-host-protocol/types/messages.ts            | type |
| `IJsonRpcRequest` / `IJsonRpcResponse` / `IJsonRpcSuccessResponse` / `IJsonRpcErrorResponse` / `IJsonRpcNotification` | messages.ts | type |
| `ICommandMap` / `IClientNotificationMap` / `IServerNotificationMap` / `INotificationMap` | messages.ts | type |
| `IAhpRequest` / `IAhpResponse` / `IAhpSuccessResponse` / `IAhpNotification` / `IAhpClientNotification` / `IAhpServerNotification` | messages.ts | type |
| `IActionEnvelope`                    | actions.ts                                       | type |
| `IProtocolNotification`              | notifications.ts                                 | type |
| `ActionType`                         | actions.ts (const enum)                          | type |
| `NotificationType` / `AuthRequiredReason` | notifications.ts (const enum)               | type |

`ActionType` and `NotificationType` are re-exported as TYPES only — under `verbatimModuleSyntax + isolatedModules`, `const enum`s cannot be re-exported as runtime values. Consumers narrow string literals against the imported type alias.

### Parser Surface (`@ahp-viewer/parser`)

| Export                          | File                                | Behavior                                                               |
| ------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `LineSplitter`                  | src/jsonl.ts:32                     | Streaming chunk → lines; single-shot BOM strip; 16 MiB tail cap.      |
| `MAX_BUF_BYTES` / `ParseOverflowError` | src/jsonl.ts:11,17           | Backpressure / DoS guard surface.                                      |
| `parseLine`                     | src/jsonl.ts:97                     | Tolerant JSON.parse wrapper.                                           |
| `normalize`                     | src/normalizer.ts:39                | JSON-RPC discriminator → canonical AhpEvent. Never throws.             |
| `parseLegacyBlock` / `parseLegacyStream` | src/legacy.ts:33,96 (NOT in main barrel) | Legacy `[ISO] marker label` adapter — routes through normalize(). |

## Test Coverage Matrix (VERIFY-01)

| Surface                | File                                       | Cases | Coverage                                                                                       |
| ---------------------- | ------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------- |
| AHP re-exports         | shared/src/ahp.reexport.test.ts            | 10    | typecheck via subpath, runtime narrowing, AhpEvent readonly enforcement, parse-error cap, correlation key inversion + idType fidelity. |
| LineSplitter / parseLine | parser/src/jsonl.test.ts                 | 9     | LF splits, BOM-once (Pitfall 4), CRLF, partial buffering, idempotent flush, MAX_BUF_BYTES overflow, empty-line handling, valid/invalid JSON. |
| Fixture round-trips    | parser/src/jsonl.test.ts                   | 4     | tiny.jsonl (8 events, all kinds present), malformed.jsonl (5 events / 3 parse-errors), crlf.jsonl (= tiny), bom.jsonl (3 events, BOM stripped once). |
| Normalizer (EVENT-02)  | parser/src/normalizer.test.ts              | 15    | All 7 classification kinds, string/null/boolean id (Pitfall 1), non-object payload, unrecognised shape, meta propagation, session/turn/toolCall extraction. |
| Large payload          | parser/src/large-payload.test.ts           | 1     | 2 MB single-line response parses in <500 ms.                                                   |
| Legacy adapter         | parser/src/legacy.test.ts                  | 7     | 6-block synthesised fixture classification, tsRaw preserved, unrecognised header → parse-error, exports = exactly 2, no escape hatches, no consumer leaks (Pitfall 6). |
| **Total new**          |                                            | **46**| Adds to 27 inherited tests → 73 total.                                                         |

## Threat Model Status

| Threat ID | Mitigation Status | Evidence                                                                  |
| --------- | ----------------- | ------------------------------------------------------------------------- |
| T-02-01 (DoS / unterminated line) | mitigated | `MAX_BUF_BYTES = 16 MiB` cap throws `ParseOverflowError`; test `LineSplitter > throws ParseOverflowError…` covers it. |
| T-02-02 (normalizer crash on adversarial payload) | mitigated | normalize() never throws; non-object → parse-error; `coerceId` returns null for booleans. Tests in normalizer.test.ts. |
| T-02-03 (parse-error rawText echoing megabyte payload) | mitigated | `makeParseErrorEvent` caps rawText at 8 KiB; test asserts the cap. |
| T-02-04 (request/response mispairing) | mitigated (helper level) | `correlationKeyForResponse` inverts direction; key includes idType. Wiring lives in Plan 03 Correlator. |
| T-02-05 (legacy helper leakage) | mitigated | `legacy.ts` exports exactly 2 symbols; runtime grep guard + cross-package import probe enforce. |
| T-02-06 (hand-rolled AHP enums drift) | mitigated | `packages/shared/src/ahp/index.ts` re-exports verbatim; reexport test typechecks the surface. |

## Verification Run

```text
pnpm vitest run        # 8 files, 73 tests passed
pnpm typecheck         # all 6 workspace packages clean
```

Specific acceptance greps (all match):

- `interface AhpEvent` in `packages/shared/src/event.ts` ✓
- `from "agent-host-protocol` in `packages/shared/src/ahp/index.ts` ✓
- `makeCorrelationKey` in `packages/shared/src/correlation.ts` ✓
- `interface HostAdapter` in `packages/shared/src/host-protocol.ts` ✓
- `agent-host-protocol` in `test/security.test.ts` (allow-list) ✓
- `class LineSplitter` in `packages/parser/src/jsonl.ts` ✓
- `export function normalize` in `packages/parser/src/normalizer.ts` ✓
- `MAX_BUF_BYTES` in `packages/parser/src/jsonl.ts` ✓
- `from './legacy'` in `packages/parser/src/index.ts` → empty (legacy NOT in main barrel) ✓
- `^export ` count in `packages/parser/src/legacy.ts` = 2 ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] AHP `const enum` re-exports incompatible with `verbatimModuleSyntax`**
- **Found during:** Task 1 typecheck.
- **Issue:** `export { ActionType }` from a const-enum module fails under `verbatimModuleSyntax + isolatedModules` ("'const' enums can only be used in property or index access expressions…").
- **Fix:** Re-exported `ActionType` and `NotificationType` as TYPES (the plan explicitly anticipates this fallback in Task 1's `<behavior>`). Updated test to narrow string literals against the type alias rather than reading runtime members.
- **Files modified:** `packages/shared/src/ahp/index.ts`, `packages/shared/src/ahp.reexport.test.ts`.
- **Commit:** 8bc05f7.

**2. [Rule 1 — Bug] AHP package barrel pulls reducers.ts into typecheck**
- **Found during:** Task 1 typecheck — `agent-host-protocol/types/reducers.ts` failed our stricter `exactOptionalPropertyTypes: true`.
- **Issue:** Importing from `agent-host-protocol/types/index.js` transitively compiles `reducers.ts`, which is valid under AHP's looser tsconfig but invalid under ours.
- **Fix:** Re-export from the focused subpaths (`messages.js`, `actions.js`, `notifications.js`) so reducers.ts is never reached. Acceptance grep `from 'agent-host-protocol` still matches.
- **Files modified:** `packages/shared/src/ahp/index.ts`.
- **Commit:** 8bc05f7.

**3. [Rule 1 — Bug] LineSplitter dropped empty lines, breaking VERIFY-01 fixture counts**
- **Found during:** Task 2 — malformed.jsonl produced 4 events instead of the contracted 5 (the empty line between two valid lines was silently swallowed).
- **Issue:** RESEARCH Pattern 2's `if (end > start) out.push(...)` skips empty lines, but the plan's `<behavior>` requires malformed.jsonl to yield exactly 5 events with 3 parse-errors (one per non-valid line, including the blank).
- **Fix:** LineSplitter now emits empty strings; `parseLine` already returns `error.reason === 'empty-line'` for them so they surface as parse-error events. Documented inline.
- **Files modified:** `packages/parser/src/jsonl.ts`.
- **Commit:** cc898bb.

**4. [Rule 2 — Critical functionality] Boundary test rejected legitimate test-file Node imports**
- **Found during:** Task 2 — `test/boundary.test.ts` would have flagged `node:fs` in the new parser test files.
- **Fix:** The plan explicitly authorised this update. boundary.test.ts now skips `*.test.ts` files; production parser source remains Node-free.
- **Files modified:** `test/boundary.test.ts`.
- **Commit:** cc898bb.

**5. [Rule 2 — Portability] Replaced Node `Buffer` with `TextEncoder` in legacy.ts**
- **Found during:** Task 3.
- **Issue:** Plan-specified byte-offset accounting could use `Buffer.byteLength`, but the parser is required to stay portable (T-03).
- **Fix:** Used a module-scoped `TextEncoder` for UTF-8 byte length so the legacy adapter is browser-safe.
- **Files modified:** `packages/parser/src/legacy.ts`.
- **Commit:** a52e48a.

No architectural deviations; no checkpoints hit; no auth gates required.

## Known Stubs

- `packages/parser/src/extract.ts`: heuristic `extractSessionId/extractTurnId/extractToolCallId` — explicit `TODO(Phase 2 / Pitfall 3)` to replace with a per-method `ICommandMap`-keyed table once Phase 2 starts wiring real method coverage. Phase 1 only relies on the most common shapes (session URI, turnId, toolCallId), and tests confirm they extract correctly for the fixture cases.

## Self-Check: PASSED

Verified:
- `packages/shared/src/event.ts` ✓
- `packages/shared/src/parse-error.ts` ✓
- `packages/shared/src/correlation.ts` ✓
- `packages/shared/src/host-protocol.ts` ✓
- `packages/shared/src/ahp/index.ts` ✓
- `packages/shared/src/ahp.reexport.test.ts` ✓
- `packages/parser/src/jsonl.ts` ✓
- `packages/parser/src/normalizer.ts` ✓
- `packages/parser/src/extract.ts` ✓
- `packages/parser/src/legacy.ts` ✓
- `packages/parser/src/jsonl.test.ts` ✓
- `packages/parser/src/normalizer.test.ts` ✓
- `packages/parser/src/large-payload.test.ts` ✓
- `packages/parser/src/legacy.test.ts` ✓
- Commits 8bc05f7, cc898bb, a52e48a all present in `git log`.
