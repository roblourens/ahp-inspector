// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StateAtSelectedResource } from "../../transport/state-client.js";
import { StateCopyMenu } from "./StateCopyMenu.js";

const resource: StateAtSelectedResource = {
  kind: "session",
  uri: "copilot:/session/1",
  confidence: "partial",
  baselineEventIdx: 1,
  lastAppliedEventIdx: 7,
  baselineFromSeq: 0,
  lastServerSeq: 3,
  diagnosticCount: 1,
  diagnostics: [
    {
      code: "server-seq-gap",
      severity: "warning",
      eventIdx: 6,
      message: "Missing server sequence 2.",
    },
  ],
  state: { title: "State smoke", turns: [{ id: "turn-1" }] },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stubClipboard(written: string[]): void {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: vi.fn(async (text: string) => {
        written.push(text);
      }),
    },
    configurable: true,
  });
}

describe("StateCopyMenu", () => {
  it("copies selected state as compact JSON", async () => {
    const written: string[] = [];
    stubClipboard(written);
    const onCopy = vi.fn();
    render(<StateCopyMenu targetIndex={7} resource={resource} onCopy={onCopy} />);

    fireEvent.click(screen.getByRole("button", { name: /copy state/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy state raw json/i }));

    await waitFor(() =>
      expect(onCopy).toHaveBeenCalledWith(expect.stringMatching(/^Copied /), true),
    );
    expect(written[0]).toBe(JSON.stringify(resource.state));
    expect(written[0]).not.toContain("\n");
  });

  it("copies selected state as pretty JSON", async () => {
    const written: string[] = [];
    stubClipboard(written);
    const onCopy = vi.fn();
    render(<StateCopyMenu targetIndex={7} resource={resource} onCopy={onCopy} />);

    fireEvent.click(screen.getByRole("button", { name: /copy state/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy state pretty json/i }));

    await waitFor(() => expect(onCopy).toHaveBeenCalled());
    expect(written[0]).toBe(JSON.stringify(resource.state, null, 2));
    expect(written[0]).toContain("\n");
  });

  it("copies concise state summary metadata", async () => {
    const written: string[] = [];
    stubClipboard(written);
    const onCopy = vi.fn();
    render(<StateCopyMenu targetIndex={7} resource={resource} onCopy={onCopy} />);

    fireEvent.click(screen.getByRole("button", { name: /copy state/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy state summary/i }));

    await waitFor(() => expect(onCopy).toHaveBeenCalled());
    expect(written[0]).toContain("target=#7");
    expect(written[0]).toContain("resource=session copilot:/session/1");
    expect(written[0]).toContain("confidence=partial");
    expect(written[0]).toContain("diagnostics=1");
    expect(written[0]).toContain("lastServerSeq=3");
  });

  it("reports copy failures", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) },
      configurable: true,
    });
    Object.defineProperty(document, "execCommand", {
      value: vi.fn(() => {
        throw new Error("fallback denied");
      }),
      configurable: true,
    });
    const onCopy = vi.fn();
    render(<StateCopyMenu targetIndex={7} resource={resource} onCopy={onCopy} />);

    fireEvent.click(screen.getByRole("button", { name: /copy state/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy state raw json/i }));

    await waitFor(() =>
      expect(onCopy).toHaveBeenCalledWith("Copy failed. Select and copy manually.", false),
    );
  });
});
