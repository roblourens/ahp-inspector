// SSE client tests (Plan 02-06 Task 1). Hand-rolled FakeEventSource because
// jsdom does not implement real SSE. Each test asserts: SSE event → exact
// store mutation. Snapshot rows appear mid-snapshot through the scheduled
// drain. `bye` flips to 'disconnected' without auto-reconnect.

import type { EventRow } from "@ahp-inspector/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../state/store.js";
import { connectLogStream } from "./sse-client.js";

interface Listener {
  type: string;
  fn: (ev: Event) => void;
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  readyState = 0; // CONNECTING
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  closed = false;
  private listeners: Listener[] = [];
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (ev: Event) => void): void {
    this.listeners.push({ type, fn });
  }
  removeEventListener(type: string, fn: (ev: Event) => void): void {
    this.listeners = this.listeners.filter((l) => !(l.type === type && l.fn === fn));
  }
  close(): void {
    this.closed = true;
    this.readyState = 2; // CLOSED
  }
  /** Test helper — synthesize a server SSE frame. */
  emit(type: string, data: unknown): void {
    const ev = new MessageEvent(type, { data: JSON.stringify(data) });
    for (const l of this.listeners) if (l.type === type) l.fn(ev);
  }
  /** Test helper — fire a generic onerror. */
  fireError(): void {
    if (this.onerror) this.onerror.call(this as unknown as EventSource, new Event("error"));
  }
}

function row(idx: number, overrides: Partial<EventRow> = {}): EventRow {
  return {
    idx,
    seq: idx,
    ts: 0,
    tsFmt: "00:00:00.000",
    dir: "c2s",
    dirGlyph: "→",
    kind: "request",
    kindTag: "REQ",
    method: "test",
    actionType: null,
    actionFamily: null,
    sessionId: null,
    sessionShort: null,
    turnId: null,
    turnShort: null,
    keyId: null,
    status: "pending",
    latencyMs: null,
    latencyBand: null,
    payloadPreview: "",
    parseErrorReason: null,
    lineIndex: idx + 1,
    ...overrides,
  } as EventRow;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => {
    cb(0);
    return 0;
  });
  useAppStore.setState({
    rows: [],
    connection: "connecting",
    selectedIdx: null,
    meta: null,
    logKey: null,
    loadProgress: { phase: "idle", loadedRows: 0, loadedBytes: 0 },
    streamBacklog: { queuedFrames: 0, queuedRows: 0 },
  });
  FakeEventSource.instances = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

const Ctor = FakeEventSource as unknown as typeof EventSource;

function firstInstance(): FakeEventSource {
  const es = FakeEventSource.instances[0];
  if (!es) throw new Error("no FakeEventSource was constructed");
  return es;
}

describe("connectLogStream — snapshot lifecycle", () => {
  it("publishes chunks mid-snapshot before snapshot-end", () => {
    connectLogStream({ EventSourceCtor: Ctor });
    const es = firstInstance();
    expect(useAppStore.getState().connection).toBe("connecting");

    es.emit("snapshot-begin", {
      meta: { filename: "demo.jsonl", sizeBytes: 0, startedAt: 0, logKey: "log-key-1" },
      total: 3,
    });
    expect(useAppStore.getState().meta?.filename).toBe("demo.jsonl");
    expect(useAppStore.getState().logKey).toBe("log-key-1");

    es.emit("snapshot-chunk", { rows: [row(0), row(1)], from: 0 });
    expect(useAppStore.getState().rows).toHaveLength(2);

    es.emit("snapshot-chunk", { rows: [row(2)], from: 2 });
    expect(useAppStore.getState().rows).toHaveLength(3);

    es.emit("snapshot-end", {});
    expect(useAppStore.getState().rows).toHaveLength(3);
    expect(useAppStore.getState().connection).toBe("connected");
  });
});

describe("connectLogStream — append + patch", () => {
  it("append mutates rows at the given offset", () => {
    connectLogStream({ EventSourceCtor: Ctor });
    const es = firstInstance();
    es.emit("snapshot-begin", {
      meta: { filename: "x.jsonl", sizeBytes: 0, startedAt: 0 },
      total: 0,
    });
    es.emit("snapshot-end", {});
    es.emit("append", { rows: [row(0), row(1)], from: 0 });
    expect(useAppStore.getState().rows).toHaveLength(2);
    es.emit("append", { rows: [row(2)], from: 2 });
    expect(useAppStore.getState().rows).toHaveLength(3);
  });

  it("patch updates status/latency for the indicated idx", () => {
    connectLogStream({ EventSourceCtor: Ctor });
    const es = firstInstance();
    es.emit("snapshot-begin", {
      meta: { filename: "x.jsonl", sizeBytes: 0, startedAt: 0 },
      total: 1,
    });
    es.emit("snapshot-chunk", { rows: [row(0)], from: 0 });
    es.emit("snapshot-end", {});
    es.emit("patch", {
      updates: [{ idx: 0, status: "ok", latencyMs: 42, latencyBand: "fast" }],
    });
    const r = useAppStore.getState().rows[0];
    expect(r?.status).toBe("ok");
    expect(r?.latencyMs).toBe(42);
    expect(r?.latencyBand).toBe("fast");
  });

  it("maps progress and backlog frames into store state", () => {
    connectLogStream({ EventSourceCtor: Ctor });
    const es = firstInstance();

    es.emit("load-progress", {
      phase: "loading",
      loadedRows: 25,
      loadedBytes: 50,
      totalBytes: 100,
      percent: 50,
    });
    es.emit("stream-backlog", { queuedFrames: 3, queuedRows: 9 });

    expect(useAppStore.getState().loadProgress).toMatchObject({ phase: "loading", percent: 50 });
    expect(useAppStore.getState().streamBacklog).toEqual({ queuedFrames: 3, queuedRows: 9 });

    es.emit("stream-backlog", { queuedFrames: 0, queuedRows: 0 });
    expect(useAppStore.getState().streamBacklog).toEqual({ queuedFrames: 0, queuedRows: 0 });
  });
});

describe("connectLogStream — connection lifecycle", () => {
  it("bye closes EventSource and flips to disconnected", () => {
    connectLogStream({ EventSourceCtor: Ctor });
    const es = firstInstance();
    es.emit("bye", {});
    expect(es.closed).toBe(true);
    expect(useAppStore.getState().connection).toBe("disconnected");
  });

  it("onerror with readyState=CLOSED sets disconnected; readyState=CONNECTING stays connecting", () => {
    connectLogStream({ EventSourceCtor: Ctor });
    const es = firstInstance();
    // Transient before the first snapshot: still trying to connect.
    es.readyState = 0;
    es.fireError();
    expect(useAppStore.getState().connection).toBe("connecting");
    // Permanent: browser gave up.
    es.readyState = 2;
    es.fireError();
    expect(useAppStore.getState().connection).toBe("disconnected");
  });

  it("onerror after a successful snapshot shows disconnected even while EventSource retries", () => {
    connectLogStream({ EventSourceCtor: Ctor });
    const es = firstInstance();
    es.emit("snapshot-begin", {
      meta: { filename: "x.jsonl", sizeBytes: 0, startedAt: 0 },
      total: 1,
    });
    es.emit("snapshot-chunk", { rows: [row(0)], from: 0 });
    es.emit("snapshot-end", {});
    expect(useAppStore.getState().connection).toBe("connected");

    es.readyState = 0;
    es.fireError();
    expect(useAppStore.getState().connection).toBe("disconnected");
  });

  it("ping is a no-op (no store mutation)", () => {
    connectLogStream({ EventSourceCtor: Ctor });
    const es = firstInstance();
    const before = useAppStore.getState();
    es.emit("ping", {});
    const after = useAppStore.getState();
    expect(after.rows).toBe(before.rows);
    expect(after.connection).toBe(before.connection);
  });

  it("handle.close() prevents subsequent bye/error from flipping connection back", () => {
    const handle = connectLogStream({ EventSourceCtor: Ctor });
    const es = firstInstance();
    handle.close();
    expect(es.closed).toBe(true);
    // Force-clear the connection so we can detect a stray flip.
    useAppStore.setState({ connection: "connected" });
    es.fireError();
    expect(useAppStore.getState().connection).toBe("connected");
    es.emit("bye", {});
    expect(useAppStore.getState().connection).toBe("connected");
  });

  it("ignores delayed state-changing frames from a closed stream", () => {
    const handle = connectLogStream({ EventSourceCtor: Ctor });
    const es = firstInstance();
    useAppStore.setState({
      rows: [row(0)],
      logKey: "replacement-key",
      rotationNotice: false,
      lastWatchError: null,
    });

    handle.close();
    es.emit("log-reset", {});
    es.emit("snapshot-begin", {
      meta: { filename: "old.jsonl", sizeBytes: 0, startedAt: 0, logKey: "old-key" },
      total: 0,
    });
    es.emit("rotation", {});
    es.emit("watch-error", { code: "read-error", message: "old stream" });

    expect(useAppStore.getState().rows).toHaveLength(1);
    expect(useAppStore.getState().logKey).toBe("replacement-key");
    expect(useAppStore.getState().rotationNotice).toBe(false);
    expect(useAppStore.getState().lastWatchError).toBeNull();
    expect(es.closed).toBe(true);
  });
});
