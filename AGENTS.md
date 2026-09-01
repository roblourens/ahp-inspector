# AHP Inspector contributor guide

## Project

AHP Inspector is a local-first developer GUI for discovering, tailing, searching, and
understanding Agent Host Protocol (AHP) JSONL logs. It ships as a standalone CLI and a VS Code
extension backed by the same browser UI and loopback server.

## Setup and verification

- Use Node.js 22+ and pnpm 9.15.
- Install dependencies with `pnpm install`.
- Run the smallest relevant tests while developing.
- Before finishing a code change, run:

  ```bash
  pnpm typecheck
  pnpm test
  pnpm lint
  pnpm build
  ```

- Run `pnpm e2e` for user-visible or cross-package behavior when the relevant Playwright test is
  self-contained.

## Architecture

- `packages/shared`, `packages/parser`, and `packages/core` are portable TypeScript. Do not import
  Node, DOM, React, Hono, VS Code, or host-adapter code into them.
- Keep filesystem discovery, watching, and reading in `packages/host-node`.
- Keep HTTP and SSE behavior in `packages/server`.
- Keep the React UI browser-only and access host functionality through transport clients.
- The CLI and extension are composition roots. They own startup, shutdown, and resource cleanup.
- Preserve JSON-RPC request/response correlation by request direction and original ID type.
- Design for incremental parsing, bounded memory, large logs, file rotation, and slow clients.

## Protocol source of truth

- `../agent-host-protocol` is authoritative for AHP types, methods, actions, notifications,
  reducers, and schemas.
- Do not invent or hand-edit vendored protocol definitions.
- Use `pnpm sync:ahp` to regenerate `packages/protocol`; see the `sync-ahp-protocol` skill for the
  complete workflow.

## Privacy and security

- Logs may contain prompts, tokens, paths, source code, and model output. Never send log data to
  third parties.
- Keep runtime assets local: no telemetry, analytics, CDN assets, or outbound viewer requests.
- Bind servers to loopback and treat browser-to-loopback requests as untrusted.
- Do not expose absolute paths or raw filesystem errors to the UI.
- Never commit real AHP captures. Fixtures and committed screenshots must be synthetic or scrubbed.
- Real local logs may be used for manual verification, but their contents must not be copied into
  commits, reports, snapshots, or screenshots.

## Coding practices

- Keep changes focused and follow existing package conventions.
- Prefer strict types and validation over `any`, unsafe casts, or unchecked response decoding.
- Reuse existing helpers before adding local alternatives.
- Make resource ownership explicit; dispose watchers, timers, listeners, streams, temp files, and
  servers through the owning lifecycle.
- Do not swallow errors that affect correctness. Return typed errors or show sanitized user-facing
  feedback.
- Bound queues, caches, uploads, scans, and retained payloads.
- Use design tokens for UI color, spacing, typography, and motion.
- Preserve keyboard access, focus behavior, semantics, and reduced-motion support.
- Add tests for behavior changes and regression tests for bug fixes.

## Documentation and releases

- Update `README.md`, `USER_GUIDE.md`, or `SECURITY.md` when behavior visible to users or operators
  changes.
- The npm release workflow is documented by the `release-ahp-inspector` skill.
- Do not publish packages, push branches, create tags, or open pull requests unless the user
  explicitly asks.

