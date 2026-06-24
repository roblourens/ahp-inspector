// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid uses divs so rows can be absolutely positioned.

import { type EventRow as EventRowData, formatSessionShort } from "@ahp-inspector/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown } from "lucide-react";
import type { CSSProperties, JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VirtualItem } from "../../state/selectors.js";
import { Z } from "../../styles/zLayers.js";
import { buildTimelineGridColumns, EventRow, ID_COLUMN_DEFAULT_WIDTH } from "./EventRow.js";
import { GroupHeaderRow } from "./GroupHeaderRow.js";
import { ParseErrorRow } from "./ParseErrorRow.js";

const ITEM_HEIGHT = {
  row: 24,
  "parse-error": 24,
  header: 24,
} as const;

// ID cells render in the monospace font at the row text size (13px); JetBrains
// Mono advances ~7.8px per glyph. Pad for the 8px cell gutters and clamp so the
// column never collapses below the "ID" header or grows past the 12-char cap.
const ID_CHAR_WIDTH_PX = 7.8;
const ID_COLUMN_PADDING_PX = 14;
const ID_COLUMN_MIN_WIDTH = 36;

/** Width (px) needed to fit the widest ID present in the rows, header included. */
function measureIdColumnWidth(rows: readonly EventRowData[]): number {
  let maxChars = 2; // room for the "ID" header / "\u2014" placeholder
  for (const row of rows) {
    const len = row.keyId?.length ?? 0;
    if (len > maxChars) maxChars = len;
  }
  const fitted = Math.ceil(maxChars * ID_CHAR_WIDTH_PX) + ID_COLUMN_PADDING_PX;
  return Math.min(ID_COLUMN_DEFAULT_WIDTH, Math.max(ID_COLUMN_MIN_WIDTH, fitted));
}

const COLUMN_LABELS = [
  { key: "rail", label: "", ariaLabel: "row state" },
  { key: "id", label: "ID", ariaLabel: "Request or event ID" },
  { key: "time", label: "Time", ariaLabel: "Time" },
  { key: "direction", label: "Dir", ariaLabel: "Direction" },
  { key: "kind", label: "Kind", ariaLabel: "Kind" },
  { key: "event", label: "Event", ariaLabel: "Event" },
  { key: "session", label: "Channel", ariaLabel: "Channel" },
  { key: "turn", label: "Turn", ariaLabel: "Turn" },
  { key: "latency", label: "Latency", ariaLabel: "Latency" },
  { key: "summary", label: "Summary", ariaLabel: "Parsed event summary" },
] as const;

function getItemKindKey(
  item: VirtualItem,
  rows: readonly EventRowData[],
): keyof typeof ITEM_HEIGHT {
  if (item.kind === "header") return "header";
  if (rows[item.rowIdx]?.kind === "parse-error") return "parse-error";
  return "row";
}

export interface TimelineListProps {
  items: VirtualItem[];
  rows: EventRowData[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  searchQuery?: string;
  searchMatches?: Set<number> | null;
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
  searchMatches = null,
  onTopGroupChange,
  groupCollapsed,
  onToggleGroup,
}: TimelineListProps): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const gridColumns = useMemo(() => buildTimelineGridColumns(measureIdColumnWidth(rows)), [rows]);
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
      if (!item) return 24;
      return ITEM_HEIGHT[getItemKindKey(item, rows)] ?? 24;
    },
    overscan: 12,
  });

  // Auto tail-follow: scroll to bottom on first load and on append while the
  // user is parked at the bottom. User scroll-up disables follow; scrolling
  // back to bottom re-enables it. Threshold is generous (4px) to absorb
  // virtualizer rounding.
  const followTailRef = useRef(true);
  const SCROLL_BOTTOM_THRESHOLD_PX = 4;

  const scrollToBottom = useCallback((): void => {
    const el = parentRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    followTailRef.current = true;
    setIsAtBottom(true);
  }, []);

  // Scroll to end whenever item count changes while following. Runs once on
  // initial non-empty mount (followTailRef defaults to true) and on every
  // append after that. Uses rAF so the virtualizer has measured the new total.
  useEffect(() => {
    if (!followTailRef.current) return;
    if (items.length === 0) return;
    const raf = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(raf);
  }, [items.length, scrollToBottom]);

  // Scroll the selected row into view only when it's currently off-screen
  // (e.g., keyboard navigation or search-match jump). Clicking a visible row
  // must not scroll the timeline.
  const lastSelectionScrollIdxRef = useRef<number | null>(null);
  useEffect(() => {
    if (selectedIdx === lastSelectionScrollIdxRef.current) return;
    lastSelectionScrollIdxRef.current = selectedIdx;
    if (selectedIdx === null) return;
    const targetVi = items.findIndex(
      (it) => it.kind === "row" && rows[it.rowIdx]?.idx === selectedIdx,
    );
    if (targetVi < 0) return;
    const visible = v.getVirtualItems();
    if (visible.length > 0) {
      const first = visible[0]?.index ?? 0;
      const last = visible[visible.length - 1]?.index ?? 0;
      // Treat overscan rows as off-screen too: only skip when comfortably
      // inside the visible window.
      const margin = 2;
      if (targetVi >= first + margin && targetVi <= last - margin) {
        return;
      }
    }
    followTailRef.current = false;
    v.scrollToIndex(targetVi, { align: "center" });
  }, [selectedIdx, items, rows, v]);

  const onScroll = useCallback((): void => {
    const el = parentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD_PX;
    followTailRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, []);

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
      className="timeline-list-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div
        ref={parentRef}
        onScroll={onScroll}
        role="grid"
        aria-label="AHP event timeline"
        aria-rowcount={items.length}
        data-testid="timeline-list"
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          background: "var(--color-bg)",
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: "max-content" }}>
          <div
            role="row"
            tabIndex={-1}
            data-testid="timeline-column-header"
            style={{
              display: "grid",
              gridTemplateColumns: gridColumns,
              minWidth: "max-content",
              alignItems: "center",
              height: 24,
              boxSizing: "border-box",
              padding: "3px 8px",
              position: "sticky",
              top: 0,
              zIndex: Z.sticky,
              background: "var(--color-surface)",
              borderBottom: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-ui-muted-size)",
              lineHeight: "16px",
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

              // kind === "row"
              const row = rows[item.rowIdx];
              if (!row) return null;
              const itemHeight = ITEM_HEIGHT[getItemKindKey(item, rows)] ?? 24;
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
                height: itemHeight,
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
                  onSelect={onSelect}
                  searchQuery={searchQuery}
                  isSearchMatch={searchMatches?.has(row.idx) ?? false}
                  pairHighlight={pairHighlight}
                  pairHidden={pairHidden}
                  gridColumns={gridColumns}
                  top={vi.start}
                />
              );
            })}
          </div>
        </div>
      </div>
      {items.length > 0 && !isAtBottom && (
        <button
          type="button"
          aria-label="Scroll to bottom"
          onClick={scrollToBottom}
          style={{
            position: "absolute",
            right: "var(--space-3)",
            bottom: "var(--space-3)",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: 999,
            padding: "var(--space-1) var(--space-2)",
            background: "var(--color-surface-raised)",
            color: "var(--color-text)",
            cursor: "pointer",
            boxShadow: "var(--shadow-menu)",
            zIndex: Z.sticky,
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-muted-size)",
          }}
        >
          <ArrowDown size={14} />
          <span>Bottom</span>
        </button>
      )}
    </div>
  );
}
