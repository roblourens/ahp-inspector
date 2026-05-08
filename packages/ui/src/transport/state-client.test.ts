// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStateAt, type StateAtSuccessResponse } from "./state-client.js";

const successBody: StateAtSuccessResponse = {
  logKey: "log-A",
  targetIndex: 7,
  totalEvents: 10,
  confidence: "complete",
  diagnostics: [],
  resources: [
    {
      kind: "session",
      uri: "session://a b",
      confidence: "complete",
      baselineEventIdx: 1,
      lastAppliedEventIdx: 7,
      baselineFromSeq: 0,
      lastServerSeq: 3,
      diagnosticCount: 0,
    },
  ],
  selectedResource: null,
  intents: [],
  cache: { hit: false, size: 1, maxEntries: 25 },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchStateAt", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue(jsonResponse(successBody));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("requests metadata for an idx and log key", async () => {
    await fetchStateAt(7, { logKey: "log-A" });

    expect(mockFetch).toHaveBeenCalledWith("/api/state-at?idx=7&logKey=log-A", {});
  });

  it("encodes selected resource kind and URI", async () => {
    await fetchStateAt(7, {
      logKey: "log-A",
      resourceKind: "session",
      resourceUri: "session://a b",
    });

    const requestedUrl = mockFetch.mock.calls[0]?.[0] as string;
    const [pathname, query = ""] = requestedUrl.split("?");
    const params = new URLSearchParams(query);
    expect(pathname).toBe("/api/state-at");
    expect(params.get("idx")).toBe("7");
    expect(params.get("logKey")).toBe("log-A");
    expect(params.get("resourceKind")).toBe("session");
    expect(params.get("resourceUri")).toBe("session://a b");
  });

  it("parses successful state responses", async () => {
    const body = await fetchStateAt(7, { logKey: "log-A" });

    expect(body).toEqual(successBody);
    expect(body?.resources[0]?.confidence).toBe("complete");
    expect(body?.selectedResource).toBeNull();
    expect(body?.cache.maxEntries).toBe(25);
  });

  it("returns null for event indexes that no longer exist", async () => {
    mockFetch.mockResolvedValue(new Response("not found", { status: 404 }));

    await expect(fetchStateAt(99)).resolves.toBeNull();
  });

  it("throws active-log-change errors for stale log keys", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ code: "log-mismatch", message: "active log changed" }, 409),
    );

    await expect(fetchStateAt(7, { logKey: "stale" })).rejects.toThrow("active log changed");
  });

  it("throws status and server message for non-OK responses", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ code: "bad-request", message: "invalid idx" }, 400));

    await expect(fetchStateAt(7)).rejects.toThrow("invalid idx (400)");
  });

  it("passes AbortSignal through without adding undefined signal fields", async () => {
    const controller = new AbortController();

    await fetchStateAt(7, { signal: controller.signal });

    expect(mockFetch).toHaveBeenCalledWith("/api/state-at?idx=7", {
      signal: controller.signal,
    });
  });

  it("rejects unpaired resource selection options", async () => {
    await expect(fetchStateAt(7, { resourceKind: "session" })).rejects.toThrow(
      "resourceKind and resourceUri",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
