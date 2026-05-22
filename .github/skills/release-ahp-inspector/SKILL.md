---
name: release-ahp-inspector
description: 'Release or publish ahp-inspector to npm. Use when preparing an ahp-inspector npm release, running the publish.yml GitHub Action, checking a release action, or verifying the npm version and Git tag after shipping.'
argument-hint: '[version, e.g. 1.3.1]'
---

# Release ahp-inspector

Use the GitHub Actions workflow in `.github/workflows/publish.yml` as the canonical production release path. Do not publish with local `npm publish` or treat `scripts/release.sh` as the authoritative release procedure.

## Standard Release

1. Confirm the intended release version is already committed in `packages/cli/package.json` and the branch intended for release is `main`.
2. Run or inspect the relevant local verification only when needed; the publish action itself runs install, typecheck, tests, builds, pack smoke test, npm publish, and tag creation.
3. Push `main` only when the user explicitly asked to publish or otherwise approved that external side effect.
4. Dispatch the real release workflow without a `version` input when the committed package version is authoritative:

   ```bash
   gh workflow run publish.yml --ref main -f dry_run=false
   ```

5. Capture the new run ID, then monitor it to completion:

   ```bash
   gh run list --workflow publish.yml --limit 1 --json databaseId,status,conclusion,headSha,url | cat
   gh run watch <run-id> --exit-status | cat
   ```

6. If the action fails, inspect the failed logs, fix the repository cause, commit and push the fix with user approval implied only by the active publish request, then redispatch the workflow:

   ```bash
   gh run view <run-id> --log-failed | cat
   ```

7. After a successful action, verify both publication surfaces:

   ```bash
   npm view ahp-inspector version
   git ls-remote --tags origin v<version>
   ```

## Dry Run

For a non-publishing workflow rehearsal, keep the default dry-run behavior or pass it explicitly:

```bash
gh workflow run publish.yml --ref main -f dry_run=true
```

Dry runs skip npm publish and release tag creation.

## Version Input

The workflow exposes a `version` input, but the normal release procedure should leave it blank. Prefer committing the package version before dispatch so Git history, npm metadata, and the eventual `v<version>` tag describe the same release source.