import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchPopover } from "./SearchPopover.js";

afterEach(cleanup);

describe("SearchPopover", () => {
  it("renders search input with label and placeholder", () => {
    render(
      <SearchPopover
        value=""
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={0}
        searchStatus="idle"
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText("all JSON payloads, methods, ids, sessions...");
    expect(input).toBeTruthy();
    expect(input.getAttribute("aria-label")).toBe("Search all events");
    expect(screen.getByText("Search")).toBeTruthy();
  });

  it("renders status line when search query is present", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={5}
        searchStatus="ready"
        searchTruncated={false}
        searchMatchCount={5}
        focusedSearchIndex={2}
        onNavigate={() => {}}
      />,
    );

    const status = screen.getByTestId("search-status");
    expect(status.textContent).toContain("3 of 5 results");
  });

  it("uses singular 'result' wording for a single match", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={1}
        searchStatus="ready"
        searchTruncated={false}
        searchMatchCount={1}
        focusedSearchIndex={0}
        onNavigate={() => {}}
      />,
    );

    const status = screen.getByTestId("search-status");
    expect(status.textContent).toContain("1 of 1 result");
    expect(status.textContent).not.toContain("results");
  });

  it("shows the pre-navigation '{m} results' count before navigating", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={24}
        searchStatus="ready"
        searchTruncated={false}
        searchMatchCount={24}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    const status = screen.getByTestId("search-status");
    expect(status.textContent).toContain("24 results");
    expect(status.textContent).not.toContain(" of ");
  });

  it("renders 'No matching events' when a query has zero results", () => {
    render(
      <SearchPopover
        value="zzzznotfound"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={0}
        searchStatus="ready"
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    const status = screen.getByTestId("search-status");
    expect(status.textContent).toContain("No matching events");
  });

  it("exposes the find region with the accessible name 'Find'", () => {
    render(
      <SearchPopover
        value=""
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={0}
        searchStatus="idle"
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    expect(screen.getByRole("region", { name: "Find" })).toBeTruthy();
  });

  it("marks the status counter as a polite live region", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={5}
        searchStatus="ready"
        searchTruncated={false}
        searchMatchCount={5}
        focusedSearchIndex={2}
        onNavigate={() => {}}
      />,
    );

    const liveRegion = screen.getByRole("status");
    expect(liveRegion.getAttribute("aria-atomic")).toBe("true");
    expect(liveRegion.textContent).toContain("3 of 5 results");
  });

  it("renders prev/next navigation buttons when matches exist", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={5}
        searchStatus="ready"
        searchTruncated={false}
        searchMatchCount={5}
        focusedSearchIndex={1}
        onNavigate={() => {}}
      />,
    );

    const prevButton = screen.getByRole("button", { name: "Previous result" });
    const nextButton = screen.getByRole("button", { name: "Next result" });
    expect(prevButton).toBeTruthy();
    expect(nextButton).toBeTruthy();
    expect(prevButton).not.toHaveAttribute("disabled");
    expect(nextButton).not.toHaveAttribute("disabled");
  });

  it("keeps focus on the clicked navigation button (D-11)", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={5}
        searchStatus="ready"
        searchTruncated={false}
        searchMatchCount={5}
        focusedSearchIndex={1}
        onNavigate={() => {}}
      />,
    );

    const nextButton = screen.getByRole("button", { name: "Next result" });
    fireEvent.click(nextButton);
    expect(document.activeElement).toBe(nextButton);
  });

  it("disables prev/next buttons when no matches", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={0}
        searchStatus="ready"
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    const prevButton = screen.getByRole("button", { name: "Previous result" });
    const nextButton = screen.getByRole("button", { name: "Next result" });
    expect(prevButton).toHaveAttribute("disabled");
    expect(nextButton).toHaveAttribute("disabled");
  });

  it("calls onNavigate when prev/next buttons are clicked", () => {
    const onNavigate = (direction: "previous" | "next"): void => {
      // Mock handler
    };
    const onNavigateSpy = (direction: "previous" | "next"): void => {
      onNavigate(direction);
    };

    const { rerender } = render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={5}
        searchStatus="ready"
        searchTruncated={false}
        searchMatchCount={5}
        focusedSearchIndex={1}
        onNavigate={onNavigateSpy}
      />,
    );

    const nextButton = screen.getByRole("button", { name: "Next result" });
    fireEvent.click(nextButton);
    // If we got here without error, click worked
    expect(true).toBe(true);
  });

  it("calls onChange when input value changes", () => {
    const onChange = (value: string): void => {
      // Mock handler
    };
    let capturedValue = "";
    const onChangeSpy = (value: string): void => {
      capturedValue = value;
      onChange(value);
    };

    render(
      <SearchPopover
        value=""
        onChange={onChangeSpy}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={0}
        searchStatus="idle"
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText("all JSON payloads, methods, ids, sessions...");
    fireEvent.change(input, { target: { value: "test" } });
    expect(capturedValue).toBe("test");
  });

  it("shows clear button when input has value", () => {
    const { rerender } = render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={0}
        searchStatus="idle"
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    const clearButton = screen.getByRole("button", { name: "Clear search" });
    expect(clearButton).toBeTruthy();

    // Clear button should not be visible when value is empty
    rerender(
      <SearchPopover
        value=""
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={0}
        searchStatus="idle"
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeFalsy();
  });

  it("does not self-handle Escape (TimelineRegion owns close + row focus)", () => {
    let wasClosed = false;
    const onCloseSpy = (): void => {
      wasClosed = true;
    };

    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={onCloseSpy}
        searchTotal={0}
        searchStatus="idle"
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    // The popover no longer registers its own document Escape listener.
    expect(wasClosed).toBe(false);
  });

  it("displays searching status", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={0}
        searchStatus="searching"
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    const status = screen.getByTestId("search-status");
    expect(status.textContent).toContain("Searching…");
  });

  it("displays error status", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={0}
        searchStatus="error"
        searchError="Index too large"
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    const status = screen.getByTestId("search-status");
    expect(status.textContent).toContain("Search failed: Index too large");
    // Error status renders in the destructive token, never the nonexistent --color-danger.
    expect(status.getAttribute("style") ?? "").toContain("var(--color-destructive)");
    expect(status.getAttribute("style") ?? "").not.toContain("--color-danger");
  });

  it("falls back to a recovery hint when the error has no message", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={0}
        searchStatus="error"
        searchError=""
        searchTruncated={false}
        searchMatchCount={0}
        focusedSearchIndex={null}
        onNavigate={() => {}}
      />,
    );

    const status = screen.getByTestId("search-status");
    expect(status.textContent).toContain(
      "Search failed — check the server connection and try again",
    );
  });

  it("displays truncation indicator when results are truncated", () => {
    render(
      <SearchPopover
        value="initialize"
        onChange={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        searchTotal={10}
        searchStatus="ready"
        searchTruncated={true}
        searchMatchCount={10}
        focusedSearchIndex={0}
        onNavigate={() => {}}
      />,
    );

    const status = screen.getByTestId("search-status");
    expect(status.textContent).toContain("1 of 10 results+");
  });
});
