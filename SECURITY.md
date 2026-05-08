# Security

AHP Log Viewer handles local protocol traffic logs that may include prompts,
tokens, file paths, model output, and other sensitive data.

## Supported versions

This repository is pre-release. Security fixes should target `main`.

## Reporting a vulnerability

Because this is a private repository, report vulnerabilities directly through the
private GitHub issue tracker or to the repository owner. Do not include real log
payloads, credentials, tokens, or other sensitive data in reports unless the
owner explicitly asks for a scrubbed reproduction.

## Local-only expectations

- The app should not send log contents to third-party services.
- The local server should bind to loopback only.
- UI metadata should avoid exposing absolute paths unless the user explicitly
  provided a path for manual open.
- Fixture logs committed to the repo must be synthetic or scrubbed.
