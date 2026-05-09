import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserAhpViewerClient } from "./browser-client.js";

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createBrowserAhpViewerClient.probeLogMeta", () => {
  it("returns 'no-log' on 204", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));
    const client = createBrowserAhpViewerClient();
    expect(await client.probeLogMeta()).toBe("no-log");
  });

  it("returns 'ready' on 200 application/json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ filename: "t.jsonl" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );
    const client = createBrowserAhpViewerClient();
    expect(await client.probeLogMeta()).toBe("ready");
  });

  it("returns 'no-server' on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("net"))),
    );
    const client = createBrowserAhpViewerClient();
    expect(await client.probeLogMeta()).toBe("no-server");
  });

  it("returns 'no-server' on a non-JSON 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("<!doctype html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
        ),
      ),
    );
    const client = createBrowserAhpViewerClient();
    expect(await client.probeLogMeta()).toBe("no-server");
  });

  it("returns 'no-server' on a 5xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))),
    );
    const client = createBrowserAhpViewerClient();
    expect(await client.probeLogMeta()).toBe("no-server");
  });
});

describe("createBrowserAhpViewerClient delegation", () => {
  it("re-exports session/detail/search/state helpers as bound methods", async () => {
    const client = createBrowserAhpViewerClient();
    expect(typeof client.fetchCandidates).toBe("function");
    expect(typeof client.openSessionByCandidate).toBe("function");
    expect(typeof client.openSessionByPath).toBe("function");
    expect(typeof client.fetchEvent).toBe("function");
    expect(typeof client.searchEvents).toBe("function");
    expect(typeof client.fetchStateAt).toBe("function");
    expect(typeof client.connectLogStream).toBe("function");
  });
});
