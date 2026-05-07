import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { startHealthServer } from "./health-server.js";

describe("startHealthServer", () => {
  let close: (() => Promise<void>) | undefined;
  afterEach(async () => {
    if (close) await close();
    close = undefined;
  });

  it("binds 127.0.0.1 only and serves /health on an ephemeral port", async () => {
    const handle = await startHealthServer({ port: 0, version: "0.1.0" });
    close = handle.close;
    expect(handle.url).toBe(`http://127.0.0.1:${handle.port}`);

    // Bind-address introspection — fail if address regresses to 0.0.0.0/::/etc.
    const addr = handle.server.address() as AddressInfo | string | null;
    expect(addr).not.toBeNull();
    expect(typeof addr).toBe("object");
    if (addr && typeof addr === "object") {
      expect(addr.address).toBe("127.0.0.1");
      expect(["0.0.0.0", "::", "0:0:0:0:0:0:0:0"]).not.toContain(addr.address);
    }

    const res = await fetch(`${handle.url}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", version: "0.1.0" });
  });

  it("close() releases the port", async () => {
    const handle = await startHealthServer({ port: 0, version: "0.1.0" });
    const port = handle.port;
    await handle.close();
    // After close, fetching should reject (connection refused) — not strictly
    // required by spec but a quick sanity check; tolerate any failure mode.
    let failed = false;
    try {
      await fetch(`http://127.0.0.1:${port}/health`);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});
