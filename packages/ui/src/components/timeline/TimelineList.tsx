// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid uses divs so rows can be absolutely positioned.

import type { EventRow as EventRowData } from "@ahp-viewer/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, JSX } from "react";
import { useRef } from "react";
import { EventRow } from "./EventRow.js";
import { ParseErrorRow } from "./ParseErrorRow.js";

export interface TimelineListProps {
  rows: EventRowData[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
}

export function TimelineList({ rows, selectedIdx, onSelect }: TimelineListProps): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 12,
  });
  return (
    <div
      ref={parentRef}
      role="grid"
      aria-label="AHP event timeline"
      aria-rowcount={rows.length}
      data-testid="timeline-list"
      style={{ height: "100%", overflow: "auto", background: "var(--color-bg)" }}
    >
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((vi) => {
          const row = rows[vi.index];
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
