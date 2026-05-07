// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid uses divs so rows can be absolutely positioned.

import type { EventRow as EventRowData } from "@ahp-viewer/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, JSX } from "react";
import { useEffect, useMemo, useRef } from "react";
import type { VirtualItem } from "../../state/selectors.js";
import { EventRow } from "./EventRow.js";
import { GapBannerRow } from "./GapBannerRow.js";
import { GroupHeaderRow } from "./GroupHeaderRow.js";
import { ParseErrorRow } from "./ParseErrorRow.js";

const ITEM_HEIGHT = {
  row: 28,
  "parse-error": 28,
  header: 24,
  "gap-banner": 20,
} as const;

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
  onTopGroupChange?: (group: { level: "session" | "turn"; label: string } | null) => void;
  groupCollapsed?: Set<string>;
  onToggleGroup?: (key: string) => void;
}

export function TimelineList({
  items,
  rows,
  selectedIdx,
  onSelect,
  onTopGroupChange,
  groupCollapsed,
  onToggleGroup,
}: TimelineListProps): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
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
            ? `Session ${item.sessionId.slice(-8)}`
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

  return (
    <div
      ref={parentRef}
      role="grid"
      aria-label="AHP event timeline"
      aria-rowcount={items.length}
      data-testid="timeline-list"
      style={{ height: "100%", overflow: "auto", background: "var(--color-bg)" }}
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
              style={style}
            />
          );
        })}
      </div>
    </div>
  );
}
