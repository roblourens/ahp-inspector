// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid uses divs so rows can be absolutely positioned.

import { type EventRow as EventRowData, formatSessionShort } from "@ahp-viewer/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, JSX } from "react";
import { useEffect, useMemo, useRef } from "react";
import type { VirtualItem } from "../../state/selectors.js";
import { EventRow, TIMELINE_GRID_COLUMNS } from "./EventRow.js";
import { GapBannerRow } from "./GapBannerRow.js";
import { GroupHeaderRow } from "./GroupHeaderRow.js";
import { ParseErrorRow } from "./ParseErrorRow.js";

const ITEM_HEIGHT = {
  row: 28,
  "parse-error": 28,
  header: 24,
  "gap-banner": 20,
} as const;

const COLUMN_LABELS = [
  { key: "rail", label: "", ariaLabel: "row state" },
  { key: "id", label: "ID", ariaLabel: "Request or event ID" },
  { key: "time", label: "Time", ariaLabel: "Time" },
  { key: "direction", label: "Dir", ariaLabel: "Direction" },
  { key: "kind", label: "Kind", ariaLabel: "Kind" },
  { key: "event", label: "Event", ariaLabel: "Event" },
  { key: "session", label: "Session", ariaLabel: "Session" },
  { key: "turn", label: "Turn", ariaLabel: "Turn" },
  { key: "latency", label: "Latency", ariaLabel: "Latency" },
  { key: "summary", label: "Summary", ariaLabel: "Parsed event summary" },
] as const;

function getItemKindKey(item: VirtualItem): keyof typeof ITEM_HEIGHT {
  if (item.kind === "header") return "header";
  if (item.kind === "gap-banner") return "gap-banner";
  return "row";
}

export interface TimelineListProps {
  items: VirtualItem[];
  rows: EventRowData[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  searchQuery?: string;
  onTopGroupChange?: (group: { level: "session" | "turn"; label: string } | null) => void;
  groupCollapsed?: Set<string>;
  onToggleGroup?: (key: string) => void;
}

export function TimelineList({
  items,
  rows,
  selectedIdx,
  onSelect,
  searchQuery = "",
  onTopGroupChange,
  groupCollapsed,
  onToggleGroup,
}: TimelineListProps): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
  const visibleRowIdxs = useMemo(() => {
    const visible = new Set<number>();
    for (const item of items) {
      if (item.kind === "row") {
        const row = rows[item.rowIdx];
        if (row) visible.add(row.idx);
      }
    }
    return visible;
  }, [items, rows]);
  const selectedRow = selectedIdx !== null ? rows[selectedIdx] : undefined;
  const selectedPairIdx = selectedRow?.pairIdx ?? null;
  const selectedPairVisible = selectedPairIdx !== null && visibleRowIdxs.has(selectedPairIdx);
  const hiddenPairKind =
    selectedPairIdx !== null && !selectedPairVisible
      ? selectedRow?.kind === "response"
        ? "request"
        : "response"
      : null;
  const v = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      const item = items[i];
      if (!item) return 28;
      return ITEM_HEIGHT[getItemKindKey(item)] ?? 28;
    },
    overscan: 12,
  });

  // Compute topmost visible group for StickyGroupBar.
  const virtualItems = v.getVirtualItems();
  const topGroup = useMemo(() => {
    if (virtualItems.length === 0) return null;
    const firstVi = virtualItems[0];
    if (firstVi === undefined) return null;
    // Scan backward from firstVi.index to find the most recent header.
    for (let i = firstVi.index; i >= 0; i--) {
      const item = items[i];
      if (item === undefined) continue;
      if (item.kind === "header") {
        const label =
          item.level === "session"
            ? `Session ${formatSessionShort(item.sessionId)}`
            : `↳ Turn ${(item.turnId ?? "").slice(-6)}`;
        return { level: item.level, label };
      }
    }
    return null;
  }, [virtualItems, items]);

  // Notify parent of topmost group change (for StickyGroupBar).
  const prevTopGroupRef = useRef<typeof topGroup>(null);
  useEffect(() => {
    const prev = prevTopGroupRef.current;
    const changed = prev?.label !== topGroup?.label || prev?.level !== topGroup?.level;
    if (changed && onTopGroupChange) {
      onTopGroupChange(topGroup);
    }
    prevTopGroupRef.current = topGroup;
  }, [topGroup, onTopGroupChange]);

  const headerCellStyle: CSSProperties = {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <div
      data-testid="timeline-list-shell"
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
    >
      <div
        role="row"
        tabIndex={-1}
        data-testid="timeline-column-header"
        style={{
          display: "grid",
          gridTemplateColumns: TIMELINE_GRID_COLUMNS,
          alignItems: "center",
          height: 24,
          padding: "3px 8px",
          flexShrink: 0,
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-ui-muted-size)",
          fontWeight: "var(--weight-semibold)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {COLUMN_LABELS.map(({ key, label, ariaLabel }) => (
          <div
            key={key}
            role="columnheader"
            aria-label={ariaLabel}
            tabIndex={-1}
            style={headerCellStyle}
          >
            {label}
          </div>
        ))}
      </div>
      <div
        ref={parentRef}
        role="grid"
        aria-label="AHP event timeline"
        aria-rowcount={items.length}
        data-testid="timeline-list"
        style={{ flex: 1, minHeight: 0, overflow: "auto", background: "var(--color-bg)" }}
      >
        <div style={{ height: v.getTotalSize(), position: "relative" }}>
          {v.getVirtualItems().map((vi) => {
            const item = items[vi.index];
            if (!item) return null;

            if (item.kind === "header") {
              const style: CSSProperties = {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 24,
                transform: `translateY(${vi.start}px)`,
              };
              return (
                <GroupHeaderRow
                  key={`header-${item.groupKey}`}
                  level={item.level}
                  sessionId={item.sessionId}
                  {...(item.turnId !== undefined ? { turnId: item.turnId } : {})}
                  count={item.count}
                  durationMs={item.durationMs}
                  isCollapsed={groupCollapsed?.has(item.groupKey) ?? false}
                  onToggle={() => onToggleGroup?.(item.groupKey)}
                  virtualStyle={style}
                />
              );
            }

            if (item.kind === "gap-banner") {
              const style: CSSProperties = {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 20,
                transform: `translateY(${vi.start}px)`,
              };
              return (
                <GapBannerRow
                  key={`gap-${item.virtualIdx}`}
                  prev={item.prev}
                  curr={item.curr}
                  virtualStyle={style}
                />
              );
            }

            // kind === "row"
            const row = rows[item.rowIdx];
            if (!row) return null;
            const isSelected = row.idx === selectedIdx;
            const pairHighlight =
              selectedPairIdx !== null && row.idx === selectedPairIdx && selectedPairVisible
                ? row.kind === "response"
                  ? "response"
                  : "request"
                : null;
            const pairHidden = isSelected ? hiddenPairKind : null;
            const style: CSSProperties = {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 28,
              transform: `translateY(${vi.start}px)`,
            };

            return row.kind === "parse-error" ? (
              <ParseErrorRow
                key={row.idx}
                row={row}
                isSelected={isSelected}
                onClick={() => onSelect(row.idx)}
                style={style}
              />
            ) : (
              <EventRow
                key={row.idx}
                row={row}
                isSelected={isSelected}
                onClick={() => onSelect(row.idx)}
                searchQuery={searchQuery}
                pairHighlight={pairHighlight}
                pairHidden={pairHidden}
                style={style}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
