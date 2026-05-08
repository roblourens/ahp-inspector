// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StateAtSelectedResource } from "../../transport/state-client.js";
import { PinnedStatePanel } from "./PinnedStatePanel.js";
import {
  clearPinnedStatePoints,
  createPinnedStatePoint,
  MAX_PINNED_STATE_POINTS,
  removePinnedStatePoint,
  upsertPinnedStatePoint,
} from "./state-pins.js";

const baseResource: StateAtSelectedResource = {
  kind: "session",
  uri: "copilot:/session/1",
  confidence: "complete",
  baselineEventIdx: 1,
  lastAppliedEventIdx: 7,
  baselineFromSeq: 0,
  lastServerSeq: 3,
  diagnosticCount: 0,
  diagnostics: [],
  state: { sessionId: "session-1" },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("state pin helpers", () => {
  it("exports the two-point cap and creates a full pinned state point", () => {
    const point = createPinnedStatePoint({
      logKey: "log-A",
      targetIndex: 7,
      eventLabel: "action.session.update",
      eventTimestamp: 1000,
      resource: baseResource,
    });

    expect(MAX_PINNED_STATE_POINTS).toBe(2);
    expect(point).toMatchObject({
      id: "log-A:7:session:copilot:/session/1",
      logKey: "log-A",
      targetIndex: 7,
      eventLabel: "action.session.update",
      eventTimestamp: 1000,
      resourceKind: "session",
      resourceUri: "copilot:/session/1",
      confidence: "complete",
      diagnosticCount: 0,
      baselineEventIdx: 1,
      lastAppliedEventIdx: 7,
      baselineFromSeq: 0,
      lastServerSeq: 3,
      state: { sessionId: "session-1" },
    });
  });

  it("replaces duplicate IDs deterministically", () => {
    const first = createPin(1, "copilot:/session/1", { old: true });
    const duplicate = createPin(1, "copilot:/session/1", { updated: true });

    const result = upsertPinnedStatePoint([first], duplicate);

    expect(result).toHaveLength(1);
    expect(result[0]?.state).toEqual({ updated: true });
  });

  it("drops the oldest point when a third pin is added", () => {
    const first = createPin(1, "copilot:/session/1");
    const second = createPin(2, "copilot:/session/2");
    const third = createPin(3, "copilot:/session/3");

    const result = upsertPinnedStatePoint(
      upsertPinnedStatePoint(upsertPinnedStatePoint([], first), second),
      third,
    );

    expect(result.map((point) => point.targetIndex)).toEqual([2, 3]);
  });

  it("removes and clears pins without browser storage or network APIs", () => {
    const storageSet = vi.spyOn(Storage.prototype, "setItem");
    const storageGet = vi.spyOn(Storage.prototype, "getItem");
    const storageRemove = vi.spyOn(Storage.prototype, "removeItem");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const first = createPin(1, "copilot:/session/1");
    const second = createPin(2, "copilot:/session/2");

    expect(removePinnedStatePoint([first, second], first.id)).toEqual([second]);
    expect(clearPinnedStatePoints()).toEqual([]);
    expect(storageSet).not.toHaveBeenCalled();
    expect(storageGet).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("PinnedStatePanel", () => {
  it("renders empty, remove, and clear states", () => {
    const onRemove = vi.fn();
    const onClear = vi.fn();
    const { rerender } = render(
      <PinnedStatePanel points={[]} onRemove={onRemove} onClear={onClear} />,
    );

    expect(screen.getByText("Pinned state points")).toBeInTheDocument();
    expect(screen.getByText("Pinned 0/2")).toBeInTheDocument();
    expect(
      screen.getByText("Pin two state points to compare before/after reducer state."),
    ).toBeInTheDocument();

    rerender(
      <PinnedStatePanel
        points={[createPin(7, "copilot:/session/1")]}
        onRemove={onRemove}
        onClear={onClear}
      />,
    );

    expect(screen.getByText("#7")).toBeInTheDocument();
    expect(screen.getByText("copilot:/session/1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove pinned state/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear pinned states/i }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("hides comparison until exactly two pins exist", () => {
    const { rerender } = render(
      <PinnedStatePanel points={[]} onRemove={vi.fn()} onClear={vi.fn()} />,
    );

    expect(screen.queryByText("Pinned comparison")).not.toBeInTheDocument();

    rerender(
      <PinnedStatePanel
        points={[createPin(7, "copilot:/session/1")]}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.queryByText("Pinned comparison")).not.toBeInTheDocument();
  });

  it("renders comparison metadata and changed top-level paths for two pins", () => {
    render(
      <PinnedStatePanel
        points={[
          createPin(7, "copilot:/session/1", { summary: "before", stable: true }),
          createPin(8, "copilot:/session/1", { summary: "after", stable: true }),
        ]}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const comparison = screen.getByRole("region", { name: "Pinned comparison" });
    expect(within(comparison).getByText("Pinned comparison")).toBeInTheDocument();
    expect(within(comparison).getByText("From #7")).toBeInTheDocument();
    expect(within(comparison).getByText("To #8")).toBeInTheDocument();
    expect(within(comparison).getAllByText("session")).toHaveLength(2);
    expect(within(comparison).getAllByText("copilot:/session/1")).toHaveLength(2);
    expect(within(comparison).getByText("Comparison confidence")).toBeInTheDocument();
    expect(within(comparison).getByText("Changed top-level paths")).toBeInTheDocument();
    expect(within(comparison).getByText("summary")).toBeInTheDocument();
  });

  it("renders no-change text and incomplete comparison warning", () => {
    render(
      <PinnedStatePanel
        points={[
          createPin(7, "copilot:/session/1", { summary: "same" }),
          createPin(8, "copilot:/session/1", { summary: "same" }, "partial"),
        ]}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText("No top-level changes detected.")).toBeInTheDocument();
    expect(screen.getByText(/Comparison may be incomplete/)).toBeInTheDocument();
  });
});

function createPin(
  targetIndex: number,
  resourceUri: string,
  state: unknown = { ok: true },
  confidence: StateAtSelectedResource["confidence"] = "complete",
) {
  return createPinnedStatePoint({
    logKey: "log-A",
    targetIndex,
    eventLabel: `event-${targetIndex}`,
    eventTimestamp: 1000 + targetIndex,
    resource: {
      ...baseResource,
      uri: resourceUri,
      confidence,
      lastAppliedEventIdx: targetIndex,
      state,
    },
  });
}
