import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { usePersistEffect } from "../../persistence/persist-effect.js";
import { isFiltersEmpty } from "../../state/filters.js";
import { useFilteredRows, useGroupedItems } from "../../state/selectors.js";
import { useAppStore } from "../../state/store.js";
import {
  fetchCandidates,
  openSessionByCandidate,
  openSessionByPath,
} from "../../transport/sessions-client.js";
import { type ConnectionHandle, connectLogStream } from "../../transport/sse-client.js";
import type { SafeCandidate } from "../../types/safe-candidate.js";
import { __APP_VERSION__ } from "../../version.js";
import { WatchErrorBanner } from "../banners/WatchErrorBanner.js";
import { DETAIL_DESKTOP_BREAKPOINT } from "../detail/detail-layout.js";
import { DetailPanel } from "../detail/index.js";
import { ActiveFilterChips, FilterBar } from "../filters/index.js";
import { useSearch } from "../filters/useSearch.js";
import { LogPickerPanel } from "../picker/LogPickerPanel.js";
import { StickyGroupBar } from "../timeline/StickyGroupBar.js";
import { TimelineRegion } from "../timeline/TimelineRegion.js";
import { HeaderBar } from "./HeaderBar.js";
import { SourceStrip } from "./SourceStrip.js";
import { StatusBar } from "./StatusBar.js";

function getIsDetailDesktop(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia(`(min-width: ${DETAIL_DESKTOP_BREAKPOINT}px)`).matches;
  }
  return window.innerWidth >= DETAIL_DESKTOP_BREAKPOINT;
}

function useIsDetailDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(getIsDetailDesktop);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = (): void => setIsDesktop(getIsDetailDesktop());
    const query =
      typeof window.matchMedia === "function"
        ? window.matchMedia(`(min-width: ${DETAIL_DESKTOP_BREAKPOINT}px)`)
        : null;
    query?.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      query?.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return isDesktop;
}

function replaceLogStream(): ConnectionHandle {
  const previous = typeof window !== "undefined" ? window.__ahpStream : undefined;
  previous?.close();
  const handle = connectLogStream();
  if (typeof window !== "undefined") window.__ahpStream = handle;
  return handle;
}

export function AppShell(): JSX.Element {
  // Phase 4 Plan 06: per-log persistence (single mount).
  usePersistEffect();

  const meta = useAppStore((s) => s.meta);
  const connection = useAppStore((s) => s.connection);
  const rows = useAppStore((s) => s.rows);
  const filters = useAppStore((s) => s.filters);
  const grouping = useAppStore((s) => s.grouping);
  const detailWidth = useAppStore((s) => s.detailWidth);
  const selectedIdx = useAppStore((s) => s.selectedIdx);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const lastWatchError = useAppStore((s) => s.lastWatchError);
  const lastOpenRef = useAppStore((s) => s.lastOpenRef);
  const isDetailDesktop = useIsDetailDesktop();
  const closeDetailDrawer = useCallback((): void => clearSelection(), [clearSelection]);

  // Register debounced search effect
  useSearch();

  // Compute filtered/grouped items for StatusBar and StickyGroupBar
  const filteredRowIdxs = useFilteredRows();
  const groupedItems = useGroupedItems(filteredRowIdxs);

  // Active filters check
  const hasActiveFilters = !isFiltersEmpty(filters);

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
        const result = await openSessionByCandidate(id);
        useAppStore.getState().setLogKey(result.active.logKey);
        useAppStore.getState().setLastOpenRef({ kind: "candidate", id });
        replaceLogStream();
      } finally {
        setPickerOpen(false);
      }
    })();
  }, []);

  const onPickerOpenPath = useCallback(async (path: string): Promise<void> => {
    const result = await openSessionByPath(path);
    useAppStore.getState().setLogKey(result.active.logKey);
    useAppStore.getState().setLastOpenRef({ kind: "path", path });
    replaceLogStream();
    setPickerOpen(false);
  }, []);

  const onWatchErrorRetry = useCallback((): void => {
    replaceLogStream();
    useAppStore.getState().setLastWatchError(null);
  }, []);

  const onWatchErrorReopen = useCallback((): void => {
    void (async () => {
      try {
        if (lastOpenRef?.kind === "candidate") {
          const result = await openSessionByCandidate(lastOpenRef.id);
          useAppStore.getState().setLogKey(result.active.logKey);
        } else if (lastOpenRef?.kind === "path") {
          const result = await openSessionByPath(lastOpenRef.path);
          useAppStore.getState().setLogKey(result.active.logKey);
        }
        useAppStore.getState().setLastWatchError(null);
        replaceLogStream();
      } catch {
        /* swallow — banner stays visible until retry/reopen succeeds */
      }
    })();
  }, [lastOpenRef]);

  // Ref to SearchInput's <input> element for "/" keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);

  // Count group headers in groupedItems for StatusBar
  const groupCount = groupedItems.filter((i) => i.kind === "header").length;

  useEffect(() => {
    if (!isDetailDesktop && selectedIdx !== null) {
      drawerCloseRef.current?.focus();
    }
  }, [isDetailDesktop, selectedIdx]);

  useEffect(() => {
    if (isDetailDesktop || selectedIdx === null) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") closeDetailDrawer();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDetailDrawer, isDetailDesktop, selectedIdx]);

  return (
    <div
      data-testid="app-shell"
      className="app-shell"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <HeaderBar version={__APP_VERSION__} />
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
        onSwitchLog={onToggleSwitchLog}
      />
      <FilterBar searchInputRef={searchInputRef} />
      {hasActiveFilters && <ActiveFilterChips />}
      <div className="app-main" style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div
          className="timeline-pane"
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0 }}
        >
          {grouping !== "none" && stickyGroup && <StickyGroupBar topGroup={stickyGroup} />}
          <TimelineRegion searchInputRef={searchInputRef} onTopGroupChange={setStickyGroup} />
        </div>
        {isDetailDesktop && (
          <div
            data-testid="detail-panel-wrapper"
            className="detail-rail"
            style={{
              flex: `0 0 ${detailWidth}px`,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <DetailPanel />
          </div>
        )}
      </div>
      {!isDetailDesktop && selectedIdx !== null && (
        <div className="detail-drawer-backdrop" data-testid="detail-drawer-backdrop">
          <div
            className="detail-drawer"
            role="dialog"
            aria-label="Event detail"
            data-testid="detail-drawer"
          >
            <button
              type="button"
              className="detail-drawer-close"
              ref={drawerCloseRef}
              onClick={closeDetailDrawer}
            >
              Close details
            </button>
            <DetailPanel showResizeHandle={false} />
          </div>
        </div>
      )}
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
