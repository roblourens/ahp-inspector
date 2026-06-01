/**
 * openInNewTab — open arbitrary text content in a new browser tab via a
 * same-origin Blob URL.
 *
 * Local-first guarantee: content never leaves the machine. We build a Blob and
 * hand the browser an object: URL — no upload, no hosted resource, no network.
 *
 * Reverse-tabnabbing is mitigated with "noopener,noreferrer" so the opened tab
 * has no reference back to this window.
 *
 * Returns false when the browser blocked the popup (window.open === null) so the
 * caller can surface feedback instead of failing silently.
 */
export function openInNewTab(text: string, mime: "application/json" | "text/plain"): boolean {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win === null) {
    URL.revokeObjectURL(url);
    return false;
  }
  // Give the new tab time to load the resource before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
