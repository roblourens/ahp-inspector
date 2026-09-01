# Contributing

This is a private development repository. Keep changes small, tested, and aligned
with the architecture and practices in `AGENTS.md`.

## Local setup

1. Install Node.js 22 and pnpm 9.15.
2. Keep the canonical protocol repo at `../agent-host-protocol`.
3. Run `pnpm install`.
4. Use `pnpm start:long` for a realistic local smoke test.

## Before committing

Run the same gate used during active development:

```bash
pnpm test && pnpm -F @ahp-inspector/ui build && pnpm -F ahp-inspector build && pnpm typecheck && pnpm lint
```

For UI-visible changes, also run the app with a fixture log and update
`USER_GUIDE.md` plus screenshots when behavior or visuals change.

## Code conventions

- Use `../agent-host-protocol` for AHP types and concepts; do not redefine
  protocol shapes.
- Keep Node/file-system behavior behind the host adapter boundary.
- Keep parser/core/shared packages portable and free of browser/server imports.
- Use design tokens for UI colors, spacing, and typography.
- Do not commit raw AHP logs, secrets, tokens, or private user data.
