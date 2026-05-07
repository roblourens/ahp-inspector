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

import type { Status } from "@ahp-viewer/core";
import type { AhpEvent } from "@ahp-viewer/shared";
import { Loader2 } from "lucide-react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../state/store.js";
import { type DetailResponse, fetchEvent } from "../../transport/http-client.js";
import { AhpFieldStrip } from "./AhpFieldStrip.js";
import { AuthFailureBanner } from "./AuthFailureBanner.js";
import { CopyMenu } from "./CopyMenu.js";
import { CopyToast } from "./CopyToast.js";
import { DetailResizeHandle } from "./DetailResizeHandle.js";
import { DetailSummary } from "./DetailSummary.js";
import { DetailTabs } from "./DetailTabs.js";
import { PrettyJsonView } from "./PrettyJsonView.js";
import { PrivacyCaption } from "./PrivacyCaption.js";
import { RawJsonView } from "./RawJsonView.js";

interface LoadState {
  status: "idle" | "loading" | "error" | "ok";
  detail: DetailResponse | null;
  error: string | null;
}

export function DetailPanel(): JSX.Element | null {
  const selectedIdx = useAppStore((s) => s.selectedIdx);
  const rows = useAppStore((s) => s.rows);
  const detailWidth = useAppStore((s) => s.detailWidth);
  const setDetailWidth = useAppStore((s) => s.setDetailWidth);

  const [loadState, setLoadState] = useState<LoadState>({
    status: "idle",
    detail: null,
    error: null,
  });
  const [activeTab, setActiveTab] = useState<"pretty" | "raw">("pretty");
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const retryKey = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (idx: number) => {
    // Abort any prior in-flight request (T-03-04-04)
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadState({ status: "loading", detail: null, error: null });

    try {
      const detail = await fetchEvent(idx, controller.signal);
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
    void load(selectedIdx);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [selectedIdx, load]);

  function handleRetry() {
    if (selectedIdx !== null) {
      retryKey.current += 1;
      void load(selectedIdx);
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
          flex: `0 0 ${detailWidth}px`,
          width: `${detailWidth}px`,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border-strong)",
          overflow: "hidden",
        }}
      >
        <DetailResizeHandle width={detailWidth} onResize={setDetailWidth} min={360} max={720} />
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
          flex: `0 0 ${detailWidth}px`,
          width: `${detailWidth}px`,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border-strong)",
          overflow: "hidden",
        }}
      >
        <DetailResizeHandle width={detailWidth} onResize={setDetailWidth} min={360} max={720} />
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
          flex: `0 0 ${detailWidth}px`,
          width: `${detailWidth}px`,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border-strong)",
          overflow: "hidden",
        }}
      >
        <DetailResizeHandle width={detailWidth} onResize={setDetailWidth} min={360} max={720} />
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
            Retry
          </button>
        </div>
      </aside>
    );
  }

  // ── Populated state ──────────────────────────────────────────────────────────
  const detail = loadState.detail;
  if (!detail) return null;

  const event = detail.event as AhpEvent;
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
        flex: `0 0 ${detailWidth}px`,
        width: `${detailWidth}px`,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface)",
        borderLeft: "1px solid var(--color-border-strong)",
        overflow: "hidden",
      }}
    >
      <DetailResizeHandle width={detailWidth} onResize={setDetailWidth} min={360} max={720} />

      {/* Auth failure banner */}
      {isAuthFailure && (
        <AuthFailureBanner
          {...(row?.errorCode !== null && row?.errorCode !== undefined
            ? { code: row.errorCode }
            : {})}
        />
      )}

      {/* Summary */}
      <DetailSummary event={event} latencyMs={liveLatencyMs} status={liveStatus} />

      {/* AHP field strip */}
      {row && <AhpFieldStrip row={row} rawEvent={event} />}

      {/* Tab strip + copy menu header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingRight: "var(--space-3)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <DetailTabs active={activeTab} onChange={setActiveTab} />
        <CopyMenu
          event={event}
          pairEvent={detail.pair as AhpEvent | null}
          latencyMs={liveLatencyMs}
          status={liveStatus}
          onCopy={(msg, ok) => setToast({ message: msg, kind: ok ? "success" : "error" })}
        />
      </div>

      {/* JSON view */}
      <div
        role="tabpanel"
        style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}
      >
        {activeTab === "pretty" ? (
          <PrettyJsonView data={event.raw} onOpenRaw={() => setActiveTab("raw")} />
        ) : (
          <RawJsonView data={event.raw} />
        )}
      </div>

      {/* Privacy caption */}
      <PrivacyCaption />

      {/* Copy toast */}
      {toast && (
        <CopyToast key={toast.message + Date.now()} message={toast.message} kind={toast.kind} />
      )}
    </aside>
  );
}
