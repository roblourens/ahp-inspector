import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SafeCandidate } from "../../types/safe-candidate.js";
import { NoActiveLogState } from "./NoActiveLogState.js";

afterEach(() => cleanup());

const c1: SafeCandidate = {
  id: "id1",
  label: "agenthost.x.jsonl",
  origin: "vscode",
  confidence: "high",
  mtimeMs: Date.now(),
  sizeBytes: 100,
};

describe("NoActiveLogState", () => {
  it("renders heading 'No log open' and the discovered-logs section", () => {
    render(
      <NoActiveLogState
        candidates={[c1]}
        isLoading={false}
        onSelect={() => {}}
        onOpenPath={async () => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("No log open");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Discovered logs");
    expect(screen.getByText("agenthost.x.jsonl")).toBeTruthy();
  });

  it("body copy adapts when there are no candidates", () => {
    render(
      <NoActiveLogState
        candidates={[]}
        isLoading={false}
        onSelect={() => {}}
        onOpenPath={async () => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByText(/No VS Code logs found automatically/)).toBeTruthy();
  });

  it("clicking a CandidateRow calls onSelect with that id", () => {
    const onSelect = vi.fn();
    render(
      <NoActiveLogState
        candidates={[c1]}
        isLoading={false}
        onSelect={onSelect}
        onOpenPath={async () => {}}
        onRefresh={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("agenthost.x.jsonl"));
    expect(onSelect).toHaveBeenCalledWith("id1");
  });

  it("clicking Refresh List calls onRefresh", () => {
    const onRefresh = vi.fn();
    render(
      <NoActiveLogState
        candidates={[]}
        isLoading={false}
        onSelect={() => {}}
        onOpenPath={async () => {}}
        onRefresh={onRefresh}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Refresh List/i }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("renders the 'or open manually' divider and ManualOpenInput", () => {
    render(
      <NoActiveLogState
        candidates={[]}
        isLoading={false}
        onSelect={() => {}}
        onOpenPath={async () => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByText(/or open manually/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/absolute\/path/i)).toBeTruthy();
  });
});
