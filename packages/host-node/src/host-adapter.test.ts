import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NodeHostAdapter } from "./host-adapter.js";

describe("NodeHostAdapter", () => {
  const adapter = new NodeHostAdapter();
  let tmpDir: string;
  let watchFile: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "ahp-inspector-watch-"));
    watchFile = join(tmpDir, "live.jsonl");
    writeFileSync(watchFile, "line1\n");
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("openLog resolves path and reports size for tiny.jsonl", async () => {
    const handle = await adapter.openLog("./test/fixtures/tiny.jsonl");
    expect(handle.path).toMatch(/\/test\/fixtures\/tiny\.jsonl$/);
    expect(handle.size).toBeGreaterThan(0);
    expect(handle.id).toBe(handle.path);
  });

  it("openLog rejects non-existent files", async () => {
    await expect(adapter.openLog("./does-not-exist-xyz.jsonl")).rejects.toBeDefined();
  });

  it("openLog error message does not echo full user path (T-03-03)", async () => {
    let caught: Error | undefined;
    try {
      await adapter.openLog("./this/very/specific/nested/path-xyzzy.jsonl");
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeDefined();
    expect(caught?.message ?? "").not.toContain("very/specific/nested");
  });

  it("watchLog emits initial bytes equal to file contents", async () => {
    const handle = await adapter.openLog("./test/fixtures/tiny.jsonl");
    const chunks: Uint8Array[] = [];
    await new Promise<void>((resolve) => {
      const w = adapter.watchLog(handle, (c) => {
        chunks.push(c);
      });
      // Initial read is async; settle then dispose.
      setTimeout(() => {
        w.dispose();
        resolve();
      }, 250);
    });
    await adapter.close(handle);
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    expect(total).toBe(handle.size);
  });

  it("watchLog tails appended bytes within 1500ms", async () => {
    const handle = await adapter.openLog(watchFile);
    const chunks: Uint8Array[] = [];
    let initialBytes = 0;
    const w = adapter.watchLog(handle, (c) => {
      chunks.push(c);
    });
    // Wait for the initial read to finish.
    await new Promise((r) => setTimeout(r, 200));
    initialBytes = chunks.reduce((n, c) => n + c.byteLength, 0);
    expect(initialBytes).toBeGreaterThan(0);
    // Append and wait.
    appendFileSync(watchFile, "line2-appended\n");
    const appearedWithin = await new Promise<boolean>((resolve) => {
      const start = Date.now();
      const tick = setInterval(() => {
        const total = chunks.reduce((n, c) => n + c.byteLength, 0);
        if (total > initialBytes) {
          clearInterval(tick);
          resolve(true);
        } else if (Date.now() - start > 1500) {
          clearInterval(tick);
          resolve(false);
        }
      }, 50);
    });
    w.dispose();
    const firstClose = adapter.close(handle);
    const secondClose = adapter.close(handle);
    expect(secondClose).toBe(firstClose);
    await firstClose;
    expect(appearedWithin).toBe(true);
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const decoded = Buffer.concat(
      chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)),
    ).toString("utf8");
    expect(decoded).toContain("line2-appended");
    expect(total).toBeGreaterThan(initialBytes);
  }, 3000);

  it("installs the watcher before the baseline read and reconciles an immediate append", async () => {
    const file = join(tmpDir, "baseline-race.jsonl");
    writeFileSync(file, "before\n");
    const handle = await adapter.openLog(file);
    const chunks: Uint8Array[] = [];
    const w = adapter.watchLog(handle, (chunk) => {
      chunks.push(chunk);
    });
    appendFileSync(file, "during\n");

    const completed = await new Promise<boolean>((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
        if (text === "before\nduring\n") {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - started > 1500) {
          clearInterval(timer);
          resolve(false);
        }
      }, 20);
    });

    w.dispose();
    await adapter.close(handle);
    expect(completed).toBe(true);
    expect(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8")).toBe(
      "before\nduring\n",
    );
  }, 3000);

  it("discoverVsCodeLogs returns a DiscoveryResult shape", async () => {
    const result = await adapter.discoverLogs();
    expect(result).toHaveProperty("candidates");
    expect(result).toHaveProperty("truncated");
    expect(Array.isArray(result.candidates)).toBe(true);
    expect(typeof result.truncated).toBe("boolean");
  });
});
