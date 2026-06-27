import type { JSX } from "react";

export interface MatchRange {
  start: number;
  end: number;
}

/**
 * Literal, case-insensitive, non-overlapping match ranges of `query` within `text`.
 *
 * Matching is intentionally literal — it uses `String.prototype.toLowerCase()` +
 * `indexOf` and never compiles a regular expression from the (untrusted) query,
 * so it is ReDoS-safe (T-34-02). Queries shorter than 2 chars return no ranges
 * (D-08).
 */
export function findMatchRanges(text: string, query: string): MatchRange[] {
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

/**
 * Renders `label[segmentStart..segmentEnd)`, wrapping any overlapping `ranges`
 * in `<mark>`. Only escaped React text children are emitted — raw HTML is never
 * injected — so `<script>`-bearing payloads render inert (T-34-01).
 */
export function renderHighlightedSegment(
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

/**
 * Convenience whole-string highlighter for detail views (Plan 04). Computes
 * literal match ranges for `query` and renders `text` with matches in `<mark>`.
 */
export function HighlightedText({ text, query }: { text: string; query: string }): JSX.Element {
  const ranges = findMatchRanges(text, query);
  return renderHighlightedSegment(text, 0, text.length, ranges);
}
