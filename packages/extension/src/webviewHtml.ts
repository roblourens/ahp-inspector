// CSP-safe webview HTML generator (Plan 11-01 Task 3).
//
// Mitigates T-11-01-02:
//   - default-src 'none'
//   - per-load nonce on the single bundled script
//   - asset URIs come from `webview.asWebviewUri(...)` only (caller passes them in)
//   - never interpolates a user-controlled file path into HTML
//
// Plan 11-03 will inject the initial active-log metadata via postMessage,
// not by serializing it into HTML.

export interface WebviewHtmlOptions {
  /** Webview-scoped URI for the bundled UI script (`asWebviewUri(scriptOnDisk)`). */
  readonly scriptUri: string;
  /** Webview-scoped URI for the bundled UI stylesheet, or null if inlined. */
  readonly stylesheetUri: string | null;
  /** Per-load nonce used by `<script>` and the CSP `script-src` directive. */
  readonly nonce: string;
  /** `webview.cspSource` from the active panel. */
  readonly cspSource: string;
  /** Page title (defaults to "AHP Inspector"). */
  readonly title?: string;
  /**
   * Loopback HTTP origin (e.g. "http://localhost:51234") that the webview
   * will call for /api/* and /health. When set, added to CSP connect-src.
   */
  readonly loopbackOrigin?: string;
  /**
   * API base URL to inject as window.__AHP_API_BASE__ for the UI bundle.
   * Typically equals loopbackOrigin. When set, an inline <script nonce=..>
   * is emitted BEFORE the main bundle.
   */
  readonly apiBaseUrl?: string;
}

const HTML_ESCAPE_RE = /[&<>"']/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

export function generateNonce(): string {
  // Lightweight nonce — 16 hex chars is enough for CSP per-load uniqueness.
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export function renderWebviewHtml(opts: WebviewHtmlOptions): string {
  const title = escapeHtml(opts.title ?? "AHP Inspector");
  const nonce = escapeHtml(opts.nonce);
  const scriptUri = escapeHtml(opts.scriptUri);
  const cspSource = escapeHtml(opts.cspSource);
  const styleHref = opts.stylesheetUri ? escapeHtml(opts.stylesheetUri) : null;

  // CSP rules:
  //   default-src 'none'    → block everything not explicitly allowed
  //   img-src ${cspSource} data:  → bundled icons + base64 assets only
  //   font-src ${cspSource}       → bundled fonts only
  //   style-src ${cspSource} 'unsafe-inline' → Vite emits inline style tags;
  //     the only inline style we ship is the bundled stylesheet link plus
  //     React-injected component styles
  //   script-src 'nonce-${nonce}' → exactly one bundled UI script
  //   connect-src ${cspSource} [+ loopbackOrigin]
  //
  // Backwards compat: when loopbackOrigin/apiBaseUrl are absent, the rendered
  // HTML is byte-identical to the pre-Phase-15 standalone-only output.
  const connectSrc = opts.loopbackOrigin
    ? `${cspSource} ${escapeHtml(opts.loopbackOrigin)}`
    : `${cspSource}`;
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `font-src ${cspSource}`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `connect-src ${connectSrc}`,
  ].join("; ");

  const styleLink = styleHref ? `<link rel="stylesheet" href="${styleHref}" />` : "";
  // JSON.stringify produces a safely-quoted string literal; we additionally
  // escape `<` so any inline `</script>` sequence in attacker-controlled input
  // cannot break out of the inline script. Prepended with a leading newline
  // only when set so backwards-compat (byte-identical output) holds when not.
  const apiBaseScript = opts.apiBaseUrl
    ? `\n<script nonce="${nonce}">window.__AHP_API_BASE__ = ${JSON.stringify(opts.apiBaseUrl).replace(/</g, "\\u003c")};</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
${styleLink}${apiBaseScript}
</head>
<body>
<div id="root"></div>
<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
