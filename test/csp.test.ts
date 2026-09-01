// CSP + Host-guard integration test. Boots a real loopback log-server and
// exercises every header/path that mitigations T-02-04a..T-02-04c rely on.

import * as http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { type AppState, createAppState } from "../packages/server/src/app-state.js";
import { CSP_VALUE } from "../packages/server/src/csp.js";
import { type LogServerHandle, startLogServer } from "../packages/server/src/log-server.js";
import type { ActiveSession, LogSessionManager } from "../packages/server/src/session-manager.js";
import type {
  Disposable,
  HostAdapter,
  LogCandidate,
  LogHandle,
} from "../packages/shared/src/index.js";

function fakeSessions(appState: AppState): LogSessionManager {
  const active: ActiveSession = { logKey: appState.meta.logKey, appState };
  return {
    current: () => active,
    discover: async () => ({ candidates: [], truncated: false }),
    open: async () => active,
    close: async () => {},
    onChange: () => () => {},
    dispose: async () => {},
  };
}

function makeFakeHost(path: string): HostAdapter {
  return {
    discoverLogs: async (): Promise<LogCandidate[]> => [],
    openLog: async (_p: string): Promise<LogHandle> => ({ id: path }),
    watchLog: (_h: LogHandle, _onChunk: (b: Uint8Array) => void): Disposable => ({
      dispose: () => {},
    }),
    close: async (_h: LogHandle) => {},
  };
}

interface HttpResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function httpGet(opts: { port: number; path: string; hostHeader: string }): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: opts.port,
        path: opts.path,
        method: "GET",
        headers: { Host: opts.hostHeader },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function authenticatedPath(handle: LogServerHandle, path: string): string {
  const url = new URL(path, handle.url);
  url.searchParams.set("_ahpToken", handle.apiToken);
  return `${url.pathname}${url.search}`;
}

describe("log-server CSP + Host guard", () => {
  let appState: AppState | undefined;
  let handle: LogServerHandle | undefined;

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = undefined;
    }
    if (appState) {
      await appState.dispose();
      appState = undefined;
    }
  });

  async function boot(): Promise<LogServerHandle> {
    const host = makeFakeHost("/private/tmp/some-dir/example.log");
    appState = await createAppState({
      host,
      file: "/private/tmp/some-dir/example.log",
      flushIntervalMs: 0,
    });
    handle = await startLogServer({ sessions: fakeSessions(appState), port: 0, version: "0.1.0" });
    return handle;
  }

  it("returns the locked CSP + nosniff + no-referrer headers on every response", async () => {
    const h = await boot();
    const res = await httpGet({
      port: h.port,
      path: authenticatedPath(h, "/api/log/meta"),
      hostHeader: `127.0.0.1:${h.port}`,
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-security-policy"]).toBe(CSP_VALUE);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });

  it("accepts localhost as a Host header value", async () => {
    const h = await boot();
    const res = await httpGet({
      port: h.port,
      path: authenticatedPath(h, "/api/log/meta"),
      hostHeader: `localhost:${h.port}`,
    });
    expect(res.status).toBe(200);
    const meta = JSON.parse(res.body);
    expect(meta.filename).toBe("example.log");
    // T-02-03: absolute path must NEVER appear in the response body.
    expect(res.body).not.toContain("/private/tmp/some-dir");
    expect(res.body).not.toContain("/Users/");
  });

  it("rejects non-loopback Host headers with 421 Misdirected request", async () => {
    const h = await boot();
    const res = await httpGet({
      port: h.port,
      path: "/api/log/meta",
      hostHeader: "evil.example.com",
    });
    expect(res.status).toBe(421);
    expect(res.body).toContain("Misdirected request");
  });

  it("binds 127.0.0.1 only", async () => {
    const h = await boot();
    expect(h.url).toBe(`http://127.0.0.1:${h.port}`);
    const addr = h.server.address();
    expect(addr).toBeDefined();
    if (addr && typeof addr === "object") {
      expect(addr.address).toBe("127.0.0.1");
    }
  });
});
