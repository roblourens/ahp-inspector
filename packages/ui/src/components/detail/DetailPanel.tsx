/**
 * DetailPanel — root orchestrator for the event detail view.
 *
 * Reads selectedIdx from the Zustand store. On selectedIdx change,
 * fetches via fetchEvent (with AbortController for T-03-04-04), and
 * updates selectedDetail with loading/error/data transitions.
 *
 * States:
 *   - selectedIdx === null → empty state (§7.2 copy)
 *   - loading → spinner (§7.3)
 *   - error → retry button (§7.4)
 *   - populated → AuthFailureBanner? + Summary + AhpFieldStrip + tabs + JSON + PrivacyCaption
 *
 * No raw #hex literals. No dangerouslySetInnerHTML.
 */

import type { Status } from "@ahp-inspector/core";
import type { AhpEvent, EventKind } from "@ahp-inspector/shared";
import { Loader2 } from "lucide-react";
import { type CSSProperties, type JSX, useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../state/store.js";
import { Z } from "../../styles/zLayers.js";
import { type DetailResponse, fetchEvent } from "../../transport/http-client.js";
import { AhpFieldStrip } from "./AhpFieldStrip.js";
import { AuthFailureBanner } from "./AuthFailureBanner.js";
import { CopyMenu } from "./CopyMenu.js";
import { CopyToast } from "./CopyToast.js";
import { DetailCorrelation } from "./DetailCorrelation.js";
import { DetailResizeHandle } from "./DetailResizeHandle.js";
import { DetailSummary } from "./DetailSummary.js";
import { DetailTabs } from "./DetailTabs.js";
import { DETAIL_MAX_WIDTH, DETAIL_MIN_WIDTH } from "./detail-layout.js";
import { CLIENT_CAP_BYTES, PrettyJsonView } from "./PrettyJsonView.js";
import { PrivacyCaption } from "./PrivacyCaption.js";
import { RawJsonView } from "./RawJsonView.js";
import { StateInspectorPanel } from "./StateInspectorPanel.js";
import { clearPinnedStatePoints, type PinnedStatePoint } from "./state-pins.js";

interface LoadState {
  status: "idle" | "loading" | "error" | "ok";
  detail: DetailResponse | null;
  error: string | null;
}

const KIND_LABEL: Record<EventKind, string> = {
  request: "Request",
  response: "Response",
  "client-notification": "Notification (client)",
  "server-notification": "Notification (server)",
  action: "Action",
  "protocol-notification": "Notification",
  log: "Log",
  "parse-error": "Parse error",
};

/**
 * Returns the (request, response) ordering when the selected event has a
 * paired counterpart so we can render request-on-top, response-below
 * regardless of which row the user clicked. Returns null when there's no
 * pair to stack.
 */
function orderedPair(
  selected: AhpEvent,
  pair: AhpEvent | null,
): { primary: AhpEvent; secondary: AhpEvent } | null {
  if (!pair) return null;
  if (selected.kind === "response" && pair.kind === "request") {
    return { primary: pair, secondary: selected };
  }
  if (selected.kind === "request" && pair.kind === "response") {
    return { primary: selected, secondary: pair };
  }
  // Any other paired combinations (rare): keep selected first.
  return { primary: selected, secondary: pair };
}

interface DetailPanelProps {
  showResizeHandle?: boolean;
  /**
   * When true, the panel fills its parent (used inside the responsive
   * drawer, where the parent controls the width). When false, the panel
   * sizes itself to `detailWidth` (used by the docked desktop rail).
   */
  fill?: boolean;
}

export function DetailPanel({
  showResizeHandle = true,
  fill = false,
}: DetailPanelProps = {}): JSX.Element | null {
  const selectedIdx = useAppStore((s) => s.selectedIdx);
  const logKey = useAppStore((s) => s.logKey);
  const rows = useAppStore((s) => s.rows);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const detailWidth = useAppStore((s) => s.detailWidth);
  const setDetailWidth = useAppStore((s) => s.setDetailWidth);
  const panelSizing: CSSProperties = fill
    ? { flex: "1 1 auto", width: "100%" }
    : { flex: `0 0 ${detailWidth}px`, width: `${detailWidth}px` };

  const [loadState, setLoadState] = useState<LoadState>({
    status: "idle",
    detail: null,
    error: null,
  });
  const [activeTab, setActiveTab] = useState<"pretty" | "raw">("pretty");
  const [pinnedPoints, setPinnedPoints] = useState<readonly PinnedStatePoint[]>([]);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const retryKey = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pinnedLogKeyRef = useRef(logKey);

  const load = useCallback(async (idx: number, activeLogKey: string | null) => {
    // Abort any prior in-flight request (T-03-04-04)
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadState({ status: "loading", detail: null, error: null });

    try {
      const detail = await fetchEvent(idx, controller.signal, activeLogKey);
      if (controller.signal.aborted) return;
      if (detail === null) {
        setLoadState({ status: "error", detail: null, error: `Event #${idx} not found (404)` });
      } else {
        setLoadState({ status: "ok", detail, error: null });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      setLoadState({ status: "error", detail: null, error: msg });
    }
  }, []);

  useEffect(() => {
    if (selectedIdx === null) {
      setLoadState({ status: "idle", detail: null, error: null });
      if (abortRef.current) abortRef.current.abort();
      return;
    }
    void load(selectedIdx, logKey);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [selectedIdx, logKey, load]);

  useEffect(() => {
    if (pinnedLogKeyRef.current === logKey) return;
    pinnedLogKeyRef.current = logKey;
    setPinnedPoints(clearPinnedStatePoints());
  }, [logKey]);

  // D-09 reveal: when a query is active and the Pretty view would hide the
  // first match behind the >256KB truncation banner, switch to Raw (which
  // shows the full text + <mark>). `selectedIdx` is an intentional trigger so
  // the tab recomputes per selection (and a manual tab pick within the same
  // selection/query is preserved).
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedIdx is an intentional per-selection recompute trigger.
  useEffect(() => {
    if (loadState.status !== "ok" || !loadState.detail) return;
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const lowerQ = q.toLowerCase();
    const ev = loadState.detail.event as AhpEvent;
    const pr = loadState.detail.pair as AhpEvent | null;
    const matchHiddenByTruncation = [ev?.raw, pr?.raw].some((d) => {
      if (d === undefined) return false;
      let s: string;
      try {
        s = JSON.stringify(d);
      } catch {
        return false;
      }
      if (s === undefined || s.length <= CLIENT_CAP_BYTES) return false; // Pretty renders it
      return s.toLowerCase().includes(lowerQ); // match is in the elided content
    });
    if (matchHiddenByTruncation) setActiveTab("raw");
  }, [selectedIdx, searchQuery, loadState.status, loadState.detail]);

  function handleRetry() {
    if (selectedIdx !== null) {
      retryKey.current += 1;
      void load(selectedIdx, logKey);
    }
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (selectedIdx === null) {
    return (
      <aside
        data-testid="detail-panel"
        aria-label="Event detail"
        style={{
          position: "relative",
          ...panelSizing,
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-surface)",
          borderLeft: showResizeHandle ? "1px solid var(--color-border-strong)" : "0",
          overflow: "hidden",
        }}
      >
        {showResizeHandle && (
          <DetailResizeHandle
            width={detailWidth}
            onResize={setDetailWidth}
            min={DETAIL_MIN_WIDTH}
            max={DETAIL_MAX_WIDTH}
          />
        )}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            padding: "var(--space-5)",
            color: "var(--color-text-muted)",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-heading-size)",
              fontFamily: "var(--font-sans)",
              fontWeight: "var(--weight-semibold)",
              color: "var(--color-text)",
            }}
          >
            No event selected
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-ui-muted-size)",
              fontFamily: "var(--font-sans)",
            }}
          >
            Select a row in the timeline to inspect its details.
          </p>
        </div>
      </aside>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loadState.status === "loading") {
    return (
      <aside
        data-testid="detail-panel"
        aria-label="Event detail"
        style={{
          position: "relative",
          ...panelSizing,
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-surface)",
          borderLeft: showResizeHandle ? "1px solid var(--color-border-strong)" : "0",
          overflow: "hidden",
        }}
      >
        {showResizeHandle && (
          <DetailResizeHandle
            width={detailWidth}
            onResize={setDetailWidth}
            min={DETAIL_MIN_WIDTH}
            max={DETAIL_MAX_WIDTH}
          />
        )}
        <div
          data-testid="detail-loading"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-2)",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-size)",
          }}
        >
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          Loading event #{selectedIdx}…
        </div>
      </aside>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (loadState.status === "error") {
    return (
      <aside
        data-testid="detail-panel"
        aria-label="Event detail"
        style={{
          position: "relative",
          ...panelSizing,
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-surface)",
          borderLeft: showResizeHandle ? "1px solid var(--color-border-strong)" : "0",
          overflow: "hidden",
        }}
      >
        {showResizeHandle && (
          <DetailResizeHandle
            width={detailWidth}
            onResize={setDetailWidth}
            min={DETAIL_MIN_WIDTH}
            max={DETAIL_MAX_WIDTH}
          />
        )}
        <div
          data-testid="detail-error"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--space-3)",
            padding: "var(--space-5)",
            color: "var(--color-text-muted)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "var(--color-destructive)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-ui-size)",
            }}
          >
            {loadState.error ?? "Failed to load event."}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "4px",
              color: "var(--color-text)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-ui-size)",
              padding: "var(--space-2) var(--space-3)",
            }}
          >
            Retry event details
          </button>
        </div>
      </aside>
    );
  }

  // ── Populated state ──────────────────────────────────────────────────────────
  const detail = loadState.detail;
  if (!detail) return null;

  const event = detail.event as AhpEvent;
  const pairEvent = detail.pair as AhpEvent | null;
  const row = selectedIdx !== null ? (rows[selectedIdx] ?? null) : null;
  const isAuthFailure = row?.isAuthFailure ?? false;

  // WR-03: Prefer live row values for status/latencyMs so that SSE patch updates
  // (pending → ok) are reflected immediately, even on a cache hit.
  const liveStatus = (row?.status ?? detail.status) as Status;
  const liveLatencyMs = row?.latencyMs ?? detail.latencyMs;

  return (
    <aside
      data-testid="detail-panel"
      aria-label="Event detail"
      style={{
        position: "relative",
        ...panelSizing,
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface)",
        borderLeft: showResizeHandle ? "1px solid var(--color-border-strong)" : "0",
        overflow: "hidden",
      }}
    >
      {showResizeHandle && (
        <DetailResizeHandle
          width={detailWidth}
          onResize={setDetailWidth}
          min={DETAIL_MIN_WIDTH}
          max={DETAIL_MAX_WIDTH}
        />
      )}

      {/* Auth failure banner */}
      {isAuthFailure && (
        <AuthFailureBanner
          {...(row?.errorCode !== null && row?.errorCode !== undefined
            ? { code: row.errorCode }
            : {})}
        />
      )}

      {/* Summary */}
      <DetailSummary
        event={event}
        latencyMs={liveLatencyMs}
        status={liveStatus}
        query={searchQuery}
      />

      {/* Correlation metadata */}
      <DetailCorrelation
        currentIdx={selectedIdx}
        event={event}
        pairEvent={pairEvent}
        pairIdx={detail.pairIdx}
        latencyMs={liveLatencyMs}
        status={liveStatus}
      />

      {/* AHP field strip */}
      {row && <AhpFieldStrip row={row} rawEvent={event} />}

      {/* Scrollable lower region: state inspector + tabs + JSON + privacy share one scroll */}
      <div
        data-testid="detail-scroll-region"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <StateInspectorPanel
          idx={selectedIdx}
          logKey={logKey}
          eventLabel={event.method ?? event.actionType ?? event.kind}
          eventTimestamp={event.ts}
          pinnedPoints={pinnedPoints}
          onPinnedPointsChange={setPinnedPoints}
        />

        {/* Tab strip + copy menu header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingRight: "var(--space-3)",
            borderBottom: "1px solid var(--color-border)",
            position: "sticky",
            top: 0,
            background: "var(--color-surface)",
            zIndex: Z.sticky,
          }}
        >
          <DetailTabs active={activeTab} onChange={setActiveTab} />
          <CopyMenu
            event={event}
            pairEvent={pairEvent}
            pairIdx={detail.pairIdx}
            latencyMs={liveLatencyMs}
            status={liveStatus}
            onCopy={(msg, ok) => setToast({ message: msg, kind: ok ? "success" : "error" })}
          />
        </div>

        {/* JSON view — natural height inside the shared scroller. When the
            selected event has a paired counterpart we render request-on-top,
            response-below regardless of which row the user clicked. */}
        <div role="tabpanel" style={{ display: "flex", flexDirection: "column" }}>
          {(() => {
            const ordered = orderedPair(event, pairEvent);
            if (!ordered) {
              return activeTab === "pretty" ? (
                <PrettyJsonView
                  key={`${selectedIdx}:${searchQuery}`}
                  data={event.raw}
                  query={searchQuery}
                  onOpenRaw={() => setActiveTab("raw")}
                />
              ) : (
                <RawJsonView data={event.raw} query={searchQuery} />
              );
            }
            return (
              <>
                <DetailJsonSection
                  label={KIND_LABEL[ordered.primary.kind]}
                  data={ordered.primary.raw}
                  activeTab={activeTab}
                  query={searchQuery}
                  selectedIdx={selectedIdx}
                  onOpenRaw={() => setActiveTab("raw")}
                />
                <DetailJsonSection
                  label={KIND_LABEL[ordered.secondary.kind]}
                  data={ordered.secondary.raw}
                  activeTab={activeTab}
                  query={searchQuery}
                  selectedIdx={selectedIdx}
                  onOpenRaw={() => setActiveTab("raw")}
                />
              </>
            );
          })()}
        </div>

        {/* Privacy caption */}
        <PrivacyCaption />
      </div>

      {/* Copy toast */}
      {toast && (
        <CopyToast key={toast.message + Date.now()} message={toast.message} kind={toast.kind} />
      )}
    </aside>
  );
}

interface DetailJsonSectionProps {
  label: string;
  data: unknown;
  activeTab: "pretty" | "raw";
  query: string;
  selectedIdx: number;
  onOpenRaw: () => void;
}

function DetailJsonSection({
  label,
  data,
  activeTab,
  query,
  selectedIdx,
  onOpenRaw,
}: DetailJsonSectionProps): JSX.Element {
  return (
    <section
      data-testid={`detail-json-section-${label.toLowerCase().replace(/\s+/g, "-")}`}
      style={{ display: "flex", flexDirection: "column" }}
    >
      <h3
        style={{
          margin: 0,
          padding: "var(--space-2) var(--space-3)",
          fontSize: "var(--text-ui-muted-size)",
          fontFamily: "var(--font-sans)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        {label}
      </h3>
      {activeTab === "pretty" ? (
        <PrettyJsonView
          key={`${selectedIdx}:${query}:${label}`}
          data={data}
          query={query}
          onOpenRaw={onOpenRaw}
        />
      ) : (
        <RawJsonView data={data} query={query} />
      )}
    </section>
  );
}
