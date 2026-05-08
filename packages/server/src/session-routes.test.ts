// session-routes.test.ts — Phase 04-03 Task 2.
// Verifies the /api/sessions/* endpoints and that error bodies never echo
// the user-typed path (T-04-03-02).

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeHostAdapter } from "@ahp-viewer/host-node";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createLogSessionManager } from "./session-manager.js";
import { registerSessionRoutes } from "./session-routes.js";

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), "ahp-sess-rt-"));
  const path = join(dir, "log.jsonl");
  await writeFile(path, '{"x":1}\n');
  const sessions = createLogSessionManager({
    host: new NodeHostAdapter(),
    resolveCandidateId: () => null,
  });
  const app = new Hono();
  registerSessionRoutes(app, sessions);
  return { app, sessions, path };
}

describe("session routes", () => {
  it("GET /api/sessions/active returns null initially", async () => {
    const { app, sessions } = await makeApp();
    const res = await app.request("/api/sessions/active");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ active: null });
    await sessions.dispose();
  });

  it("POST /api/sessions/open with {path} returns active+logKey and never echoes the path", async () => {
    const { app, sessions, path } = await makeApp();
    const res = await app.request("/api/sessions/open", {
      method: "POST",
      body: JSON.stringify({ path }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { active: { logKey: string; meta: { filename: string } } };
    expect(body.active.logKey).toMatch(/^[0-9a-f]{32}$/);
    expect(body.active.meta.filename).toBe("log.jsonl");
    // Privacy: full path must NOT appear anywhere in the JSON response.
    const text = JSON.stringify(body);
    expect(text).not.toContain(path);
    await sessions.dispose();
  });

  it("POST /api/sessions/open with bad body returns 400 bad-request", async () => {
    const { app, sessions } = await makeApp();
    const res = await app.request("/api/sessions/open", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("bad-request");
    await sessions.dispose();
  });

  it("POST /api/sessions/open with missing path returns 404 not-found and no path echo", async () => {
    const { app, sessions } = await makeApp();
    const ghost = "/tmp/definitely-not-real-7777.jsonl";
    const res = await app.request("/api/sessions/open", {
      method: "POST",
      body: JSON.stringify({ path: ghost }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).not.toContain(ghost);
    await sessions.dispose();
  });

  it("POST /api/sessions/close returns active:null", async () => {
    const { app, sessions } = await makeApp();
    const res = await app.request("/api/sessions/close", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ active: null });
    await sessions.dispose();
  });

  it("GET /api/sessions/discover returns candidates+truncated", async () => {
    const { app, sessions } = await makeApp();
    const res = await app.request("/api/sessions/discover");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { candidates: unknown[]; truncated: boolean };
    expect(Array.isArray(body.candidates)).toBe(true);
    expect(typeof body.truncated).toBe("boolean");
    await sessions.dispose();
  });
});
