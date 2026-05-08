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
