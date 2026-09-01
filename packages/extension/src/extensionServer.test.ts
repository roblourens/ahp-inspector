import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startLogServerSpy = vi.fn();
const createSessionsSpy = vi.fn();
const fakeServer = {
  url: "http://127.0.0.1:51234",
  port: 51234,
  apiToken: "test-capability",
  server: {} as never,
  close: vi.fn().mockResolvedValue(undefined),
};
const fakeSessions = {
  open: vi.fn(),
  close: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined),
};
let startImplementation: (opts: unknown) => Promise<typeof fakeServer> = async () => fakeServer;

vi.mock("@ahp-inspector/server", () => ({
  startLogServer: (opts: unknown) => {
    startLogServerSpy(opts);
    return startImplementation(opts);
  },
  createLogSessionManager: (opts: unknown) => {
    createSessionsSpy(opts);
    return fakeSessions;
  },
}));

vi.mock("@ahp-inspector/host-node", () => ({
  NodeHostAdapter: class {},
  resolveCandidateId: (id: string) => id,
}));

vi.mock("vscode", () => ({}));

const { getOrStartLogServer, closeLogServerIfRunning, __resetForTest } = await import(
  "./extensionServer.js"
);

interface FakeContext {
  extensionUri: { fsPath: string };
  extension?: { packageJSON?: { version?: string } };
}

function makeContext(): FakeContext {
  return {
    extensionUri: { fsPath: "/abs/extroot" },
    extension: { packageJSON: { version: "1.2.3" } },
  };
}

beforeEach(async () => {
  fakeServer.close.mockResolvedValue(undefined);
  fakeSessions.dispose.mockResolvedValue(undefined);
  await __resetForTest();
  startLogServerSpy.mockClear();
  createSessionsSpy.mockClear();
  fakeServer.close.mockClear();
  fakeSessions.dispose.mockClear();
  startImplementation = async () => fakeServer;
});

afterEach(async () => {
  fakeServer.close.mockResolvedValue(undefined);
  fakeSessions.dispose.mockResolvedValue(undefined);
  await __resetForTest();
});

describe("extensionServer", () => {
  it("lazy-starts the server on first call", async () => {
    const handle = await getOrStartLogServer(makeContext() as never);
    expect(startLogServerSpy).toHaveBeenCalledTimes(1);
    expect(handle.server).toBe(fakeServer);
    expect(handle.sessions).toBe(fakeSessions);
  });

  it("reuses the singleton across sequential calls", async () => {
    const ctx = makeContext();
    const a = await getOrStartLogServer(ctx as never);
    const b = await getOrStartLogServer(ctx as never);
    expect(a).toBe(b);
    expect(startLogServerSpy).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent starts", async () => {
    const ctx = makeContext();
    const [a, b] = await Promise.all([
      getOrStartLogServer(ctx as never),
      getOrStartLogServer(ctx as never),
    ]);
    expect(a).toBe(b);
    expect(startLogServerSpy).toHaveBeenCalledTimes(1);
  });

  it("closeLogServerIfRunning closes once and is idempotent", async () => {
    await getOrStartLogServer(makeContext() as never);
    await closeLogServerIfRunning();
    await closeLogServerIfRunning();
    expect(fakeServer.close).toHaveBeenCalledTimes(1);
    expect(fakeSessions.dispose).toHaveBeenCalledTimes(1);
  });

  it("restart after close starts a fresh server", async () => {
    const ctx = makeContext();
    await getOrStartLogServer(ctx as never);
    await closeLogServerIfRunning();
    await getOrStartLogServer(ctx as never);
    expect(startLogServerSpy).toHaveBeenCalledTimes(2);
  });

  it("passes version + uiDistDir derived from context", async () => {
    await getOrStartLogServer(makeContext() as never);
    expect(startLogServerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 0,
        version: "1.2.3",
        uiDistDir: "/abs/extroot/ui-dist",
        sessions: fakeSessions,
      }),
    );
  });

  it("disposes sessions when server startup fails", async () => {
    const startupError = new Error("startup failed");
    startImplementation = async () => {
      throw startupError;
    };
    await expect(getOrStartLogServer(makeContext() as never)).rejects.toBe(startupError);
    expect(fakeSessions.dispose).toHaveBeenCalledTimes(1);
  });

  it("waits for an in-flight start before closing its server and sessions", async () => {
    let resolveStart: ((server: typeof fakeServer) => void) | undefined;
    startImplementation = () =>
      new Promise((resolve) => {
        resolveStart = resolve;
      });

    const start = getOrStartLogServer(makeContext() as never);
    await vi.waitFor(() => expect(resolveStart).toBeTypeOf("function"));
    const close = closeLogServerIfRunning();
    resolveStart?.(fakeServer);

    await expect(start).resolves.toEqual({ server: fakeServer, sessions: fakeSessions });
    await close;
    expect(fakeServer.close).toHaveBeenCalledTimes(1);
    expect(fakeSessions.dispose).toHaveBeenCalledTimes(1);
  });

  it("serializes a new start behind an in-flight close", async () => {
    await getOrStartLogServer(makeContext() as never);
    let resolveClose: (() => void) | undefined;
    fakeServer.close.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );

    const close = closeLogServerIfRunning();
    await vi.waitFor(() => expect(resolveClose).toBeTypeOf("function"));
    const restart = getOrStartLogServer(makeContext() as never);
    expect(startLogServerSpy).toHaveBeenCalledTimes(1);
    resolveClose?.();

    await close;
    await restart;
    expect(startLogServerSpy).toHaveBeenCalledTimes(2);
  });

  it("still disposes sessions and surfaces an HTTP server close failure", async () => {
    const closeError = new Error("close failed");
    await getOrStartLogServer(makeContext() as never);
    fakeServer.close.mockRejectedValueOnce(closeError);
    await expect(closeLogServerIfRunning()).rejects.toBe(closeError);
    expect(fakeSessions.dispose).toHaveBeenCalledTimes(1);
  });
});
