// origin.ts — strict allow-list for the browser `Origin` header.
//
// The server binds to 127.0.0.1 and the host-guard only checks the `Host`
// header (always loopback for a direct request), so a malicious page can still
// *send* requests to http://127.0.0.1:<port>. To stop it from *reading*
// responses or driving state-changing routes, CORS only grants access to — and
// mutating requests are only accepted from — origins on this list.

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * True when `origin` may be granted CORS access / allowed to mutate state.
 *
 * Allowed:
 *  - missing origin (same-origin browser GET, or a non-browser client),
 *  - `http(s)://127.0.0.1[:port]` / `http(s)://localhost[:port]` / IPv6 `[::1]`,
 *  - `vscode-webview://*` (VS Code webview panels — opaque per-panel guid),
 *  - the literal string `null` (sandboxed / `srcdoc` webview).
 */
export function isAllowedOrigin(origin: string | undefined | null): boolean {
  if (origin === undefined || origin === null || origin === "") return true;
  if (origin === "null") return true;
  if (origin.startsWith("vscode-webview://")) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return LOOPBACK_HOSTS.has(url.hostname);
}
