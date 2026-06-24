import type { JSX } from "react";

export function splitHierarchicalEventName(label: string): { prefix: string; leaf: string } | null {
  const slash = label.lastIndexOf("/");
  if (slash <= 0 || slash >= label.length - 1) return null;
  return {
    prefix: label.slice(0, slash + 1),
    leaf: label.slice(slash + 1),
  };
}

interface MatchRange {
  start: number;
  end: number;
}

function findMatchRanges(text: string, query: string): MatchRange[] {
  if (query.length < 2) return [];
  const ranges: MatchRange[] = [];
  const lower = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  let last = 0;
  let idx = lower.indexOf(lowerQ, last);
  while (idx !== -1) {
    ranges.push({ start: idx, end: idx + query.length });
    last = idx + query.length;
    idx = lower.indexOf(lowerQ, last);
  }
  return ranges;
}

function renderHighlightedSegment(
  label: string,
  segmentStart: number,
  segmentEnd: number,
  ranges: readonly MatchRange[],
): JSX.Element {
  const text = label.slice(segmentStart, segmentEnd);
  if (ranges.length === 0) return <>{text}</>;

  const parts: JSX.Element[] = [];
  let cursor = segmentStart;
  for (const range of ranges) {
    const start = Math.max(range.start, segmentStart);
    const end = Math.min(range.end, segmentEnd);
    if (end <= segmentStart || start >= segmentEnd) continue;
    if (start > cursor) {
      parts.push(<span key={`t-${cursor}`}>{label.slice(cursor, start)}</span>);
    }
    parts.push(
      <mark
        key={`m-${start}-${end}`}
        style={{
          background: "var(--color-search-match-bg)",
          color: "var(--color-search-match-fg)",
        }}
      >
        {label.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < segmentEnd) {
    parts.push(<span key={`t-${cursor}`}>{label.slice(cursor, segmentEnd)}</span>);
  }

  return <>{parts}</>;
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
        display: "inline-block",
        maxWidth: "100%",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
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
