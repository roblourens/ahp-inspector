---
status: testing
phase: 11-vs-code-extension-command-palette-custom-editor
source:
  - 11-01-SUMMARY.md
  - 11-02-SUMMARY.md
  - 11-03-SUMMARY.md
  - 11-04-SUMMARY.md
started: "2026-05-09T15:32:31.673Z"
updated: "2026-05-09T15:32:31.673Z"
---

## Current Test

number: 1
name: Cold Start — Build extension and load in VS Code
expected: |
  From a clean state run `pnpm install && pnpm build`. The build completes
  with no errors. `packages/extension/dist/extension.cjs` exists.
  `packages/extension/ui-dist/assets/main.js` and `main.css` exist.
  Launch VS Code with `code --extensionDevelopmentPath=$(pwd)/packages/extension`
  (or `code-insiders ...`). The Extension Development Host window opens
  with no activation errors in the Output panel.
awaiting: user response

## Tests

### 1. Cold Start — Build extension and load in VS Code
expected: |
  From a clean state run `pnpm install && pnpm build`. The build completes
  with no errors. `packages/extension/dist/extension.cjs` exists.
  `packages/extension/ui-dist/assets/main.js` and `main.css` exist.
  Launch VS Code with `code --extensionDevelopmentPath=$(pwd)/packages/extension`
  (or `code-insiders ...`). The Extension Development Host window opens
  with no activation errors in the Output panel.
result: [pending]

### 2. Command palette registration
expected: |
  In the Extension Development Host, open the Command Palette
  (Cmd+Shift+P / Ctrl+Shift+P) and type "AHP". The command
  "AHP Log Viewer: Open" appears in the list under the
  "AHP Log Viewer" category.
result: [pending]

### 3. Open command creates webview panel
expected: |
  With no AHP-related editor active, run "AHP Log Viewer: Open" from
  the command palette. A new editor tab titled "AHP Log Viewer" opens
  in the active editor column. The viewer UI loads (header / picker
  visible). DevTools console (Help → Toggle Developer Tools) shows no
  CSP violations or asset 404s.
result: [pending]

### 4. Active .jsonl preselects as initial log
expected: |
  Open a real AHP JSONL log in a normal editor tab (e.g. open
  `test/fixtures/long-realistic-ahp.jsonl`), keep it focused, and run
  "AHP Log Viewer: Open". The viewer panel opens already streaming
  that log — timeline shows rows for the file, no manual "open log"
  step required.
result: [pending]

### 5. No-active-log shows discovery picker
expected: |
  Close all editor tabs (or focus a non-JSONL document), then run
  "AHP Log Viewer: Open". The viewer shows the same "no active log"
  picker that browser mode uses, listing discovered VS Code log roots
  (or the manual-path form). Selecting a discovered candidate begins
  streaming.
result: [pending]

### 6. No loopback server is started in extension mode
expected: |
  With the viewer panel open in the Extension Development Host,
  check that `lsof -iTCP -sTCP:LISTEN -P -n | grep -E ':51[0-9]{3}'`
  (or any other "ahp-viewer started at http://127.0.0.1:..." log line)
  shows nothing started by the extension. Data flows over webview
  postMessage only.
result: [pending]

### 7. Standalone browser mode still works
expected: |
  Outside VS Code, run `pnpm exec tsx packages/cli/src/index.ts test/fixtures/long-realistic-ahp.jsonl`.
  The browser opens to the loopback URL and the viewer streams the log
  the same as before Phase 11 — no regression from the transport
  abstraction.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]
