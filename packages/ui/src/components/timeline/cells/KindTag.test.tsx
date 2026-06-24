import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KindTag } from "./KindTag.js";

const CASES = [
  ["REQ", "Request"],
  ["RES", "Response"],
  ["NTF", "Notification"],
  ["ACT", "Action"],
  ["BAD", "Parse error"],
  ["LOG", "Log"],
] as const;

describe("KindTag — UI-SPEC §5.2", () => {
  afterEach(() => cleanup());

  it.each(CASES)("renders %s with title %s", (kind, title) => {
    render(<KindTag kind={kind} />);
    const el = screen.getByTestId("kind-tag");
    expect(el.textContent).toBe(kind);
    expect(el.getAttribute("title")).toBe(title);
  });

  it("uses compact centered badge metrics", () => {
    render(<KindTag kind="ACT" />);
    expect(screen.getByTestId("kind-tag")).toHaveStyle({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      height: "16px",
      fontSize: "11px",
      lineHeight: "16px",
      verticalAlign: "middle",
    });
  });
});
