// @vitest-environment jsdom
/**
 * Tests for CopyMenu copy actions (WR-01: raw vs pretty JSON differentiation).
 */
import type { AhpEvent } from "@ahp-inspector/shared";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyMenu } from "./CopyMenu.js";

function makeEvent(raw: unknown = { a: 1 }): AhpEvent {
  return {
    seq: 0,
    ts: 1700000000000,
    tsRaw: "2023-11-14T22:13:20.000Z",
    dir: "c2s",
    kind: "request",
    method: "tools/list",
    actionType: null,
    id: 1,
    idType: "number",
    sessionId: null,
    turnId: null,
    toolCallId: null,
    serverSeq: null,
    byteOffset: 0,
    byteLength: 100,
    raw,
    parse: "ok",
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CopyMenu — copy raw JSON vs pretty JSON", () => {
  it("Copy raw JSON produces compact (minified) JSON", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn(async (t: string) => {
          written.push(t);
        }),
      },
      configurable: true,
    });
    const onCopy = vi.fn();
    const rawData = { a: 1, b: [2, 3] };
    render(
      <CopyMenu
        event={makeEvent(rawData)}
        pairEvent={null}
        pairIdx={null}
        latencyMs={null}
        status="ok"
        onCopy={onCopy}
      />,
    );

    // Open menu
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    // Click "Copy raw JSON"
    const rawBtn = screen.getByRole("menuitem", { name: /copy raw json/i });
    fireEvent.click(rawBtn);

    await waitFor(() => expect(onCopy).toHaveBeenCalled());
    expect(written[0]).toBe(JSON.stringify(rawData));
    // Must not contain newlines (compact)
    expect(written[0]).not.toContain("\n");
  });

  it("Copy pretty JSON produces indented JSON", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn(async (t: string) => {
          written.push(t);
        }),
      },
      configurable: true,
    });
    const onCopy = vi.fn();
    const rawData = { a: 1, b: [2, 3] };
    render(
      <CopyMenu
        event={makeEvent(rawData)}
        pairEvent={null}
        pairIdx={null}
        latencyMs={null}
        status="ok"
        onCopy={onCopy}
      />,
    );

    // Open menu
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    // Click "Copy pretty JSON"
    const prettyBtn = screen.getByRole("menuitem", { name: /copy pretty json/i });
    fireEvent.click(prettyBtn);

    await waitFor(() => expect(onCopy).toHaveBeenCalled());
    expect(written[0]).toBe(JSON.stringify(rawData, null, 2));
    // Must contain newlines (indented)
    expect(written[0]).toContain("\n");
  });

  it("Copy raw JSON and Copy pretty JSON produce different output for structured data", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn(async (t: string) => {
          written.push(t);
        }),
      },
      configurable: true,
    });
    const onCopy = vi.fn();
    const rawData = { jsonrpc: "2.0", method: "tools/list", params: {} };
    const { unmount } = render(
      <CopyMenu
        event={makeEvent(rawData)}
        pairEvent={null}
        pairIdx={null}
        latencyMs={null}
        status="ok"
        onCopy={onCopy}
      />,
    );

    // Copy raw
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy raw json/i }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));

    unmount();
    written.length = 0;
    onCopy.mockClear();

    const { unmount: unmount2 } = render(
      <CopyMenu
        event={makeEvent(rawData)}
        pairEvent={null}
        pairIdx={null}
        latencyMs={null}
        status="ok"
        onCopy={onCopy}
      />,
    );

    // Copy pretty
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy pretty json/i }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));

    const prettyOutput = written[0];
    unmount2();

    // Raw is compact, pretty is indented — they must differ
    expect(JSON.stringify(rawData)).not.toBe(JSON.stringify(rawData, null, 2));
    expect(prettyOutput).toBe(JSON.stringify(rawData, null, 2));
  });
});

describe("CopyMenu — correlation summary", () => {
  it("includes pair metadata in Copy summary when pairEvent exists", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn(async (t: string) => {
          written.push(t);
        }),
      },
      configurable: true,
    });
    const onCopy = vi.fn();
    const request = {
      ...makeEvent({
        jsonrpc: "2.0",
        id: "req-42",
        method: "tools/call",
        params: { sessionId: "sess-1" },
      }),
      method: "tools/call",
      id: "req-42",
      idType: "string",
      sessionId: "sess-1",
    } satisfies AhpEvent;
    const response = makeEvent({ jsonrpc: "2.0", id: "req-42", result: { ok: true } });
    render(
      <CopyMenu
        event={request}
        pairEvent={{
          ...response,
          seq: 7,
          dir: "s2c",
          kind: "response",
          method: null,
          id: "req-42",
          idType: "string",
        }}
        pairIdx={7}
        latencyMs={32}
        status="ok"
        onCopy={onCopy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy summary/i }));

    await waitFor(() => expect(onCopy).toHaveBeenCalled());
    expect(written[0]).toContain("correlation=paired pairIdx=7 status=ok latency=32ms");
    expect(written[0]).toContain(
      "current=Client→Server request tools/call id=req-42 (string) session=sess-1",
    );
    expect(written[0]).toContain("pair=Server→Client response response id=req-42 (string)");
  });

  it("keeps Copy summary clean when there is no pairEvent", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn(async (t: string) => {
          written.push(t);
        }),
      },
      configurable: true,
    });
    const onCopy = vi.fn();
    render(
      <CopyMenu
        event={makeEvent()}
        pairEvent={null}
        pairIdx={null}
        latencyMs={null}
        status="pending"
        onCopy={onCopy}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /copy summary/i }));

    await waitFor(() => expect(onCopy).toHaveBeenCalled());
    expect(written[0]).not.toContain("correlation=paired");
    expect(written[0]).not.toContain("pairIdx");
    expect(written[0]).not.toContain("pair=");
  });
});
