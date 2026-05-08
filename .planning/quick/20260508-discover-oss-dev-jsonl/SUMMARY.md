---
slug: discover-oss-dev-jsonl
date: 2026-05-08
status: complete
---

# Summary: Discover OSS dev AHP JSONL logs

## Outcome

Discovery now surfaces AHP JSONL logs from Code OSS dev builds and ignores legacy
`agenthost.*.log` text files entirely.

## Changes

- [packages/host-node/src/discovery.ts](packages/host-node/src/discovery.ts)
  - Added `~/.vscode-oss-agents-dev/logs` as a third default root with origin
    `vscode-oss-dev` (all platforms).
  - Widened the local `Origin` type to `"vscode" | "vscode-insiders" | "vscode-oss-dev"`.
  - Removed `FILENAME_RE_LEGACY_AGENTHOST` and the legacy-tier pin; only files
    matching the JSONL regexes are emitted.
- [packages/host-node/src/discovery.test.ts](packages/host-node/src/discovery.test.ts)
  - Updated the baseline test: 2 launches × 1 JSONL = 2 candidates, asserts no
    `.log` entries leak through.

## Verification

- `pnpm -F @ahp-viewer/host-node typecheck` — clean.
- `pnpm vitest run packages/host-node/src/discovery.test.ts` — 6/6 pass.
- Live smoke against `~/.vscode-oss-agents-dev/logs/` returned 15 `.jsonl`
  candidates tagged `vscode-oss-dev`, no `.log` files.

## Notes

- `LogCandidate.origin` in `@ahp-viewer/shared` is typed as `string`, so the
  shared interface did not need a change.
- Server was restarted to pick up the discovery change (modules import once).
