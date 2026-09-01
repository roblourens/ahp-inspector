/**
 * Tests for RawJsonView query highlighting (Plan 34-04, Task 1).
 *
 * D-08: the active query is highlighted in the Raw view via the shared
 * <mark> highlighter. T-34-01: arbitrary payloads (including "<script>" or
 * "</pre>") render inert — React escapes text children, no markup injection.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RawJsonView } from "./RawJsonView.js";

afterEach(() => cleanup());

describe("RawJsonView — query highlighting", () => {
  it("renders undefined and circular values without throwing", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    const { rerender } = render(<RawJsonView data={undefined} />);
    expect(screen.getByTestId("raw-json-view")).toHaveTextContent("[Undefined value]");

    expect(() => rerender(<RawJsonView data={circular} />)).not.toThrow();
    expect(screen.getByTestId("raw-json-view")).toHaveTextContent(
      "[Circular or non-serializable value]",
    );
  });

  it("wraps each literal query occurrence in a <mark>", () => {
    render(<RawJsonView data={{ sessionId: "session-1", note: "new session" }} query="session" />);
    const pre = screen.getByTestId("raw-json-view");
    const marks = pre.querySelectorAll("mark");
    // "session" appears in the key, the value, and "new session"
    expect(marks.length).toBeGreaterThanOrEqual(3);
    for (const mark of marks) {
      expect(mark.textContent?.toLowerCase()).toBe("session");
    }
  });

  it("renders plain text with no <mark> for an empty query", () => {
    render(<RawJsonView data={{ method: "tools/list" }} query="" />);
    const pre = screen.getByTestId("raw-json-view");
    expect(pre.querySelectorAll("mark")).toHaveLength(0);
  });

  it("renders plain text with no <mark> for a 1-char query", () => {
    render(<RawJsonView data={{ method: "tools/list" }} query="t" />);
    const pre = screen.getByTestId("raw-json-view");
    expect(pre.querySelectorAll("mark")).toHaveLength(0);
  });

  it("matches case-insensitively", () => {
    render(<RawJsonView data={{ method: "Initialize" }} query="initial" />);
    const pre = screen.getByTestId("raw-json-view");
    const marks = pre.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(marks[0]?.textContent).toBe("Initial");
  });

  it("never injects markup for a payload containing </pre> or <script>", () => {
    render(
      <RawJsonView
        data={{ evil: "</pre><script>alert(1)</script>", note: "scripting" }}
        query="script"
      />,
    );
    const pre = screen.getByTestId("raw-json-view");
    // The payload must NOT create a real <script> element.
    expect(pre.querySelector("script")).toBeNull();
    // The literal "script" substrings are highlighted as inert text.
    const marks = pre.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThanOrEqual(1);
    // The escaped angle brackets are present as text.
    expect(pre.textContent).toContain("</script>");
  });
});
