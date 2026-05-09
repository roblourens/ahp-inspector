import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionNotification, WebviewSsePayload } from "@ahp-viewer/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ViewerSessionBridge } from "./viewerSession.js";

const FIXTURE_LINE = '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}\n';

let dir: string;
let logPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ahp-ext-"));
  logPath = join(dir, "test.jsonl");
  await writeFile(logPath, FIXTURE_LINE);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

interface Recorder {
  readonly out: ExtensionNotification[];
  readonly bridge: ViewerSessionBridge;
}

function makeRecorder(): Recorder {
  const out: ExtensionNotification[] = [];
  const bridge = new ViewerSessionBridge({ postMessage: (n) => out.push(n) });
  return { out, bridge };
}

function findResponse(out: ExtensionNotification[], requestId: string): ExtensionNotification {
  const match = out.find((n) => n.kind === "response" && n.requestId === requestId);
  if (!match) throw new Error(`no response for ${requestId}; saw ${JSON.stringify(out)}`);
  return match;
}

async function waitForIngest(bridge: ViewerSessionBridge): Promise<void> {
  // TailReader's initial-read is fire-and-forget inside `createAppState`;
  // poll log/event idx 0 until it returns a value rather than null.
  for (let i = 0; i < 100; i++) {
    const probe: ExtensionNotification[] = [];
    const original = (bridge as unknown as { post: (n: ExtensionNotification) => void }).post;
    (bridge as unknown as { post: (n: ExtensionNotification) => void }).post = (n) => {
      probe.push(n);
      original(n);
    };
    try {
      await bridge.handle({ kind: "log/event", requestId: `__wait${i}__`, idx: 0 });
    } finally {
      (bridge as unknown as { post: (n: ExtensionNotification) => void }).post = original;
    }
    const resp = probe.find(
      (n): n is Extract<ExtensionNotification, { kind: "response" }> =>
        n.kind === "response" && n.requestId === `__wait${i}__`,
    );
    if (resp && resp.ok && resp.value !== null) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("ingest did not complete within 1s");
}

describe("ViewerSessionBridge", () => {
  it("ignores requests without a known kind/requestId", async () => {
    const { out, bridge } = makeRecorder();
    await bridge.handle({ kind: "garbage" });
    await bridge.handle({ kind: "session/discover" }); // missing requestId
    await bridge.handle(null);
    expect(out).toEqual([]);
    await bridge.dispose();
  });

  it("session/openPath returns active log meta with basename only", async () => {
    const { out, bridge } = makeRecorder();
    await bridge.handle({ kind: "session/openPath", requestId: "r1", path: logPath });
    const resp = findResponse(out, "r1");
    if (resp.kind !== "response" || !resp.ok) throw new Error("expected ok response");
    const value = resp.value as { active: { logKey: string; meta: { filename: string } } };
    expect(value.active.meta.filename).toBe("test.jsonl");
    expect(value.active.logKey).toMatch(/^[0-9a-f]{32}$/);
    // Path leakage guard.
    expect(JSON.stringify(out)).not.toContain(dir);
    await bridge.dispose();
  });

  it("log/meta returns no-active-log error before any session", async () => {
    const { out, bridge } = makeRecorder();
    await bridge.handle({ kind: "log/meta", requestId: "r2" });
    const resp = findResponse(out, "r2");
    if (resp.kind !== "response" || resp.ok) throw new Error("expected error response");
    expect(resp.code).toBe("no-active-log");
    await bridge.dispose();
  });

  it("log/meta returns AppState meta after open", async () => {
    const { out, bridge } = makeRecorder();
    await bridge.handle({ kind: "session/openPath", requestId: "open", path: logPath });
    await bridge.handle({ kind: "log/meta", requestId: "meta" });
    const resp = findResponse(out, "meta");
    if (resp.kind !== "response" || !resp.ok) throw new Error("expected ok response");
    const meta = resp.value as { filename: string; logKey: string };
    expect(meta.filename).toBe("test.jsonl");
    expect(meta.logKey).toMatch(/^[0-9a-f]{32}$/);
    await bridge.dispose();
  });

  it("log/event returns DetailResponse for an open log", async () => {
    const { out, bridge } = makeRecorder();
    await bridge.handle({ kind: "session/openPath", requestId: "open", path: logPath });
    await waitForIngest(bridge);
    out.length = 0;
    await bridge.handle({ kind: "log/event", requestId: "ev", idx: 0 });
    const resp = findResponse(out, "ev");
    if (resp.kind !== "response" || !resp.ok) throw new Error("expected ok response");
    const value = resp.value as { event: { method?: string }; status: string };
    expect(value.event.method).toBe("ping");
    expect(value.status).toBe("pending");
    await bridge.dispose();
  });

  it("log/event with negative idx returns bad-request", async () => {
    const { out, bridge } = makeRecorder();
    await bridge.handle({ kind: "session/openPath", requestId: "open", path: logPath });
    await bridge.handle({ kind: "log/event", requestId: "ev", idx: -1 });
    const resp = findResponse(out, "ev");
    if (resp.kind !== "response" || resp.ok) throw new Error("expected error response");
    expect(resp.code).toBe("bad-request");
    await bridge.dispose();
  });

  it("log/search returns matches and total", async () => {
    const { out, bridge } = makeRecorder();
    await bridge.handle({ kind: "session/openPath", requestId: "open", path: logPath });
    await waitForIngest(bridge);
    out.length = 0;
    await bridge.handle({ kind: "log/search", requestId: "s", q: "ping" });
    const resp = findResponse(out, "s");
    if (resp.kind !== "response" || !resp.ok) throw new Error("expected ok response");
    const v = resp.value as { matches: number[]; total: number; truncated: boolean };
    expect(v.matches).toEqual([0]);
    expect(v.total).toBe(1);
    expect(v.truncated).toBe(false);
    await bridge.dispose();
  });

  it("stream/start replays a snapshot, then live frames are forwarded", async () => {
    const { out, bridge } = makeRecorder();
    await bridge.handle({ kind: "session/openPath", requestId: "open", path: logPath });
    await waitForIngest(bridge);
    out.length = 0;
    await bridge.handle({ kind: "stream/start", requestId: "ss" });
    const streamFrames = out
      .filter((n): n is Extract<ExtensionNotification, { kind: "stream" }> => n.kind === "stream")
      .map((n) => n.payload);
    const kinds = streamFrames.map((f: WebviewSsePayload) => f.kind);
    expect(kinds[0]).toBe("snapshot-begin");
    expect(kinds).toContain("snapshot-end");
    await bridge.dispose();
  });

  it("dispose() closes the active session and ignores subsequent requests", async () => {
    const { out, bridge } = makeRecorder();
    await bridge.handle({ kind: "session/openPath", requestId: "open", path: logPath });
    await bridge.dispose();
    out.length = 0;
    await bridge.handle({ kind: "log/meta", requestId: "after" });
    expect(out).toEqual([]);
  });

  it("session change emits a stream log-reset to the webview", async () => {
    const { out, bridge } = makeRecorder();
    await bridge.handle({ kind: "session/openPath", requestId: "open", path: logPath });
    // Open a second log to trigger onChange.
    const altPath = join(dir, "alt.jsonl");
    await writeFile(altPath, FIXTURE_LINE);
    await bridge.handle({ kind: "session/openPath", requestId: "open2", path: altPath });
    const resets = out.filter(
      (n): n is Extract<ExtensionNotification, { kind: "stream" }> =>
        n.kind === "stream" && n.payload.kind === "log-reset",
    );
    // onChange fires for both open transitions, so at least 1 log-reset.
    expect(resets.length).toBeGreaterThanOrEqual(1);
    await bridge.dispose();
  });
});
