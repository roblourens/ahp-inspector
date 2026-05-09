// Webview ↔ extension-host message envelopes (Plan 11-03 Task 1).
//
// Canonical types live in @ahp-inspector/shared so both the extension host
// and the browser-only UI can import them without crossing the package
// boundary (UI may not depend on @ahp-inspector/extension). This shim
// re-exports the protocol for extension-host code.

export type {
  ExtensionNotification,
  WebviewDetailResponse,
  WebviewLogMeta,
  WebviewOpenSessionResult,
  WebviewRequest,
  WebviewResponse,
  WebviewResponseError,
  WebviewResponseSuccess,
  WebviewSafeCandidate,
  WebviewSearchResult,
  WebviewSsePayload,
  WebviewStateAtSuccessResponse,
  WebviewStateResourceKind,
} from "@ahp-inspector/shared";
export { isExtensionNotification } from "@ahp-inspector/shared";
