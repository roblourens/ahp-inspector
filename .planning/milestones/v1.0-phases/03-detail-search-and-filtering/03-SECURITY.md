---
phase: "03"
slug: detail-search-and-filtering
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-07
---

# Phase 03 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Phase: Detail, Search, and Filtering.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| node_modules -> UI bundle | `react-json-view-lite` ships into the browser | Third-party package code |
| EventRow SSE frame -> browser | Four additive EventRow fields flow over SSE snapshots/patches | Log metadata and auth/gap flags |
| HTTP request -> Hono route | `/api/log/event/:idx` and `/api/log/search` accept browser-controlled parameters | `idx`, `q`, `limit` |
| AhpEvent.raw -> JSON response/browser DOM | Full JSON-RPC payload is returned for detail view | User-owned log payload; may contain prompts, tokens, paths |
| Search/filter text -> browser rendering | Search query and log field values are rendered in timeline/filter/detail UI | User input and log content |
| Clipboard API | User-triggered copy exports raw payload text from the app | Potentially sensitive log payload |
| Document listeners -> browser | Resize handle attaches document-level mouse listeners during drag | UI event handlers |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-00-01 | Tampering | `react-json-view-lite` package | mitigate | Dependency allow-listed in `test/security.test.ts`; dist grep for `eval`/`new Function` returned empty; package installed only from npm lockfile. | closed |
| T-03-00-02 | Denial of Service | EventRow SSE inflation | accept | Four additive fields are small and covered by SSE/vertical-slice tests; accepted as within snapshot budget. | closed |
| T-03-00-03 | Tampering | Auth-failure detection logic | mitigate | `row-projection.test.ts` covers JSON-RPC `-32007` and `notify/authRequired`; `projectRow` fields are additive. | closed |
| T-03-01-01 | Denial of Service | `/api/log/search` ReDoS | mitigate | `SearchIndex.scan` uses lowercase substring `.includes()` only; no regex from user input; query capped at 256 chars. | closed |
| T-03-01-02 | Denial of Service | `/api/log/search` result size | mitigate | Search route hard-caps results at 5,000 regardless of requested limit; tests cover truncation. | closed |
| T-03-01-03 | Tampering | `/api/log/event/:idx` validation | mitigate | Route uses `Number(raw)` plus `Number.isInteger()` and rejects negative, non-numeric, and partial numeric values before store access; tests cover `1abc`. | closed |
| T-03-01-04 | Information Disclosure | Detail response path leakage | mitigate | Detail response omits `LogMeta`; tests assert absolute fixture paths do not appear in response JSON. | closed |
| T-03-01-05 | Denial of Service | `SearchIndex.append` | accept | Append is synchronous O(1) per event and bounded by EventStore size; no listener or async resource growth. | closed |
| T-03-02-01 | Denial of Service | Client selector/filter pass | mitigate | `useFilteredRows` uses `useDeferredValue`; perf test covers 50,000 rows under the phase threshold. | closed |
| T-03-02-02 | Tampering | Filter/chip label XSS | accept | Values are rendered as React text children in filter components; no HTML interpretation. | closed |
| T-03-02-03 | Information Disclosure | Detail width state | accept | Detail width is in-memory Zustand UI state only; persistence deferred to a later phase. | closed |
| T-03-03-01 | Tampering | FacetPopover XSS | mitigate | Option labels/counts render through React text/controls; no `dangerouslySetInnerHTML`. | closed |
| T-03-03-02 | Denial of Service | FacetPopover large option sets | mitigate | Popover renders at most 100 options and displays an overflow footer; tests cover capped behavior. | closed |
| T-03-03-03 | Accessibility | Filter/group controls | mitigate | Controls use button/input semantics and accessible labels; component tests cover key UI states. | closed |
| T-03-04-01 | Tampering | Raw/pretty JSON rendering XSS | mitigate | `RawJsonView` renders `<pre>{text}</pre>` and `PrettyJsonView` uses text-only React rendering; no `dangerouslySetInnerHTML`; tests include script payload. | closed |
| T-03-04-02 | Denial of Service | Large pretty JSON payloads | mitigate | `PrettyJsonView` caps tree rendering at 256 KB and shows `TruncationBanner`; server detail response is bounded by route behavior and UI truncation copy. | closed |
| T-03-04-03 | Information Disclosure | Clipboard copy of raw payload | mitigate | Copy occurs only by explicit user action; `PrivacyCaption` warns that raw payload may contain tokens, prompts, or paths; copy tests cover actions. | closed |
| T-03-04-04 | Denial of Service | Detail fetch lifecycle | mitigate | `DetailPanel` creates an `AbortController` per selected event and aborts in cleanup; review fix also prevents stale status from cached detail data. | closed |
| T-03-04-05 | Information Disclosure | Detail response raw payload semantics | accept | Raw payload is user-owned log data intentionally exposed by detail view; server-generated path metadata is not added to the response. | closed |
| T-03-05-01 | Denial of Service | `useSearch` request lifecycle | mitigate | `useSearch` debounces 150 ms and aborts the current request immediately on query change/unmount; regression test verifies signal abort. | closed |
| T-03-05-02 | Denial of Service | Grouped timeline rendering | mitigate | Grouping is memoized and displayed through TanStack Virtual mixed-size rows; selector perf tests and UI build cover the path. | closed |
| T-03-05-03 | Tampering | Search highlight XSS | mitigate | `highlightMatches` returns React `<mark>` elements with text children; search query is never interpreted as HTML. | closed |
| T-03-05-04 | Information Disclosure | Auth-failure glyph | accept | Auth-failure state is metadata from the user's local log and is intentionally surfaced for diagnosis. | closed |

*Status: closed*  
*Disposition: mitigate (implementation required) | accept (documented risk) | transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-00-02 | Additive EventRow fields increase SSE snapshot size modestly and are acceptable for v1-scale logs. | GSD security audit | 2026-05-07 |
| AR-03-02 | T-03-01-05 | `SearchIndex.append` has no listener/resource lifecycle and scales with the existing EventStore. | GSD security audit | 2026-05-07 |
| AR-03-03 | T-03-02-02 | React text rendering is the control; filter values are local log metadata and not HTML. | GSD security audit | 2026-05-07 |
| AR-03-04 | T-03-02-03 | Detail width is in-memory UI preference only, with no persistence or cross-session disclosure. | GSD security audit | 2026-05-07 |
| AR-03-05 | T-03-04-05 | Detail view intentionally exposes user-owned raw log payload; server metadata path leakage is separately mitigated. | GSD security audit | 2026-05-07 |
| AR-03-06 | T-03-05-04 | Auth-failure glyph exposes diagnostic metadata from the user's local log, not a new secret. | GSD security audit | 2026-05-07 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-07 | 23 | 23 | 0 | gsd-security-auditor |

---

## Evidence

- Full gate passed after review fixes: `pnpm test`, UI build, CLI build, typecheck, and lint.
- Final code review report is clean in `03-REVIEW.md`.
- Browser UAT was performed with `playwright-cli` and screenshots under `screenshots/phase3-*`.
- Key mitigation tests include `detail-routes.test.ts`, `search-routes.test.ts`, `row-projection.test.ts`, `selectors.perf.test.ts`, `CopyMenu.test.tsx`, `DetailPanel.test.tsx`, `DetailResizeHandle.test.tsx`, `http-client.test.ts`, and `search-client.test.ts`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-07
