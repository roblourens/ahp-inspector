import type { JSX } from "react";
import { useAppStore } from "../../state/store.js";
import { __APP_VERSION__ } from "../../version.js";
import { DetailRailPlaceholder } from "../detail/DetailRailPlaceholder.js";
import { TimelineRegion } from "../timeline/TimelineRegion.js";
import { HeaderBar } from "./HeaderBar.js";
import { SourceStrip } from "./SourceStrip.js";
import { StatusBar } from "./StatusBar.js";

export function AppShell(): JSX.Element {
  const meta = useAppStore((s) => s.meta);
  const connection = useAppStore((s) => s.connection);
  const selectedIdx = useAppStore((s) => s.selectedIdx);
  const rows = useAppStore((s) => s.rows);
  const selectedEvent = selectedIdx != null ? rows[selectedIdx] ?? null : null;
  return (
    <div
      data-testid="app-shell"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <HeaderBar version={__APP_VERSION__} />
      <SourceStrip
        filename={meta?.filename ?? null}
        eventCount={meta?.eventCount ?? 0}
        sessionCount={meta?.sessionCount ?? 0}
      />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <TimelineRegion />
        <DetailRailPlaceholder selectedEvent={selectedEvent} />
      </div>
      <StatusBar
        connection={connection}
        eventCount={meta?.eventCount ?? 0}
        selectedRowIndex={selectedIdx}
      />
    </div>
  );
}
