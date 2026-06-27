import type { JSX } from "react";
import { findMatchRanges, renderHighlightedSegment } from "./highlight.js";

export function splitHierarchicalEventName(label: string): { prefix: string; leaf: string } | null {
  const slash = label.lastIndexOf("/");
  if (slash <= 0 || slash >= label.length - 1) return null;
  return {
    prefix: label.slice(0, slash + 1),
    leaf: label.slice(slash + 1),
  };
}

export function EventNameLabel({
  label,
  searchQuery,
}: {
  label: string;
  searchQuery: string;
}): JSX.Element {
  const split = splitHierarchicalEventName(label);
  const ranges = findMatchRanges(label, searchQuery);
  const prefixLength = split?.prefix.length ?? 0;
  return (
    <span
      data-testid="event-name-label"
      style={{
        display: "block",
        maxWidth: "100%",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: "16px",
      }}
    >
      {split ? (
        <>
          <span data-testid="event-name-prefix" style={{ color: "var(--color-event-name-prefix)" }}>
            {renderHighlightedSegment(label, 0, prefixLength, ranges)}
          </span>
          <span data-testid="event-name-leaf">
            {renderHighlightedSegment(label, prefixLength, label.length, ranges)}
          </span>
        </>
      ) : (
        renderHighlightedSegment(label, 0, label.length, ranges)
      )}
    </span>
  );
}
