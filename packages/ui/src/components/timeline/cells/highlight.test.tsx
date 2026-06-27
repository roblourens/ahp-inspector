import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { findMatchRanges, HighlightedText } from "./highlight.js";

describe("findMatchRanges — UI-SPEC §Query Highlighting (D-08)", () => {
  it("returns [] when the query is shorter than 2 chars", () => {
    expect(findMatchRanges("Hello world", "o")).toEqual([]);
    expect(findMatchRanges("Hello world", "")).toEqual([]);
  });

  it("matches case-insensitively", () => {
    // "xa" appears (case-insensitively) at index 1 ("XA") and 3 ("xa").
    expect(findMatchRanges("aXAxa", "xa")).toEqual([
      { start: 1, end: 3 },
      { start: 3, end: 5 },
    ]);
  });

  it("produces non-overlapping ranges, advancing past each match", () => {
    expect(findMatchRanges("aaaa", "aa")).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ]);
  });

  it("returns [] when there is no match", () => {
    expect(findMatchRanges("foobar", "zzz")).toEqual([]);
  });

  it("does not treat the query as a regex (literal matching, ReDoS-safe)", () => {
    // "." would match any char if treated as regex; here it must match nothing.
    expect(findMatchRanges("abcdef", "a.")).toEqual([]);
    // A long benign input with a regex-meta query stays literal and fast.
    const haystack = `${"a".repeat(10_000)}b`;
    expect(findMatchRanges(haystack, "ab")).toEqual([{ start: 9_999, end: 10_001 }]);
  });
});

describe("HighlightedText — escaped React rendering (D-08, T-34-01)", () => {
  afterEach(() => cleanup());

  it("wraps the matched substring in a <mark> and the rest as plain text", () => {
    render(<HighlightedText text="Hello world" query="world" />);
    const matched = screen.getByText("world");
    expect(matched.tagName).toBe("MARK");
  });

  it("renders a <script>-bearing payload as inert escaped text, never an injected node", () => {
    const { container } = render(
      <HighlightedText text="<script>alert(1)</script>" query="script" />,
    );
    // The literal characters are present in the DOM…
    expect(container.textContent).toBe("<script>alert(1)</script>");
    // …but no actual <script> element was created.
    expect(container.querySelector("script")).toBeNull();
    // The matched "script" slices are wrapped in <mark>.
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(marks[0]?.textContent).toBe("script");
  });

  it("renders plain text unchanged when there is no match", () => {
    const { container } = render(<HighlightedText text="no match here" query="zzz" />);
    expect(container.textContent).toBe("no match here");
    expect(container.querySelector("mark")).toBeNull();
  });
});
