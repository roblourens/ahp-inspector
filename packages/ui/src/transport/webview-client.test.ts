import type { ExtensionNotification, WebviewRequest } from "@ahp-inspector/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../state/store.js";
import { createWebviewAhpViewerClient } from "./webview-client.js";

interface FakeApi {
  sent: WebviewRequest[];
  postMessage(msg: unknown): void;
}

function setup(): {
  api: FakeApi;
  target: EventTarget;
  client: ReturnType<typeof createWebviewAhpViewerClient>;
} {
  const sent: WebviewRequest[] = [];
  const target = new EventTarget();
  const api: FakeApi = {
    sent,
    postMessage(msg) {
      sent.push(msg as WebviewRequest);
    },
  };
  const client = createWebviewAhpViewerClient({ api, target });
  return { api, target, client };
}

function reply(target: EventTarget, notification: ExtensionNotification): void {
  target.dispatchEvent(new MessageEvent("message", { data: notification }));
}

beforeEach(() => {
  useAppStore.setState({ rows: [], connection: "connecting", selectedIdx: null, meta: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createWebviewAhpViewerClient", () => {
  it("postMessages a discriminated request and resolves on matching response", async () => {
    const { api, target, client } = setup();
    const promise = client.fetchCandidates();
    expect(api.sent).toHaveLength(1);
    const req = api.sent[0];
    expect(req?.kind).toBe("session/discover");
    if (!req) throw new Error("no request");
    reply(target, {
      kind: "response",
      requestId: req.requestId,
      ok: true,
      value: { candidates: [] },
    });
    await expect(promise).resolves.toEqual([]);
  });

  it("rejects with a coded error when the response is ok=false", async () => {
    const { api, target, client } = setup();
    const promise = client.openSessionByPath("/nope.jsonl");
    const req = api.sent[0];
    if (!req) throw new Error("no request");
    reply(target, {
      kind: "response",
      requestId: req.requestId,
      ok: false,
      code: "not-found",
      message: "not-found",
    });
    await expect(promise).rejects.toMatchObject({ message: "not-found" });
  });

  it("ignores stray messages with unrecognized shapes", async () => {
    const { api, target, client } = setup();
    const promise = client.fetchCandidates();
    target.dispatchEvent(new MessageEvent("message", { data: "not-json-object" }));
    target.dispatchEvent(new MessageEvent("message", { data: { foo: "bar" } }));
    const req = api.sent[0];
    if (!req) throw new Error("no request");
    reply(target, {
      kind: "response",
      requestId: req.requestId,
      ok: true,
      value: { candidates: [{ id: "x", label: "x.jsonl" }] },
    });
    await expect(promise).resolves.toHaveLength(1);
  });

  it("probeLogMeta maps no-active-log → no-log and other failures → no-server", async () => {
    const { api, target, client } = setup();
    const ready = client.probeLogMeta();
    const r1 = api.sent[0];
    if (!r1) throw new Error("missing request");
    reply(target, { kind: "response", requestId: r1.requestId, ok: true, value: {} });
    await expect(ready).resolves.toBe("ready");

    const noLog = client.probeLogMeta();
    const r2 = api.sent[1];
    if (!r2) throw new Error("missing request");
    reply(target, {
      kind: "response",
      requestId: r2.requestId,
      ok: false,
      code: "no-active-log",
      message: "no active log",
    });
    await expect(noLog).resolves.toBe("no-log");

    const noServer = client.probeLogMeta();
    const r3 = api.sent[2];
    if (!r3) throw new Error("missing request");
    reply(target, {
      kind: "response",
      requestId: r3.requestId,
      ok: false,
      code: "boom",
      message: "boom",
    });
    await expect(noServer).resolves.toBe("no-server");
  });

  it("connectLogStream pipes snapshot frames into the store", () => {
    const { api, target, client } = setup();
    const handle = client.connectLogStream();
    expect(api.sent[0]?.kind).toBe("stream/start");
    reply(target, {
      kind: "stream",
      payload: {
        kind: "snapshot-begin",
        meta: { filename: "a.jsonl", sizeBytes: 1, startedAt: 0, logKey: "abc" },
        total: 0,
      },
    });
    reply(target, { kind: "stream", payload: { kind: "snapshot-end" } });
    expect(useAppStore.getState().connection).toBe("connected");
    expect(useAppStore.getState().meta?.filename).toBe("a.jsonl");
    handle.close();
    const stop = api.sent.find((r) => r.kind === "stream/stop");
    expect(stop).toBeDefined();
  });

  it("close on connectLogStream is idempotent", () => {
    const { api, client } = setup();
    const handle = client.connectLogStream();
    handle.close();
    handle.close();
    const stops = api.sent.filter((r) => r.kind === "stream/stop");
    expect(stops).toHaveLength(1);
  });

  it("times out a request after 30s with a clear error", async () => {
    vi.useFakeTimers();
    const { api, client } = setup();
    const promise = client.fetchCandidates();
    void api;
    vi.advanceTimersByTime(30_001);
    await expect(promise).rejects.toMatchObject({ message: /timed out/ });
  });
});
