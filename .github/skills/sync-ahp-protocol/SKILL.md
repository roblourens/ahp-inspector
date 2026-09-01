---
name: sync-ahp-protocol
description: Sync vendored AHP types, reducers, and fixtures from the sibling agent-host-protocol repository.
---

# Sync AHP protocol

Use this workflow when updating `packages/protocol` from `../agent-host-protocol`.

1. Confirm the sibling repository exists and identify its current commit.
2. Inspect the upstream `types/` aggregators and channel directories before syncing. If upstream
   added or removed a channel, update `scripts/sync-agent-host-protocol.ts` so the sync is complete;
   do not silently omit new protocol surfaces.
3. Never hand-edit generated files under `packages/protocol/src` or reducer fixtures under
   `packages/protocol/test-cases`.
4. Run:

   ```bash
   pnpm sync:ahp
   ```

5. Review the generated diff. Confirm `packages/protocol/.ahp-version` and
   `packages/protocol/src/source-info.ts` match the sibling commit.
6. Update handwritten parser, narrowing, replay, summary, and compatibility code for new protocol
   concepts. Do not work around a canonical type that belongs elsewhere; fix the source shape when
   appropriate.
7. Validate:

   ```bash
   pnpm -F @ahp-inspector/protocol test
   pnpm typecheck
   pnpm test
   pnpm lint
   pnpm build
   ```

8. Exercise a current real capture locally when available, without committing or quoting sensitive
   log contents.

