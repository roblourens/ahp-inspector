# Phase 11: VS Code extension command palette webview - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 delivers a VS Code extension experience for AHP Inspector: a command palette command opens the viewer in a VS Code webview, preferably with the most recently active AHP JSONL log preselected when one is available, while preserving the existing local-first privacy posture. Despite the roadmap title's original wording, this phase is not a VS Code `CustomEditorProvider` phase.

</domain>

<decisions>
## Implementation Decisions

### VS Code Surface
- **D-01:** Build a command-created VS Code webview as the first extension surface.
- **D-02:** Do not implement VS Code `CustomEditorProvider` or file association behavior in this phase; treat that as future work unless planning finds it is required for the command webview.
- **D-03:** The command must be available from the command palette and should open the viewer directly, not route users through a browser.

### Runtime and Transport
- **D-04:** Prefer a direct webview-to-extension-host transport using VS Code webview `postMessage`, not an embedded loopback HTTP/SSE server inside VS Code.
- **D-05:** The planner should investigate the smallest transport abstraction needed so the existing React UI can run against either the current HTTP/SSE browser transport or the new VS Code webview transport without duplicating feature logic.
- **D-06:** Preserve local-only behavior: no telemetry, no CDN assets, and no outbound network calls. Log contents stay on the user's machine and flow only between the extension host and its webview.

### Command Behavior
- **D-07:** The command palette command should open the webview immediately.
- **D-08:** If the active editor is a JSONL AHP log, the webview should open that log by default.
- **D-09:** If there is no active log-like file, the webview should show the existing log discovery/open options rather than requiring a file picker before the webview appears.

### Packaging Boundary
- **D-10:** Aim for a publishable VS Code extension shape, including manifest metadata, command contribution, activation events, webview packaging, and test coverage appropriate for review.
- **D-11:** Marketplace polish such as final branding assets, gallery presentation, and release automation can be planned separately if they would distract from proving the extension experience.

### the agent's Discretion
- The user explicitly said to decide the runtime details, while noting that direct `postMessage` seemed better. Agents may choose the exact transport boundary, message schema, and UI adapter shape as long as the implementation stays aligned with D-04 and keeps browser mode working.
- Agents may choose how to detect an "AHP JSONL log" from the active editor, balancing accuracy with a simple first implementation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context and Constraints
- `.planning/PROJECT.md` — Project value, local-first positioning, and future VS Code extension boundary.
- `.planning/STATE.md` — Current milestone state and recent phase history.
- `.planning/ROADMAP.md` — Phase 11 roadmap entry and dependency on Phase 10.
- `.planning/REQUIREMENTS.md` — v1.1 requirements already completed; useful to avoid re-scoping reducer/state work into Phase 11.
- `SECURITY.md` — Local-only security expectations and privacy posture.
- `USER_GUIDE.md` — Existing standalone user flow and discovery/open behavior.

### Existing Runtime Boundaries
- `packages/cli/src/index.ts` — Current standalone CLI launch behavior, UI dist lookup, loopback server startup, and browser opening.
- `packages/server/src/log-server.ts` — Existing loopback Hono server and API registration.
- `packages/server/src/session-manager.ts` — Active log lifecycle abstraction reusable by extension-host transport.
- `packages/host-node/src/host-adapter.ts` — Node host adapter for discovery, open, and tailing logs.
- `packages/shared/src/host-protocol.ts` — Shared host boundary types.

### UI Transport and App Shell
- `packages/ui/src/App.tsx` — Current UI startup path and no-log/no-server state handling.
- `packages/ui/src/transport/sessions-client.ts` — Current HTTP session discovery/open client.
- `packages/ui/src/transport/sse-client.ts` — Current SSE log stream client.
- `packages/ui/src/components/states/NoActiveLogState.tsx` — Existing discovery/open UI to reuse inside the webview.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createLogSessionManager` in `packages/server/src/session-manager.ts`: owns active log open/close lifecycle and can likely be reused behind a VS Code message transport.
- `NodeHostAdapter` in `packages/host-node/src/host-adapter.ts`: already implements discovery, open, and file tailing over local paths.
- UI discovery/open state in `packages/ui/src/App.tsx` and `NoActiveLogState`: should remain the fallback when no active JSONL log is detected.
- Existing parser/core/server projection code: should remain portable and not depend on VS Code APIs.

### Established Patterns
- The browser UI currently assumes same-origin `/api/*` fetches plus EventSource SSE. Phase 11 likely needs a small transport seam so the UI can swap HTTP/SSE for webview messaging.
- Existing server code binds to `127.0.0.1` and guards Host headers; this remains a useful standalone mode but should not be the default VS Code extension runtime for Phase 11.
- Workspace packages are private pnpm packages with TypeScript project references/build scripts; a new extension package should follow the monorepo style.

### Integration Points
- Add a new VS Code extension package rather than mixing extension host code into `packages/ui` or `packages/server`.
- The webview needs bundled UI assets, CSP-safe resource URIs, and message handlers in the extension host.
- Active editor detection should happen in extension host command code, then pass an optional initial log path into the webview/session layer.

</code_context>

<specifics>
## Specific Ideas

- The command palette command opens the webview directly.
- If possible, the most recently active JSONL AHP log should be selected by default.
- The page itself should continue to show log options, so the command does not need to block on a picker.
- The extension should be shaped as publishable, even if final marketplace polish is deferred.

</specifics>

<deferred>
## Deferred Ideas

- VS Code `CustomEditorProvider` registration and file association behavior are deferred; the user clarified they likely used "custom editor" imprecisely and wants a webview.
- Final marketplace polish, release automation, and gallery assets can be deferred if they slow down the first usable extension experience.

</deferred>

---

*Phase: 11-vs-code-extension-command-palette-custom-editor*
*Context gathered: 2026-05-08*