import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PrettyJsonView } from "./PrettyJsonView.js";

afterEach(() => cleanup());

describe("PrettyJsonView", () => {
  it("uses AHP themed JSON classes instead of library defaults", () => {
    const { container } = render(<PrettyJsonView data={{ method: "initialize", ok: true }} />);

    expect(screen.getByTestId("pretty-json-view")).toBeInTheDocument();
    expect(container.querySelector(".ahp-json-container")).toBeTruthy();
    expect(container.querySelector(".ahp-json-label")).toBeTruthy();
    expect(container.querySelector(".ahp-json-boolean")).toBeTruthy();
  });

  it("keeps object nodes expandable and collapsible", () => {
    const { container } = render(
      <PrettyJsonView data={{ params: { resource: "ahp:/sessions" } }} />,
    );
    expect(screen.getByText('"ahp:/sessions"')).toBeInTheDocument();

    const paramsLabel = Array.from(container.querySelectorAll(".ahp-json-clickable-label")).find(
      (node) => node.textContent?.includes("params"),
    );
    expect(paramsLabel).toBeTruthy();

    fireEvent.click(paramsLabel as Element);
    expect(screen.queryByText('"ahp:/sessions"')).toBeNull();

    fireEvent.click(paramsLabel as Element);
    expect(screen.getByText('"ahp:/sessions"')).toBeInTheDocument();
  });

  it("expands nested AHP fields by default through level four", () => {
    render(
      <PrettyJsonView
        data={{
          params: {
            action: {
              toolCall: {
                args: {
                  uri: "safe-resource.md",
                },
              },
            },
          },
        }}
      />,
    );
    expect(screen.getByText('"safe-resource.md"')).toBeInTheDocument();
  });
});

describe("PrettyJsonView — stable expansion across unrelated rerenders", () => {
  it("preserves a manually-collapsed node across a rerender with unchanged data/query", () => {
    const data = { params: { resource: "ahp:/sessions" } };
    const { container, rerender } = render(<PrettyJsonView data={data} />);
    expect(screen.getByText('"ahp:/sessions"')).toBeInTheDocument();

    const paramsLabel = Array.from(container.querySelectorAll(".ahp-json-clickable-label")).find(
      (node) => node.textContent?.includes("params"),
    );
    expect(paramsLabel).toBeTruthy();

    // Manually collapse the node the user opened by default.
    fireEvent.click(paramsLabel as Element);
    expect(screen.queryByText('"ahp:/sessions"')).toBeNull();

    // Simulate an unrelated parent rerender (e.g. a live `rows` store update)
    // with the exact same `data`/`query` props — a fresh object reference is
    // used to mirror how a parent's re-render typically produces new props,
    // while representing the same logical content.
    rerender(<PrettyJsonView data={{ params: { resource: "ahp:/sessions" } }} />);

    // The user's manual collapse must be preserved, not reset back to the
    // shouldExpandNode default (which would re-expand this level-1 node).
    expect(screen.queryByText('"ahp:/sessions"')).toBeNull();
  });

  it("preserves a manually-expanded deep node across a rerender with unchanged data/query", () => {
    const data = { a: { b: { c: { d: { e: { f: "deep-value" } } } } } };
    const { container, rerender } = render(<PrettyJsonView data={data} />);
    // Level-6 value is beyond the level<5 default, so it starts collapsed.
    expect(screen.queryByText('"deep-value"')).toBeNull();

    // Manually expand collapsed ancestors, deepest-first, until the target
    // value is revealed.
    let guard = 0;
    while (screen.queryByText('"deep-value"') === null && guard++ < 10) {
      const collapsedLabels = Array.from(container.querySelectorAll(".ahp-json-clickable-label"));
      const deepest = collapsedLabels[collapsedLabels.length - 1];
      expect(deepest).toBeTruthy();
      fireEvent.click(deepest as Element);
    }
    expect(screen.getByText('"deep-value"')).toBeInTheDocument();

    // Unrelated rerender with the same data/query — expansion must persist.
    rerender(<PrettyJsonView data={{ a: { b: { c: { d: { e: { f: "deep-value" } } } } } }} />);
    expect(screen.getByText('"deep-value"')).toBeInTheDocument();
  });

  it("still recomputes expansion when query changes on rerender", () => {
    const data = { a: { b: { c: { d: { e: { needle: "the-secret-needle" } } } } } };
    const { rerender } = render(<PrettyJsonView data={data} query="nomatch" />);
    // Non-matching query: default cutoff for hasQuery is level<1, so the deep
    // node stays collapsed.
    expect(screen.queryByText('"the-secret-needle"')).toBeNull();

    // Intentional query change must still recompute expansion (not be
    // "frozen" by the stability fix).
    rerender(<PrettyJsonView data={data} query="needle" />);
    expect(screen.getByText('"the-secret-needle"')).toBeInTheDocument();
  });
});

describe("PrettyJsonView — match-aware expansion (D-09)", () => {
  it("expands a deep node whose serialized value contains the query", () => {
    render(
      <PrettyJsonView
        data={{
          a: { b: { c: { d: { e: { needle: "the-secret-needle" } } } } },
        }}
        query="needle"
      />,
    );
    // Without match-aware expansion this level-6 value would stay collapsed
    // (default cutoff is level < 5). The query forces the path open.
    expect(screen.getByText('"the-secret-needle"')).toBeInTheDocument();
  });

  it("collapses a deep subtree that does not contain the query", () => {
    render(
      <PrettyJsonView
        data={{
          match: { deep: { path: { to: { needle: "found-needle" } } } },
          other: { deep: { path: { to: { value: "no-match-here" } } } },
        }}
        query="needle"
      />,
    );
    // The matching branch is revealed…
    expect(screen.getByText('"found-needle"')).toBeInTheDocument();
    // …but the non-matching deep branch stays collapsed.
    expect(screen.queryByText('"no-match-here"')).toBeNull();
  });

  it("falls back to the level<5 default when query is shorter than 2 chars", () => {
    render(
      <PrettyJsonView
        data={{ params: { action: { toolCall: { args: { uri: "x.md" } } } } }}
        query="x"
      />,
    );
    expect(screen.getByText('"x.md"')).toBeInTheDocument();
  });
});

describe("PrettyJsonView — CSS Custom Highlight registration (D-08)", () => {
  it("no-ops without throwing when CSS.highlights / Highlight are undefined", () => {
    // jsdom does not implement the CSS Custom Highlight API.
    expect(() =>
      render(<PrettyJsonView data={{ method: "session/new" }} query="session" />),
    ).not.toThrow();
  });

  it("registers and updates the highlight when the API is stubbed", () => {
    const store = new Map<string, unknown>();
    class FakeHighlight {
      ranges: unknown[];
      constructor(...ranges: unknown[]) {
        this.ranges = ranges;
      }
    }
    const cssAny = globalThis as unknown as {
      CSS?: { highlights?: Map<string, unknown> } | undefined;
      Highlight?: unknown;
    };
    const prevCSS = cssAny.CSS;
    const prevHighlight = cssAny.Highlight;
    cssAny.CSS = { highlights: store };
    cssAny.Highlight = FakeHighlight as unknown;

    try {
      const { rerender } = render(
        <PrettyJsonView data={{ method: "session/new", note: "session info" }} query="session" />,
      );
      const first = store.get("ahp-search-match") as FakeHighlight | undefined;
      expect(first).toBeInstanceOf(FakeHighlight);
      expect(first?.ranges.length).toBeGreaterThanOrEqual(1);

      // Navigating to new data/query re-seeds the highlight.
      rerender(<PrettyJsonView data={{ method: "tools/list", note: "list info" }} query="list" />);
      const second = store.get("ahp-search-match") as FakeHighlight | undefined;
      expect(second).toBeInstanceOf(FakeHighlight);
      expect(second?.ranges.length).toBeGreaterThanOrEqual(1);

      // Clearing the query removes the highlight entry.
      rerender(<PrettyJsonView data={{ method: "tools/list" }} query="" />);
      expect(store.has("ahp-search-match")).toBe(false);
    } finally {
      cssAny.CSS = prevCSS;
      cssAny.Highlight = prevHighlight;
    }
  });
});
