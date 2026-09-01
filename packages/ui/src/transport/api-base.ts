// API URL prefixing for the UI bundle. The extension webview needs to hit
// the loopback server on a different origin (http://localhost:{port}); the
// standalone CLI build serves the UI from the same origin and uses relative
// URLs. The extension HTML injects `window.__AHP_API_BASE__` to opt in.
//
// Phase 15: this is the single seam for cross-origin HTTP/SSE access.

declare global {
  interface Window {
    __AHP_API_BASE__?: string;
    __AHP_API_TOKEN__?: string;
  }
}

const API_TOKEN_QUERY_PARAM = "_ahpToken";

function configuredToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  if (window.__AHP_API_TOKEN__) return window.__AHP_API_TOKEN__;
  if (typeof document === "undefined") return undefined;
  return document.querySelector<HTMLMetaElement>('meta[name="ahp-api-token"]')?.content;
}

/** Prefix `path` (which must start with `/`) with the configured API base
 *  URL, or return `path` unchanged when no base is set. */
export function apiUrl(path: string): string {
  const base = (typeof window !== "undefined" ? window.__AHP_API_BASE__ : undefined) ?? "";
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const url = `${trimmedBase}${path}`;
  const token = configuredToken();
  if (!token) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${API_TOKEN_QUERY_PARAM}=${encodeURIComponent(token)}`;
}
