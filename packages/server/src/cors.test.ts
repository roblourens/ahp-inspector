import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { createCorsMiddleware } from "./cors.js";

const API_TOKEN = "test-capability";
const TOKEN_QUERY = `_ahpToken=${API_TOKEN}`;

function makeApp() {
  const app = new Hono();
  app.use("*", createCorsMiddleware(API_TOKEN));
  app.get("/x", (c) => c.text("ok"));
  app.post("/x", (c) => c.text("posted"));
  return app;
}

describe("corsMiddleware", () => {
  it("preflight echoes Origin and includes allow-methods/headers/max-age", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request(`http://localhost/x?${TOKEN_QUERY}`, {
        method: "OPTIONS",
        headers: {
          origin: "vscode-webview://abc",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type, x-foo",
        },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("vscode-webview://abc");
    const allowMethods = res.headers.get("access-control-allow-methods") ?? "";
    expect(allowMethods).toContain("POST");
    expect(allowMethods).toContain("GET");
    expect(allowMethods).toContain("OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe("content-type, x-foo");
    expect(res.headers.get("access-control-max-age")).toBe("600");
  });

  it("real GET with Origin echoes it back and sets Vary, body unchanged", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request(`http://localhost/x?${TOKEN_QUERY}`, {
        method: "GET",
        headers: { origin: "vscode-webview://abc" },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("access-control-allow-origin")).toBe("vscode-webview://abc");
    expect(res.headers.get("vary")).toContain("Origin");
  });

  it("real GET with NO Origin does not set CORS headers (standalone same-origin path)", async () => {
    const app = makeApp();
    const res = await app.fetch(new Request("http://localhost/x", { method: "GET" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("preflight without Origin does not grant wildcard CORS access", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/x", {
        method: "OPTIONS",
        headers: { "access-control-request-method": "GET" },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows the exact loopback Origin used by the standalone web app", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://127.0.0.1:5199/x", {
        method: "GET",
        headers: { origin: "http://127.0.0.1:5199" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5199");
  });

  it("rejects a disallowed Origin on GET", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/x", {
        method: "GET",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("does NOT echo a disallowed Origin on OPTIONS preflight", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/x", {
        method: "OPTIONS",
        headers: {
          origin: "https://evil.example",
          "access-control-request-method": "POST",
        },
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects a state-changing POST from a disallowed Origin with 403", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.text()).not.toBe("posted");
  });

  it("allows a state-changing POST from the exact loopback Origin", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://localhost:5199/x", {
        method: "POST",
        headers: { origin: "http://localhost:5199" },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("posted");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5199");
  });

  it("rejects a different loopback port even with a valid capability", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request(`http://127.0.0.1:5173/x?${TOKEN_QUERY}`, {
        headers: { origin: "http://localhost:31337" },
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects opaque null origins for reads and mutations", async () => {
    const app = makeApp();
    for (const method of ["GET", "POST"]) {
      const res = await app.fetch(
        new Request(`http://localhost/x?${TOKEN_QUERY}`, {
          method,
          headers: { origin: "null" },
        }),
      );
      expect(res.status).toBe(403);
    }
  });

  it("rejects vscode-webview origins without the matching capability", async () => {
    const app = makeApp();
    const missing = await app.fetch(
      new Request("http://localhost/x", {
        headers: { origin: "vscode-webview://abc" },
      }),
    );
    const wrong = await app.fetch(
      new Request("http://localhost/x?_ahpToken=wrong", {
        headers: { origin: "vscode-webview://abc" },
      }),
    );
    expect(missing.status).toBe(403);
    expect(wrong.status).toBe(403);
  });
});
