// upload-routes.test.ts — POST /api/sessions/upload smoke + privacy.

import { NodeHostAdapter } from "@ahp-inspector/host-node";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createLogSessionManager } from "./session-manager.js";
import { registerUploadRoutes } from "./upload-routes.js";

function makeApp() {
  const sessions = createLogSessionManager({
    host: new NodeHostAdapter(),
    resolveCandidateId: () => null,
  });
  const app = new Hono();
  const handle = registerUploadRoutes(app, sessions);
  return { app, sessions, handle };
}

describe("upload routes", () => {
  it("rejects missing X-Filename with 400 bad-request", async () => {
    const { app, handle, sessions } = makeApp();
    const res = await app.request("/api/sessions/upload", {
      method: "POST",
      body: new Uint8Array([0x7b, 0x7d]),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("bad-request");
    await handle.dispose();
    await sessions.dispose();
  });

  it("rejects non-.jsonl filenames with 400 not-jsonl", async () => {
    const { app, handle, sessions } = makeApp();
    const res = await app.request("/api/sessions/upload", {
      method: "POST",
      headers: { "x-filename": "log.txt" },
      body: new Uint8Array([0x7b]),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("not-jsonl");
    await handle.dispose();
    await sessions.dispose();
  });

  it("rejects empty body with 400 bad-request", async () => {
    const { app, handle, sessions } = makeApp();
    const res = await app.request("/api/sessions/upload", {
      method: "POST",
      headers: { "x-filename": "log.jsonl" },
      body: new Uint8Array(),
    });
    expect(res.status).toBe(400);
    await handle.dispose();
    await sessions.dispose();
  });

  it("rejects oversize Content-Length with 413 too-large", async () => {
    const { app, handle, sessions } = makeApp();
    const res = await app.request("/api/sessions/upload", {
      method: "POST",
      headers: {
        "x-filename": "log.jsonl",
        "content-length": String(200 * 1024 * 1024),
      },
      body: new Uint8Array([0x7b]),
    });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { code: string }).code).toBe("too-large");
    await handle.dispose();
    await sessions.dispose();
  });

  it("opens an active session and never echoes the temp path or filename", async () => {
    const { app, handle, sessions } = makeApp();
    const filename = "secret-name.jsonl";
    const body = new TextEncoder().encode('{"a":1}\n');
    const res = await app.request("/api/sessions/upload", {
      method: "POST",
      headers: { "x-filename": filename },
      body,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      active: { logKey: string; meta: { filename: string } };
    };
    expect(json.active.logKey).toMatch(/^[0-9a-f]{32}$/);
    // Server uses the (sanitized) original basename as the active filename.
    expect(json.active.meta.filename).toBe(filename);
    expect(sessions.current()?.logKey).toBe(json.active.logKey);
    await handle.dispose();
    await sessions.dispose();
  });

  it("strips path separators from the uploaded filename", async () => {
    const { app, handle, sessions } = makeApp();
    const body = new TextEncoder().encode('{"a":1}\n');
    const res = await app.request("/api/sessions/upload", {
      method: "POST",
      headers: { "x-filename": encodeURIComponent("../../etc/evil.jsonl") },
      body,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { active: { meta: { filename: string } } };
    expect(json.active.meta.filename).toBe("evil.jsonl");
    await handle.dispose();
    await sessions.dispose();
  });
});
