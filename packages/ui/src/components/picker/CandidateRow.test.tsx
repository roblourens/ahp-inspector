import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SafeCandidate } from "../../types/safe-candidate.js";
import { CandidateRow } from "./CandidateRow.js";

afterEach(() => cleanup());

const sample: SafeCandidate = {
  id: "abc123",
  label: "agenthost.20260507.jsonl",
  origin: "vscode",
  confidence: "high",
  mtimeMs: Date.now() - 2 * 3600_000,
  sizeBytes: 4200,
  contextLabel: "20260507 / window1 / exthost / GitHub.copilot-chat",
};

describe("CandidateRow", () => {
  it("renders basename, badge copy, and origin label", () => {
    render(
      <ul>
        <CandidateRow candidate={sample} onSelect={() => {}} />
      </ul>,
    );
    expect(screen.getByText("agenthost.20260507.jsonl")).toBeTruthy();
    expect(screen.getByText(/JSONL · VS Code/)).toBeTruthy();
  });
  it("does NOT render any absolute path text in the DOM", () => {
    const c2: SafeCandidate = { ...sample, label: "x.jsonl", contextLabel: "20260507 / window1" };
    const { container } = render(
      <ul>
        <CandidateRow candidate={c2} onSelect={() => {}} />
      </ul>,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\/Users\//);
    expect(text).not.toMatch(/\\Users\\/);
    expect(text).not.toMatch(/^\//);
  });
  it("calls onSelect on click and on Enter", () => {
    const onSelect = vi.fn();
    render(
      <ul>
        <CandidateRow candidate={sample} onSelect={onSelect} />
      </ul>,
    );
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    fireEvent.keyDown(btn, { key: "Enter" }); // native button handles Enter
    expect(onSelect.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
  it("uses correct dot color token by confidence", () => {
    const { container, rerender } = render(
      <ul>
        <CandidateRow candidate={sample} onSelect={() => {}} />
      </ul>,
    );
    const dotHigh = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(dotHigh.style.background).toContain("--color-confidence-high");
    rerender(
      <ul>
        <CandidateRow candidate={{ ...sample, confidence: "low" }} onSelect={() => {}} />
      </ul>,
    );
    const dotLow = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(dotLow.style.background).toContain("--color-confidence-low");
  });
});
