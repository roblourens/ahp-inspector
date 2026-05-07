---
phase: 01-core-foundations
reviewed: 2025-07-14T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - .gitignore
  - .nvmrc
  - biome.json
  - package.json
  - packages/cli/src/cli.smoke.test.ts
  - packages/core/src/correlator.test.ts
  - packages/core/src/correlator.ts
  - packages/core/src/event-store.test.ts
  - packages/core/src/event-store.ts
  - packages/core/src/types.ts
  - packages/host-node/src/discovery.ts
  - packages/host-node/src/host-adapter.test.ts
  - packages/host-node/src/host-adapter.ts
  - packages/host-node/src/tail-reader.ts
  - packages/parser/src/extract.ts
  - packages/parser/src/jsonl.test.ts
  - packages/parser/src/jsonl.ts
  - packages/parser/src/large-payload.test.ts
  - packages/parser/src/legacy.test.ts
  - packages/parser/src/legacy.ts
  - packages/parser/src/normalizer.test.ts
  - packages/parser/src/normalizer.ts
  - packages/server/src/health-server.test.ts
  - packages/server/src/health-server.ts
  - packages/shared/src/ahp.reexport.test.ts
  - packages/shared/src/ahp/index.ts
  - packages/shared/src/correlation.ts
  - packages/shared/src/event.ts
  - packages/shared/src/host-protocol.ts
  - packages/shared/src/parse-error.ts
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
  - test/boundary.test.ts
  - test/fixture-scrub.test.ts
  - test/fixtures/bom.jsonl
  - test/fixtures/crlf.jsonl
  - test/fixtures/generate.ts
  - test/fixtures/legacy.sample.log
  - test/fixtures/malformed.jsonl
  - test/fixtures/tiny.jsonl
  - test/security.test.ts
  - tsconfig.base.json
  - vitest.config.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2025-07-14T00:00:00Z  
**Depth:** standard  
**Files Reviewed:** 41  
**Status:** issues_found

## Summary

Phase 1 establishes the canonical event model, parser pipeline, correlator, EventStore, Node
host adapter, and health server. The security posture (localhost-only bind, no outbound deps,
portable package boundaries, fixture scrubbing) is solid. The parser's tolerant design and the
`makeParseErrorEvent` capping are well-structured.

Five meaningful issues were found — no criticals. Two are logic bugs in the Correlator around
duplicate-key collisions (both request and response sides); the existing tests exercise the
normal path but miss the edge case. Two are in `TailReader`: a concurrency race and a silenced
error. One is a unit/semantic mismatch in the parse-error cap. Three info-level items round out
the findings.

---

## Warnings

### WR-01: Correlator orphans first request on duplicate-key collision

**File:** `packages/core/src/correlator.ts:95-97`

**Issue:** When `#onRequest` receives a second event whose correlation key already exists in
`#pendingRequests`, it silently overwrites the old entry with the new idx:

```ts
this.#pendingRequests.set(key, idx);   // line 96 — old idx permanently dropped
this.status[idx] = "pending";
```

The old idx's slot in `status[]` was set to `'pending'` (line 97 of the *first* call) and is
never updated again. `flush()` iterates `#pendingRequests` by key, which now points only to the
new idx; the old idx's 'pending' slot is permanently unreachable. The `'orphan'` value in
`Status` was presumably reserved for exactly this situation but is never assigned here.

The existing test `"does NOT pair two same-direction requests with same id"` passes because it
only checks the `status` *array values* (both 'pending'), not whether `flush()` can ever resolve
the first one.

**Fix:** Before overwriting, mark the displaced request as 'orphan':

```ts
#onRequest(idx: number, ev: AhpEvent): void {
  const key = correlationKeyForRequest(ev);
  const earlyResp = this.#pendingResponses.get(key);
  if (earlyResp !== undefined) {
    this.#pendingResponses.delete(key);
    this.#pair(idx, earlyResp);
    return;
  }
  // Mark the displaced request orphaned before overwriting the map entry.
  const displaced = this.#pendingRequests.get(key);
  if (displaced !== undefined) {
    this.status[displaced] = "orphan";
  }
  this.#pendingRequests.set(key, idx);
  this.status[idx] = "pending";
}
```

---

### WR-02: Correlator silently drops first early-arriving response on duplicate-key collision

**File:** `packages/core/src/correlator.ts:109`

**Issue:** The symmetric problem exists in `#onResponse`. When two out-of-order responses with
the same correlation key arrive before their request, the second silently overwrites the first in
`#pendingResponses`:

```ts
this.#pendingResponses.set(key, idx);   // first idx permanently dropped
```

The first response is set to `status 'n/a'` (line 76, the default slot fill) and is never
paired or flagged. Unlike `#pendingRequests`, there is no `flush()` path for pending responses
at all, so any orphaned early response is silently lost regardless of timing.

**Fix:** Before overwriting, mark the displaced response slot (e.g., with a new `"orphan-response"` value, or by reusing `"orphan"` for both sides):

```ts
const displaced = this.#pendingResponses.get(key);
if (displaced !== undefined) {
  this.status[displaced] = "orphan";   // make the displacement visible
}
this.#pendingResponses.set(key, idx);
```

---

### WR-03: TailReader — concurrent `#readTail` invocations deliver duplicate bytes

**File:** `packages/host-node/src/tail-reader.ts:71-74`

**Issue:** The chokidar 'change' handler fires `#readTail` without any serialisation guard:

```ts
watcher.on("change", () => {
  void this.#readTail(onChunk);   // concurrent invocations not prevented
});
```

`#readTail` is async. If two 'change' events arrive in quick succession (common with
`awaitWriteFinish: false`), both capture the same `this.#lastOffset` before either completes.
Both read the same byte range and both call `onChunk` with the same data. After both resolve,
`this.#lastOffset` is updated twice to the same value. The upstream consumer receives duplicate
chunks and will produce duplicate/repeated events in the EventStore.

**Fix:** Serialise tail reads with a simple in-flight guard:

```ts
#readInFlight = false;

watcher.on("change", () => {
  if (this.#readInFlight) return;    // coalesce — a read is already happening
  this.#readInFlight = true;
  void this.#readTail(onChunk).finally(() => {
    this.#readInFlight = false;
  });
});
```

Or use a promise chain so no read is dropped:

```ts
#tailChain: Promise<void> = Promise.resolve();

watcher.on("change", () => {
  this.#tailChain = this.#tailChain.then(() => this.#readTail(onChunk));
});
```

---

### WR-04: TailReader — `#readTail` silently swallows stream read errors

**File:** `packages/host-node/src/tail-reader.ts:102`

**Issue:** The stream error handler in `#readTail` calls `resolve()` rather than logging or
forwarding the error:

```ts
stream.on("error", () => resolve());   // error silently dropped
```

A read error (e.g., file truncated mid-read, permissions revoked) resolves the promise as a
success without advancing `#lastOffset` and without any observable signal. The next 'change'
event retries the same range — which may succeed — but the gap in delivery is invisible to the
caller. Compare with `readInitial` which correctly calls `reject` on error:

```ts
stream.on("error", reject);   // readInitial — correct
```

**Fix:** Propagate the error so the caller can surface it:

```ts
stream.on("error", (err) => {
  console.warn("[TailReader] read error during tail:", err.message);
  resolve();   // still resolve to keep the chain going, but log the gap
});
```

Or reject and let the watcher's `void` discard it — but at minimum the error should be logged.

---

### WR-05: `makeParseErrorEvent` caps `rawText` by character count, not bytes

**File:** `packages/shared/src/parse-error.ts:22-23`

**Issue:** The cap is implemented using `.length`, which counts UTF-16 code units (characters),
not bytes:

```ts
export const MAX_RAW_TEXT_BYTES = 8 * 1024;   // named "bytes"

const capped =
  rawText.length > MAX_RAW_TEXT_BYTES          // compares chars, not bytes
    ? rawText.slice(0, MAX_RAW_TEXT_BYTES)
    : rawText;
```

For strings containing only ASCII the difference is zero; however an adversarial or unusual log
line containing 4-byte UTF-8 characters (e.g., supplementary plane emoji) could produce a
capped string of up to 32 KiB in UTF-8 — 4× the stated limit. The constant name and doc comment
both say "8 KiB" and reference T-02-03, so the intent is clearly a byte budget, not a character
budget. The mismatch undermines the stated memory-safety guarantee for non-ASCII payloads.

**Fix:** Convert to UTF-8 bytes before capping, or at minimum compare against a conservative
character limit that accounts for the worst-case expansion:

```ts
// Option A: byte-accurate, uses TextEncoder (already present in this package)
const encoder = new TextEncoder();
const bytes = encoder.encode(rawText);
const capped =
  bytes.length > MAX_RAW_TEXT_BYTES
    ? new TextDecoder().decode(bytes.slice(0, MAX_RAW_TEXT_BYTES))
    : rawText;

// Option B: conservative character limit
const MAX_RAW_CHARS = MAX_RAW_TEXT_BYTES >> 2;   // 2048 — safe for any encoding
const capped = rawText.length > MAX_RAW_CHARS ? rawText.slice(0, MAX_RAW_CHARS) : rawText;
```

---

## Info

### IN-01: `'orphan'` Status value is never assigned

**File:** `packages/core/src/types.ts:3`

**Issue:** The `Status` union includes `'orphan'`:

```ts
export type Status = "ok" | "error" | "pending" | "unmatched" | "orphan" | "n/a";
```

No code in the correlator ever assigns this value. It appears to have been reserved for the
duplicate-key collision case described in WR-01/WR-02, but the assignment was not implemented.
Any UI projection that renders a 'orphan' badge will never exercise that branch, and any
exhaustive switch on `Status` must handle a value that currently cannot appear.

**Fix:** Implement the assignment in WR-01/WR-02 fixes, or remove `'orphan'` from the union
until it is used.

---

### IN-02: `biome.json` `noRestrictedImports` does not cover `node:*` prefixed imports

**File:** `biome.json:38-52`

**Issue:** The per-package boundary rule lists bare specifiers (`"fs"`, `"path"`, etc.) but not
their canonical `node:` prefixed forms:

```json
"paths": {
  "fs": "Portable packages must not import Node fs.",
  "path": "Portable packages must not import Node path.",
  ...
}
```

A developer writing `import { readFileSync } from "node:fs"` (the recommended modern form) in a
portable package (`shared`, `core`, `parser`) would not get a lint error from biome, even though
the same import using the bare specifier would. The `test/boundary.test.ts` regex `/^node:/`
provides authoritative enforcement, but the linter check catches violations at development time
in the editor rather than only at CI.

**Fix:** Add `node:` prefixed variants to the restricted paths in the biome override:

```json
"paths": {
  "fs":           "Portable packages must not import Node fs.",
  "node:fs":      "Portable packages must not import Node fs.",
  "fs/promises":  "Portable packages must not import Node fs/promises.",
  "node:fs/promises": "Portable packages must not import Node fs/promises.",
  "path":         "Portable packages must not import Node path.",
  "node:path":    "Portable packages must not import Node path.",
  "chokidar":     "Portable packages must not import chokidar.",
  ...
}
```

---

### IN-03: `parseLegacyStream` byte-offset accounting is wrong for CRLF-encoded input

**File:** `packages/parser/src/legacy.ts:113, 129, 160`

**Issue:** `parseLegacyStream` splits lines with `/\r?\n/` (correctly handling CRLF), but every
byte-offset accumulation assumes LF (`+1` for the line terminator):

```ts
// empty line case (line 113):
byteOffset += 1;  // wrong for CRLF — should be += 2

// body line accumulation (line 129):
bodyByteLen += utf8ByteLength(next) + 1;   // wrong for CRLF

// stray line case (line 160):
byteOffset += utf8ByteLength(line) + 1;    // wrong for CRLF
```

On a CRLF-encoded legacy log, every `byteOffset` field after the first line would be off by
approximately N (one byte per line), causing navigation/jump-to-source features driven by
`byteOffset` to mis-position once Phase 4 wires up a source viewer.

**Fix:** Detect whether the input uses CRLF and add the appropriate newline byte count. Since the
function already receives the full text, the EOL style can be detected once:

```ts
const eolBytes = /\r\n/.test(text) ? 2 : 1;
// ... then replace all `+ 1` newline contributions with `+ eolBytes`
```

---

_Reviewed: 2025-07-14T00:00:00Z_  
_Reviewer: gsd-code-reviewer_  
_Depth: standard_
