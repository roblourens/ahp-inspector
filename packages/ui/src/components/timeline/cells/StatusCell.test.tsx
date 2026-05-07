import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusCell } from "./StatusCell.js";

const CASES = [
  ["ok", "2xx"],
  ["error", "ERR"],
  ["pending", "…"],
  ["orphan", "ORPHAN"],
  ["unmatched", "TIMEOUT"],
  ["n/a", "—"],
] as const;

describe("StatusCell — UI-SPEC §5.5", () => {
  afterEach(() => cleanup());

  it.each(CASES)("status %s renders %s", (status, label) => {
    render(<StatusCell status={status} />);
    const el = screen.getByTestId("status-cell");
    expect(el.textContent).toBe(label);
    expect(el.getAttribute("data-status")).toBe(status);
  });
});
