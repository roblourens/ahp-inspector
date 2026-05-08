// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearEventCacheForTests, fetchEvent } from "./http-client.js";

function responseFor(idx: number, source = "default"): Response {
  return new Response(
    JSON.stringify({
      event: {
        seq: idx,
        ts: idx,
        tsRaw: String(idx),
        dir: "c2s",
        kind: "request",
        method: "test",
        actionType: null,
        id: idx,
        idType: "number",
        sessionId: null,
        turnId: null,
        toolCallId: null,
        serverSeq: null,
        byteOffset: 0,
        byteLength: 1,
        raw: { jsonrpc: "2.0", id: idx, method: "test", source },
        parse: "ok",
      },
      pair: null,
      latencyMs: null,
      status: "n/a",
      pairIdx: null,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

describe("fetchEvent cache", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    clearEventCacheForTests();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockImplementation((url: string) => {
      const idx = Number(url.split("/").pop());
      return Promise.resolve(responseFor(idx));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    clearEventCacheForTests();
  });

  it("promotes cache hits before evicting the least recently used entry", async () => {
    for (let idx = 0; idx < 16; idx += 1) {
      await fetchEvent(idx);
    }
    expect(mockFetch).toHaveBeenCalledTimes(16);

    await fetchEvent(0);
    expect(mockFetch).toHaveBeenCalledTimes(16);

    await fetchEvent(16);
    expect(mockFetch).toHaveBeenCalledTimes(17);

    await fetchEvent(1);
    expect(mockFetch).toHaveBeenCalledTimes(18);

    await fetchEvent(0);
    expect(mockFetch).toHaveBeenCalledTimes(18);
  });

  it("does not reuse an idx cache entry across active log keys", async () => {
    let activeLog = "log-A";
    mockFetch.mockImplementation((url: string) => {
      const idx = Number(url.split("/").pop());
      return Promise.resolve(responseFor(idx, activeLog));
    });

    const logAEvent = await fetchEvent(0, undefined, "log-A");
    expect((logAEvent?.event.raw as { source: string }).source).toBe("log-A");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    activeLog = "log-B";
    const logBEvent = await fetchEvent(0, undefined, "log-B");
    expect((logBEvent?.event.raw as { source: string }).source).toBe("log-B");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    activeLog = "should-not-fetch";
    const cachedLogBEvent = await fetchEvent(0, undefined, "log-B");
    expect((cachedLogBEvent?.event.raw as { source: string }).source).toBe("log-B");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
