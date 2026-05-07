import type { JSX } from "react";
import { useEffect } from "react";
import { useAppStore } from "../../state/store.js";
import { connectLogStream } from "../../transport/sse-client.js";
import { DisconnectedBanner } from "../states/DisconnectedBanner.js";
import { EmptyState } from "../states/EmptyState.js";
import { LoadingState } from "../states/LoadingState.js";
import { NoResultsBanner } from "../states/NoResultsBanner.js";
import { TimelineList } from "./TimelineList.js";

export interface TimelineRegionProps {
  onReconnect?: () => void;
}

function defaultReconnect(): void {
  // Tear down any prior handle, then open a fresh one.
  if (typeof window !== "undefined" && window.__ahpStream) {
    try {
      window.__ahpStream.close();
    } catch {
      /* ignore */
    }
  }
  const handle = connectLogStream();
  if (typeof window !== "undefined") window.__ahpStream = handle;
}

export function TimelineRegion({ onReconnect }: TimelineRegionProps = {}): JSX.Element {
  const rows = useAppStore((s) => s.rows);
  const connection = useAppStore((s) => s.connection);
  const meta = useAppStore((s) => s.meta);
  const selectedIdx = useAppStore((s) => s.selectedIdx);
  const select = useAppStore((s) => s.selectIdx);
  const clear = useAppStore((s) => s.clearSelection);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (rows.length === 0) return;
      const cur = selectedIdx ?? -1;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        select(Math.min(rows.length - 1, cur + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        select(Math.max(0, cur - 1));
      } else if (e.key === "PageDown") {
        e.preventDefault();
        select(Math.min(rows.length - 1, cur + 20));
      } else if (e.key === "PageUp") {
        e.preventDefault();
        select(Math.max(0, cur - 20));
      } else if (e.key === "Home") {
        e.preventDefault();
        select(0);
      } else if (e.key === "End") {
        e.preventDefault();
        select(rows.length - 1);
      } else if (e.key === "Escape") {
        clear();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows.length, selectedIdx, select, clear]);

  if (connection === "connecting" && rows.length === 0) {
    return <LoadingState filename={meta?.filename ?? ""} />;
  }
  if (connection === "connected" && rows.length === 0) {
    return <EmptyState />;
  }

  const allParseErrors = rows.length > 0 && rows.every((r) => r.kind === "parse-error");
  return (
    <div
      data-testid="timeline-region"
      style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      {allParseErrors && (
        <NoResultsBanner
          heading="No valid events"
          body={`All ${rows.length} lines in this file failed to parse. Showing parse errors below.`}
        />
      )}
      {connection === "disconnected" && (
        <DisconnectedBanner onReconnect={onReconnect ?? defaultReconnect} />
      )}
      <TimelineList rows={rows} selectedIdx={selectedIdx} onSelect={select} />
    </div>
  );
}
