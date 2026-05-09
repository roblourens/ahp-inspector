---
slug: discover-oss-dev-jsonl
date: 2026-05-08
type: quick
---

# Quick: Discover OSS dev AHP JSONL logs

## Description

Make `discoverVsCodeLogs` find AHP traffic produced by Code OSS dev builds, which write
logs under `~/.vscode-oss-agents-dev/logs/<launch>/ahp/*.jsonl`. Restrict discovery to
JSONL files only — drop the legacy `agenthost.*.log` matcher entirely so the picker is
never polluted with non-canonical text logs.

## Scope

- `packages/host-node/src/discovery.ts`
  - Add a third default root: `~/.vscode-oss-agents-dev/logs` with origin `vscode-oss-dev`
    on every platform.
  - Widen the `Origin` type to include `"vscode-oss-dev"`.
  - Remove `FILENAME_RE_LEGACY_AGENTHOST` and the `isLegacy → "low"` pin; only
    `.jsonl` files match now.
- `packages/host-node/src/discovery.test.ts`
  - Update the synthetic-tree expectations: 2 launches × 1 JSONL = 2 candidates,
    no legacy `.log` entries.

## Out of scope

- Discovery of other host families (Cursor, Windsurf, etc.).
- Reordering / re-scoring; the existing tier function is unchanged.

## Verification

- `pnpm -F @ahp-inspector/host-node typecheck`
- `pnpm vitest run packages/host-node/src/discovery.test.ts`
- Live smoke against `~/.vscode-oss-agents-dev/logs/`: confirm only `.jsonl`
  candidates, all with `vscode-oss-dev` origin.
