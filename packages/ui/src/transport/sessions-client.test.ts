// sessions-client tests (Plan 04-05 Task 1).
// Mocks globalThis.fetch with vi.fn returning Response-like objects.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCandidates,
  openSessionByCandidate,
  openSessionByPath,
  SessionOpenError,
} from "./sessions-client.js";

interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function mkResponse(init: {
  ok: boolean;
  status: number;
  json?: unknown;
  jsonThrows?: boolean;
}): Response {
  return {
    ok: init.ok,
    status: init.status,
    json: () =>
      init.jsonThrows ? Promise.reject(new Error("bad json")) : Promise.resolve(init.json),
  } as unknown as Response;
}

describe("sessions-client", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("fetchCandidates", () => {
    it("returns parsed candidates array on 200", async () => {
      const candidates = [
        {
          id: "abc",
          label: "log.jsonl",
          origin: "vscode",
          confidence: "high",
          mtimeMs: 1,
          sizeBytes: 10,
        },
      ];
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mkResponse({ ok: true, status: 200, json: { candidates } }));
      const result = await fetchCandidates();
      expect(result).toEqual(candidates);
    });

    it("returns empty array when server returns missing candidates field", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mkResponse({ ok: true, status: 200, json: {} }));
      const result = await fetchCandidates();
      expect(result).toEqual([]);
    });

    it("throws SessionOpenError on non-200 response", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mkResponse({ ok: false, status: 500, json: {} }));
      await expect(fetchCandidates()).rejects.toBeInstanceOf(SessionOpenError);
    });

    it("throws with code 'network' on fetch failure", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("network down"));
      await expect(fetchCandidates()).rejects.toMatchObject({ code: "network" });
    });
  });

  describe("openSessionByCandidate", () => {
    it("posts {id} JSON body and resolves on 200", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(mkResponse({ ok: true, status: 200, json: { ok: true } }));
      globalThis.fetch = fetchMock;
      await openSessionByCandidate("cand-123");
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sessions/open",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "content-type": "application/json" }),
        }),
      );
      const callInit = fetchMock.mock.calls[0]?.[1] as FetchInit;
      expect(JSON.parse(callInit.body ?? "{}")).toEqual({ id: "cand-123" });
    });

    it("throws SessionOpenError carrying server `code` on 4xx", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mkResponse({ ok: false, status: 400, json: { code: "not-found" } }));
      try {
        await openSessionByCandidate("x");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(SessionOpenError);
        expect((err as SessionOpenError).code).toBe("not-found");
      }
    });

    it("falls back to 'bad-request' when 4xx body has no code", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mkResponse({ ok: false, status: 400, json: {} }));
      await expect(openSessionByCandidate("x")).rejects.toMatchObject({
        code: "bad-request",
      });
    });

    it("falls back to 'bad-request' when 4xx body is unparseable", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mkResponse({ ok: false, status: 400, jsonThrows: true }));
      await expect(openSessionByCandidate("x")).rejects.toMatchObject({
        code: "bad-request",
      });
    });

    it("throws SessionOpenError code 'network' on fetch rejection", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("offline"));
      await expect(openSessionByCandidate("x")).rejects.toMatchObject({
        code: "network",
      });
    });
  });

  describe("openSessionByPath", () => {
    it("posts {path} JSON body and resolves on 200", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(mkResponse({ ok: true, status: 200, json: { ok: true } }));
      globalThis.fetch = fetchMock;
      await openSessionByPath("/tmp/foo.jsonl");
      const callInit = fetchMock.mock.calls[0]?.[1] as FetchInit;
      expect(JSON.parse(callInit.body ?? "{}")).toEqual({ path: "/tmp/foo.jsonl" });
    });

    it("propagates 4xx code", async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(mkResponse({ ok: false, status: 400, json: { code: "not-a-file" } }));
      await expect(openSessionByPath("/x")).rejects.toMatchObject({ code: "not-a-file" });
    });
  });
});
