export interface SearchResult {
  matches: number[];
  total: number;
  truncated: boolean;
}

/**
 * Fetch search results from the server.
 * Respects AbortSignal; throws DOMException AbortError on cancel (caller handles).
 * No Node.js imports — browser-only fetch API only.
 */
export async function searchEvents(
  q: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const params = new URLSearchParams({ q, limit: "5000" });
  // exactOptionalPropertyTypes: only include signal property when it's defined,
  // because RequestInit.signal is AbortSignal | null (not | undefined).
  const init: RequestInit = {
    ...(signal !== undefined ? { signal } : {}),
  };
  const resp = await fetch(`/api/log/search?${params.toString()}`, init);
  if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
  return resp.json() as Promise<SearchResult>;
}
