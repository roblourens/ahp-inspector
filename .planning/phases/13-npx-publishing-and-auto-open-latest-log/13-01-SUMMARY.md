---
plan: 13-01
phase: 13-npx-publishing-and-auto-open-latest-log
status: complete
requirements: [NPX-02, NPX-03]
key-files:
  created:
    - packages/host-node/src/find-latest-ahp-log.ts
    - packages/host-node/src/find-latest-ahp-log.test.ts
    - packages/cli/src/cli-autodiscovery.test.ts
  modified:
    - packages/host-node/src/discovery.ts
    - packages/host-node/src/index.ts
    - packages/host-node/package.json
    - packages/cli/src/index.ts
    - pnpm-lock.yaml
---

## What was built

`findLatestAhpLog()` — a new bounded walker in `@ahp-inspector/host-node` that
returns the absolute path of the newest non-empty AHP-shape JSONL log under
the standard VS Code log roots (or `null` if none qualify). The walker reuses
the same time/stat caps as `discoverVsCodeLogs()` (1500ms, 5000 stats, depth 5)
and probes only the top 10 candidates by mtime. Probing reads the first 64 KiB
of each file, parses the first complete line, and accepts the candidate iff
`normalize()` returns a non-`parse-error` event.

The CLI's no-arg branch now calls `findLatestAhpLog()` before `sessions.open()`:
- Hit → behaves like the explicit-path branch (`Watching <path>` to stdout).
- Miss → friendly stderr note (`No AHP logs found under VS Code log roots —
  opened picker UI.`) + browser still opens to the discovery picker; exit 0.

Explicit-path invocation is byte-for-byte unchanged.

## Tests

- `find-latest-ahp-log.test.ts` (5 tests): newest-mtime selection, 0-byte
  filter, AHP-shape probe rejection, null on empty tree, chmod-000
  resilience.
- `cli-autodiscovery.test.ts` (3 tests, hermetic via `HOME=$tmpdir`):
  no-arg miss → stderr message, no-arg hit → `Watching` line points at
  fixture, explicit path bypasses auto-discovery.

41/41 host-node + CLI tests pass; `pnpm -r typecheck` clean.

## Deviations from plan

- The plan said "normalize throws on non-AHP shapes" — actually `normalize()`
  is total and returns a `kind: 'parse-error'` event on bad shapes. The probe
  checks `event.kind !== 'parse-error'` instead of try/catch.
- `parseLine`'s parsed payload lives at `.raw` (not `.value` as the plan
  stated). Used `.raw`.
- Added `@ahp-inspector/parser` as a workspace dependency of host-node so the
  shape probe can call `parseLine` + `normalize` without a phantom-dep risk.
- The CLI no-arg branch's old in-stdout note ("No log file selected — use the
  picker…") was removed entirely per the plan's "replace the existing stdout
  note" instruction; the friendly stderr note is the sole status indicator on
  miss.

## Self-Check: PASSED

- Host-node tests: 17/17 pass
- CLI tests: 16/16 pass (including 3 new auto-discovery tests, no regressions
  in cli-launch / cli-errors)
- Workspace typecheck: clean
- Manual smoke: `tsx packages/cli/src/index.ts --no-open` (no args) on a
  profile with AHP logs prints `Watching <path>` and starts the server.
