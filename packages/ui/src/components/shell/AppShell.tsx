import { type JSX, useCallback, useRef, useState } from "react";
import { isFiltersEmpty } from "../../state/filters.js";
import { useFilteredRows, useGroupedItems } from "../../state/selectors.js";
import { useAppStore } from "../../state/store.js";
import {
  fetchCandidates,
  openSessionByCandidate,
  openSessionByPath,
} from "../../transport/sessions-client.js";
import { connectLogStream } from "../../transport/sse-client.js";
import type { SafeCandidate } from "../../types/safe-candidate.js";
import { __APP_VERSION__ } from "../../version.js";
import { WatchErrorBanner } from "../banners/WatchErrorBanner.js";
import { DetailPanel } from "../detail/index.js";
import { ActiveFilterChips, FilterBar } from "../filters/index.js";
import { useSearch } from "../filters/useSearch.js";
import { LogPickerPanel } from "../picker/LogPickerPanel.js";
import { StickyGroupBar } from "../timeline/StickyGroupBar.js";
import { TimelineRegion } from "../timeline/TimelineRegion.js";
import { HeaderBar } from "./HeaderBar.js";
import { SourceStrip } from "./SourceStrip.js";
import { StatusBar } from "./StatusBar.js";

export function AppShell(): JSX.Element {
  const meta = useAppStore((s) => s.meta);
  const connection = useAppStore((s) => s.connection);
  const rows = useAppStore((s) => s.rows);
  const filters = useAppStore((s) => s.filters);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const grouping = useAppStore((s) => s.grouping);
  const detailWidth = useAppStore((s) => s.detailWidth);
  const selectedIdx = useAppStore((s) => s.selectedIdx);
  const lastWatchError = useAppStore((s) => s.lastWatchError);
  const lastOpenRef = useAppStore((s) => s.lastOpenRef);

  // Register debounced search effect
  useSearch();

  // Compute filtered/grouped items for StatusBar and StickyGroupBar
  const filteredRowIdxs = useFilteredRows();
  const groupedItems = useGroupedItems(filteredRowIdxs);

  // Active filters check
  const hasActiveFilters = !isFiltersEmpty(filters) || searchQuery !== "";

  // StickyGroupBar state — updated via onTopGroupChange callback from TimelineList
  const [stickyGroup, setStickyGroup] = useState<{
    level: "session" | "turn";
    label: string;
  } | null>(null);

  // Switch-log picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCandidates, setPickerCandidates] = useState<readonly SafeCandidate[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const refreshPickerCandidates = useCallback(async (): Promise<void> => {
    setPickerLoading(true);
    try {
      const list = await fetchCandidates();
      setPickerCandidates(list);
    } catch {
      setPickerCandidates([]);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const onToggleSwitchLog = useCallback((): void => {
    setPickerOpen((open) => {
      const next = !open;
      if (next) void refreshPickerCandidates();
      return next;
    });
  }, [refreshPickerCandidates]);

  const onPickerSelect = useCallback((id: string): void => {
    void (async () => {
      try {
        await openSessionByCandidate(id);
        useAppStore.getState().setLastOpenRef({ kind: "candidate", id });
        // Server emits log-reset → snapshot-begin/end on the existing stream.
        // If the stream is closed, reopen it.
        if (typeof window !== "undefined" && !window.__ahpStream) {
          window.__ahpStream = connectLogStream();
        }
      } finally {
        setPickerOpen(false);
      }
    })();
  }, []);

  const onPickerOpenPath = useCallback(async (path: string): Promise<void> => {
    await openSessionByPath(path);
    useAppStore.getState().setLastOpenRef({ kind: "path", path });
    if (typeof window !== "undefined" && !window.__ahpStream) {
      window.__ahpStream = connectLogStream();
    }
    setPickerOpen(false);
  }, []);

  const onWatchErrorRetry = useCallback((): void => {
    if (typeof window !== "undefined") {
      window.__ahpStream?.close();
    }
    const handle = connectLogStream();
    if (typeof window !== "undefined") window.__ahpStream = handle;
    useAppStore.getState().setLastWatchError(null);
  }, []);

  const onWatchErrorReopen = useCallback((): void => {
    void (async () => {
      try {
        if (lastOpenRef?.kind === "candidate") {
          await openSessionByCandidate(lastOpenRef.id);
        } else if (lastOpenRef?.kind === "path") {
          await openSessionByPath(lastOpenRef.path);
        }
        useAppStore.getState().setLastWatchError(null);
        if (typeof window !== "undefined" && !window.__ahpStream) {
          window.__ahpStream = connectLogStream();
        }
      } catch {
        /* swallow — banner stays visible until retry/reopen succeeds */
      }
    })();
  }, [lastOpenRef]);

  // Ref to SearchInput's <input> element for "/" keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Count group headers in groupedItems for StatusBar
  const groupCount = groupedItems.filter((i) => i.kind === "header").length;

  return (
    <div
      data-testid="app-shell"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <HeaderBar version={__APP_VERSION__} onSwitchLog={onToggleSwitchLog} />
      {lastWatchError && (
        <WatchErrorBanner
          code={lastWatchError.code}
          onRetry={onWatchErrorRetry}
          onReopen={onWatchErrorReopen}
        />
      )}
      <SourceStrip
        filename={meta?.filename ?? null}
        eventCount={meta?.eventCount ?? 0}
        sessionCount={meta?.sessionCount ?? 0}
      />
      <FilterBar searchInputRef={searchInputRef} />
      {hasActiveFilters && <ActiveFilterChips />}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {grouping !== "none" && stickyGroup && <StickyGroupBar topGroup={stickyGroup} />}
          <TimelineRegion searchInputRef={searchInputRef} onTopGroupChange={setStickyGroup} />
        </div>
        <div
          data-testid="detail-panel-wrapper"
          style={{
            flex: `0 0 ${detailWidth}px`,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <DetailPanel />
        </div>
      </div>
      <StatusBar
        connection={connection}
        eventCount={meta?.eventCount ?? 0}
        selectedRowIndex={selectedIdx}
        visibleCount={filteredRowIdxs.length}
        totalCount={rows.length}
        groupCount={grouping !== "none" ? groupCount : 0}
      />
      <LogPickerPanel
        open={pickerOpen}
        candidates={pickerCandidates}
        isLoading={pickerLoading}
        onSelect={onPickerSelect}
        onOpenPath={onPickerOpenPath}
        onRefresh={() => void refreshPickerCandidates()}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
