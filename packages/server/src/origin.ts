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
 * VS Code webview origins are accepted only when the request has already
 * presented the server capability. Opaque/null origins are never trusted.
 */
export function isAllowedOrigin(
  origin: string | undefined | null,
  hasValidCapability = false,
): boolean {
  if (origin === undefined || origin === null) return true;
  if (origin === "" || origin === "null") return false;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol === "vscode-webview:") {
    return (
      hasValidCapability &&
      url.hostname.length > 0 &&
      url.username === "" &&
      url.password === "" &&
      (url.pathname === "" || url.pathname === "/") &&
      url.search === "" &&
      url.hash === ""
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return LOOPBACK_HOSTS.has(url.hostname);
}
