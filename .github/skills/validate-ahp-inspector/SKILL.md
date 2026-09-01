---
name: validate-ahp-inspector
description: Validate AHP Inspector against fixtures and current real AHP logs without leaking sensitive data.
---

# Validate AHP Inspector

Use this workflow for release readiness, parser/replay changes, live-tail changes, or broad UI
verification.

1. Run targeted tests first, then the standard gate:

   ```bash
   pnpm typecheck
   pnpm test
   pnpm lint
   pnpm build
   ```

2. Run relevant Playwright tests for UI-visible behavior.
3. Smoke-test checked-in data with `pnpm start:long`.
4. When available, test a current real capture under `~/.vscode-oss-dev/logs/**` or
   `~/.vscode-oss-agents-dev/logs/**`. Verify parsing, request/response correlation, replay,
   discovery, file growth, rotation, search, and detail rendering as applicable.
5. Treat real captures as sensitive:
   - Do not add them to the repository.
   - Do not quote their payloads, paths, prompts, tokens, or source code in reports.
   - Do not use them for committed snapshots or screenshots.
6. Use synthetic fixtures under `test/fixtures` for committed tests and screenshots. Add a scrubbed
   minimal regression fixture when a real log reveals a bug.
7. Check the worktree before finishing so generated UI bundles, temporary uploads, traces, and real
   log artifacts are not committed.

