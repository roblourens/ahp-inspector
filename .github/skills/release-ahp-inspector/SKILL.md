---
name: release-ahp-inspector
description: Release or publish ahp-inspector to npm, monitor the publish workflow, and verify npm and Git tag state.
argument-hint: "[version, e.g. 1.6.0]"
---

# Release ahp-inspector

Use `.github/workflows/publish.yml` as the production release path. Do not publish locally.

1. Confirm the intended version is already committed in `packages/cli/package.json`.
2. Confirm the release commit is on `main` and the worktree is clean.
3. Run the relevant local verification. The workflow also installs dependencies, typechecks, tests,
   builds, packs, smoke-tests, publishes, and tags.
4. Push `main` only when the user explicitly requested the release.
5. Dispatch without a version override so the tag, source manifest, and npm package stay aligned:

   ```bash
   gh workflow run publish.yml --ref main -f dry_run=false
   ```

6. Find and monitor the run:

   ```bash
   gh run list --workflow publish.yml --limit 1 --json databaseId,status,conclusion,headSha,url
   gh run watch <run-id> --exit-status
   ```

7. If it fails, inspect `gh run view <run-id> --log-failed`, fix the repository cause, and ask before
   pushing or redispatching unless those external actions are already part of the active request.
8. Verify both publication surfaces:

   ```bash
   npm view ahp-inspector version
   git ls-remote --tags origin v<version>
   ```

For a rehearsal, dispatch with `dry_run=true`. Do not use the workflow's optional version input for
a production release; a runner-only version bump creates a tag whose commit contains the wrong
manifest version.
