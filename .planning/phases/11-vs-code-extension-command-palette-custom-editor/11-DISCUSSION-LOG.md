# Phase 11: VS Code extension command palette webview - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 11-vs-code-extension-command-palette-custom-editor
**Areas discussed:** Custom editor shape, Runtime architecture, Command behavior, Packaging boundary

---

## Custom Editor Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Command opens custom editor | Command palette lets user choose/open a log and shows it as a custom editor tab. | |
| File association custom editor | Register `.jsonl`/`.ahp-log` files so opening the file can use AHP Viewer. | |
| Webview panel first | Use a command-created panel, defer custom editor API. | ✓ |

**User's choice:** Webview panel first.
**Notes:** Follow-up clarified: "I think I just want a web view. Maybe I didn't use the term 'custom editor' correctly." CustomEditorProvider is deferred.

---

## Runtime Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse local server | Start the existing loopback server and embed its URL in a webview/custom editor. | |
| Direct webview transport | Adapt UI to talk to extension host via postMessage instead of HTTP/SSE. | ✓ |
| Hybrid abstraction | Add a transport abstraction but initially implement it with the local server. | |

**User's choice:** Direct postMessage transport.
**Notes:** User initially said, "You decide but I think that the post message direction seems better off the top of my head," then confirmed direct postMessage transport.

---

## Command Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Pick log then open viewer | Show VS Code file picker, then open selected log in the custom editor. | |
| Open discovery view | Open viewer without a selected log and use existing discovery UI. | ✓ |
| Use active file if log-like | If editor has a JSONL/log file active, open it; otherwise show picker. | partial |

**User's choice:** Open the webview directly because the page itself shows log options. If possible, open whichever JSONL AHP log is most recently active by default.
**Notes:** The command should not require a picker before opening the webview.

---

## Packaging Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal workspace package | Private pnpm workspace extension with command, activation, and tests only. | |
| Publishable extension | Prepare marketplace-ready metadata, assets, README, and packaging. | ✓ |
| Prototype only | Just enough local extension host code to validate the approach. | |

**User's choice:** Publishable extension.
**Notes:** Final marketplace polish can still be deferred if it is not required to prove the extension experience.

---

## the agent's Discretion

- The user delegated runtime details while preferring direct postMessage; agents should choose the exact transport abstraction and message schema.
- Agents may choose the first practical active-log detection heuristic.

## Deferred Ideas

- VS Code CustomEditorProvider and file association behavior.
- Final marketplace polish, release automation, and gallery assets if they exceed the first usable extension slice.