// API URL prefixing for the UI bundle. The extension webview needs to hit
// the loopback server on a different origin (http://localhost:{port}); the
// standalone CLI build serves the UI from the same origin and uses relative
// URLs. The extension HTML injects `window.__AHP_API_BASE__` to opt in.
//
// Phase 15: this is the single seam for cross-origin HTTP/SSE access.

declare global {
	interface Window {
		__AHP_API_BASE__?: string;
	}
}

/** Prefix `path` (which must start with `/`) with the configured API base
 *  URL, or return `path` unchanged when no base is set. */
export function apiUrl(path: string): string {
	const base = (typeof window !== "undefined" ? window.__AHP_API_BASE__ : undefined) ?? "";
	if (!base) return path;
	const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
	return `${trimmedBase}${path}`;
}

export {};
