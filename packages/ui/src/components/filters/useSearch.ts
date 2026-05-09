import { useEffect, useRef } from "react";
import { useAppStore } from "../../state/store.js";
import { searchEvents } from "../../transport/search-client.js";

const DEBOUNCE_MS = 150;

/**
 * Call inside FilterBar or a top-level component.
 * Watches searchQuery from store; debounces 150ms;
 * on each new query, aborts the previous request and fetches new results.
 * On empty query, clears volatile search results (match-all = no server call).
 *
 * T-03-05-01: Each query change creates a new AbortController; previous one is
 * aborted; useEffect cleanup also aborts on unmount (listener-leak mitigation).
 */
export function useSearch(): void {
  const query = useAppStore((s) => s.searchQuery);
  const clearSearchResults = useAppStore((s) => s.clearSearchResults);
  const setSearchPending = useAppStore((s) => s.setSearchPending);
  const setSearchResult = useAppStore((s) => s.setSearchResult);
  const setSearchError = useAppStore((s) => s.setSearchError);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query) {
      // Empty query — clear matches immediately; cancel any in-flight request.
      abortRef.current?.abort();
      abortRef.current = null;
      clearSearchResults();
      return;
    }
    timerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearchPending();
      searchEvents(query, ctrl.signal)
        .then((r) => setSearchResult(r.matches, r.total, r.truncated))
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === "AbortError") return;
          console.error("[useSearch]", err);
          setSearchError(err instanceof Error ? err.message : String(err));
        });
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort(); // cancel any in-flight request immediately
      abortRef.current = null;
    };
  }, [query, clearSearchResults, setSearchError, setSearchPending, setSearchResult]);
}
