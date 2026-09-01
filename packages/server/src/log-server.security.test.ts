import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeHostAdapter } from "@ahp-inspector/host-node";
import { afterEach, describe, expect, it } from "vitest";
import { type LogServerHandle, startLogServer } from "./log-server.js";
import { createLogSessionManager, type LogSessionManager } from "./session-manager.js";

function createSessions(): LogSessionManager {
  return createLogSessionManager({
    host: new NodeHostAdapter(),
    resolveCandidateId: () => null,
  });
}

function authenticatedUrl(handle: LogServerHandle, path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${handle.url}${path}${separator}_ahpToken=${encodeURIComponent(handle.apiToken)}`;
}

describe("log server security and ownership", () => {
  let handle: LogServerHandle | undefined;
  let sessions: LogSessionManager | undefined;
  let uiDistDir: string | undefined;

  afterEach(async () => {
    await handle?.close();
    await sessions?.dispose();
    if (uiDistDir) await rm(uiDistDir, { recursive: true, force: true });
    handle = undefined;
    sessions = undefined;
    uiDistDir = undefined;
  });

  it("requires the capability for API reads, mutations, and SSE", async () => {
    sessions = createSessions();
    handle = await startLogServer({ sessions, port: 0, version: "test" });
    expect(handle.apiToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const missingRead = await fetch(`${handle.url}/api/sessions/active`);
    const wrongRead = await fetch(`${handle.url}/api/sessions/active?_ahpToken=wrong`);
    const missingMutation = await fetch(`${handle.url}/api/sessions/close`, {
      method: "POST",
    });
    const wrongMutation = await fetch(`${handle.url}/api/sessions/open?_ahpToken=wrong`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/private/file.jsonl" }),
    });
    const missingSse = await fetch(`${handle.url}/api/log/stream`);
    const wrongSse = await fetch(`${handle.url}/api/log/stream?_ahpToken=wrong`);
    const validSse = await fetch(authenticatedUrl(handle, "/api/log/stream"));

    for (const blocked of [
      missingRead,
      wrongRead,
      missingMutation,
      wrongMutation,
      missingSse,
      wrongSse,
    ]) {
      expect(blocked.status).toBe(403);
    }
    expect(await wrongMutation.json()).toEqual({ code: "forbidden", message: "forbidden" });
    expect(validSse.status).toBe(409);
    expect(JSON.stringify(await missingRead.json())).not.toContain(handle.apiToken);
  });

  it("rejects null and unauthenticated webview origins, but allows authenticated clients", async () => {
    sessions = createSessions();
    handle = await startLogServer({ sessions, port: 0, version: "test" });
    const url = authenticatedUrl(handle, "/api/sessions/active");

    const nullOrigin = await fetch(url, { headers: { origin: "null" } });
    const nullOriginMutation = await fetch(authenticatedUrl(handle, "/api/sessions/close"), {
      method: "POST",
      headers: { origin: "null" },
    });
    const nullOriginSse = await fetch(authenticatedUrl(handle, "/api/log/stream"), {
      headers: { origin: "null" },
    });
    const untrustedWebview = await fetch(`${handle.url}/api/sessions/active`, {
      headers: { origin: "vscode-webview://untrusted" },
    });
    const standalone = await fetch(url, {
      headers: { origin: `http://127.0.0.1:${handle.port}` },
    });
    const webview = await fetch(url, {
      headers: { origin: "vscode-webview://trusted-panel" },
    });

    expect(nullOrigin.status).toBe(403);
    expect(nullOriginMutation.status).toBe(403);
    expect(nullOriginSse.status).toBe(403);
    expect(untrustedWebview.status).toBe(403);
    expect(standalone.status).toBe(200);
    expect(webview.status).toBe(200);
    expect(webview.headers.get("access-control-allow-origin")).toBe(
      "vscode-webview://trusted-panel",
    );
  });

  it("keeps health unauthenticated and injects the token into standalone HTML only", async () => {
    uiDistDir = await mkdtemp(join(tmpdir(), "ahp-ui-dist-"));
    await writeFile(
      join(uiDistDir, "index.html"),
      "<!doctype html><html><head><title>Test</title></head><body></body></html>",
    );
    sessions = createSessions();
    handle = await startLogServer({
      sessions,
      port: 0,
      version: "1.2.3",
      uiDistDir,
    });

    const health = await fetch(`${handle.url}/health`);
    const crossOriginRoot = await fetch(handle.url, {
      headers: { origin: "https://attacker.example" },
    });
    const loopbackAttackerRoot = await fetch(handle.url, {
      headers: { origin: "http://localhost:31337" },
    });
    const loopbackAttackerHealth = await fetch(`${handle.url}/health`, {
      headers: { origin: "http://localhost:31337" },
    });
    const root = await fetch(handle.url);
    const html = await root.text();

    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok", version: "1.2.3" });
    expect(crossOriginRoot.status).toBe(403);
    expect(await crossOriginRoot.text()).not.toContain(handle.apiToken);
    expect(loopbackAttackerRoot.status).toBe(403);
    expect(await loopbackAttackerRoot.text()).not.toContain(handle.apiToken);
    expect(loopbackAttackerHealth.status).toBe(403);
    expect(loopbackAttackerHealth.headers.get("access-control-allow-origin")).toBeNull();
    expect(root.headers.get("cache-control")).toBe("no-store");
    expect(root.headers.get("referrer-policy")).toBe("no-referrer");
    expect(html).toContain(`<meta name="ahp-api-token" content="${handle.apiToken}" />`);
    expect(handle.url).not.toContain(handle.apiToken);
  });

  it("retains upload ownership, removes temporary uploads, and closes idempotently", async () => {
    const managedSessions = createSessions();
    let uploadedPath: string | undefined;
    sessions = {
      ...managedSessions,
      async open(input) {
        if ("path" in input) uploadedPath = input.path;
        return managedSessions.open(input);
      },
    };
    const exitListenersBefore = process.listenerCount("exit");
    handle = await startLogServer({ sessions, port: 0, version: "test" });
    expect(process.listenerCount("exit")).toBe(exitListenersBefore);

    const upload = await fetch(authenticatedUrl(handle, "/api/sessions/upload"), {
      method: "POST",
      headers: { "x-filename": "owned.jsonl" },
      body: '{"jsonrpc":"2.0","method":"test"}\n',
    });
    expect(upload.status).toBe(200);
    expect(uploadedPath).toBeTypeOf("string");
    expect(existsSync(uploadedPath ?? "")).toBe(true);

    const stream = await fetch(authenticatedUrl(handle, "/api/log/stream"));
    expect(stream.status).toBe(200);
    await Promise.all([handle.close(), handle.close()]);
    await stream.body?.cancel().catch(() => undefined);
    expect(existsSync(uploadedPath ?? "")).toBe(false);
    expect(process.listenerCount("exit")).toBe(exitListenersBefore);
    handle = undefined;
  });

  it("preserves the strict loopback Host guard", async () => {
    sessions = createSessions();
    handle = await startLogServer({ sessions, port: 0, version: "test" });
    const running = handle;
    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = request(authenticatedUrl(running, "/api/sessions/active"), {
        headers: { host: "attacker.example" },
      });
      req.on("response", (res) => {
        res.setEncoding("utf8");
        let body = "";
        res.on("data", (chunk: string) => {
          body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on("error", reject);
      req.end();
    });
    expect(response.status).toBe(421);
    expect(response.body).toBe("Misdirected request");
  });
});
