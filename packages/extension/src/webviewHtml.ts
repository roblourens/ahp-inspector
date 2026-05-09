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
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `font-src ${cspSource}`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `connect-src ${cspSource}`,
  ].join("; ");

  const styleLink = styleHref ? `<link rel="stylesheet" href="${styleHref}" />` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
${styleLink}
</head>
<body>
<div id="root"></div>
<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
