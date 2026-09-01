// TailReader tests — covers append, shrink, rename, error channels (Phase 4
// INGEST-04). Uses real chokidar against tmpdir so timing is realistic; each
// `settle()` is generous to keep CI stable across filesystems.

import { appendFileSync, writeFileSync } from "node:fs";
import { appendFile, mkdtemp, rm, truncate, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TailReader, type WatchSink } from "./tail-reader.js";

let dir: string;
let path: string;

interface Sinks {
  sink: WatchSink;
  chunks: Array<{ bytes: Uint8Array; offset: number }>;
  initialStarts: Array<{ totalBytes: number }>;
  initialProgress: Array<{ loadedBytes: number; totalBytes: number }>;
  initialCompletes: Array<{ loadedBytes: number; totalBytes: number }>;
  resets: Array<{ newSize: number; reason: "shrink" | "rename" }>;
  errors: Array<{ code: string | undefined; message: string; fatal: boolean }>;
}

function makeSink(): Sinks {
  const chunks: Sinks["chunks"] = [];
  const initialStarts: Sinks["initialStarts"] = [];
  const initialProgress: Sinks["initialProgress"] = [];
  const initialCompletes: Sinks["initialCompletes"] = [];
  const resets: Sinks["resets"] = [];
  const errors: Sinks["errors"] = [];
  const sink: WatchSink = {
    onChunk(bytes, offset) {
      chunks.push({ bytes, offset });
    },
    onInitialReadStart(info) {
      initialStarts.push(info);
    },
    onInitialReadProgress(info) {
      initialProgress.push(info);
    },
    onInitialReadComplete(info) {
      initialCompletes.push(info);
    },
    onReset(info) {
      resets.push(info);
    },
    onError(err, fatal) {
      errors.push({
        code: "code" in err && typeof err.code === "string" ? err.code : undefined,
        message: err.message,
        fatal,
      });
    },
  };
  return { sink, chunks, initialStarts, initialProgress, initialCompletes, resets, errors };
}

const decode = (chunks: Array<{ bytes: Uint8Array }>): string =>
  chunks.map((c) => new TextDecoder().decode(c.bytes)).join("");

const settle = (ms = 200): Promise<void> => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ahp-tail-"));
  path = join(dir, "log.jsonl");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("TailReader", () => {
  it("readInitial reads existing content into onChunk", async () => {
    await writeFile(path, '{"a":1}\n{"b":2}\n');
    const reader = new TailReader(path);
    const { sink, chunks, initialCompletes, initialProgress, initialStarts } = makeSink();
    await reader.readInitial(sink);
    expect(decode(chunks)).toBe('{"a":1}\n{"b":2}\n');
    expect(chunks[0]?.offset).toBe(0);
    expect(initialStarts).toEqual([{ totalBytes: 16 }]);
    expect(initialProgress.at(-1)).toEqual({ loadedBytes: 16, totalBytes: 16 });
    expect(initialCompletes).toEqual([{ loadedBytes: 16, totalBytes: 16 }]);
    await reader.dispose();
  });

  it("readInitial completes empty files without inventing byte progress", async () => {
    await writeFile(path, "");
    const reader = new TailReader(path);
    const { sink, initialCompletes, initialProgress, initialStarts } = makeSink();

    await reader.readInitial(sink);

    expect(initialStarts).toEqual([{ totalBytes: 0 }]);
    expect(initialProgress).toEqual([]);
    expect(initialCompletes).toEqual([{ loadedBytes: 0, totalBytes: 0 }]);
    await reader.dispose();
  });

  it("startWatch streams appended content from the previous offset", async () => {
    await writeFile(path, '{"a":1}\n');
    const reader = new TailReader(path);
    const { sink, chunks } = makeSink();
    await reader.readInitial(sink);
    chunks.length = 0;
    reader.startWatch(sink);
    await settle(150);
    await appendFile(path, '{"b":2}\n');
    await settle(500);
    expect(decode(chunks)).toBe('{"b":2}\n');
    expect(chunks[0]?.offset).toBe('{"a":1}\n'.length);
    await reader.dispose();
  });

  it("coalesces rapid change events without duplicating appended ranges", async () => {
    await writeFile(path, '{"a":1}\n');
    const reader = new TailReader(path);
    const { sink, chunks } = makeSink();
    await reader.readInitial(sink);
    chunks.length = 0;
    reader.startWatch(sink);
    await settle(150);

    appendFileSync(path, '{"b":2}\n');
    appendFileSync(path, '{"c":3}\n');
    await settle(500);

    expect(decode(chunks)).toBe('{"b":2}\n{"c":3}\n');
    expect(chunks[0]?.offset).toBe(8);
    await reader.dispose();
  });

  it("reconciles appends made during the initial read without loss or duplication", async () => {
    await writeFile(path, '{"a":1}\n');
    const reader = new TailReader(path);
    const observed = makeSink();
    let appended = false;
    const sink: WatchSink = {
      ...observed.sink,
      onInitialReadStart(info) {
        observed.sink.onInitialReadStart?.(info);
        if (!appended) {
          appended = true;
          appendFileSync(path, '{"b":2}\n');
        }
      },
    };

    reader.startWatch(sink);
    await reader.readInitial(sink);
    await settle(250);

    expect(decode(observed.chunks)).toBe('{"a":1}\n{"b":2}\n');
    expect(observed.chunks.map((chunk) => chunk.offset)).toEqual([0, 8]);
    await reader.dispose();
  });

  it("onReset fires on truncate / shrink", async () => {
    await writeFile(path, '{"a":1}\n{"b":2}\n');
    const reader = new TailReader(path);
    const { sink, resets } = makeSink();
    await reader.readInitial(sink);
    reader.startWatch(sink);
    await settle(150);
    await truncate(path, 0);
    await settle(500);
    expect(resets.length).toBeGreaterThanOrEqual(1);
    expect(resets[0]?.reason).toBe("shrink");
    await reader.dispose();
  });

  it("onReset fires on unlink + add (rename/replace)", async () => {
    await writeFile(path, '{"a":1}\n{"b":2}\n');
    const reader = new TailReader(path);
    const { sink, resets, chunks } = makeSink();
    await reader.readInitial(sink);
    reader.startWatch(sink);
    await settle(200);
    await unlink(path);
    await settle(200);
    chunks.length = 0;
    await writeFile(path, '{"new":1}\n');
    await settle(800);
    expect(resets.some((r) => r.reason === "rename")).toBe(true);
    expect(decode(chunks)).toBe('{"new":1}\n');
    await reader.dispose();
  });

  it("onError(fatal=true) fires when initial stat fails", async () => {
    const missingPath = join(dir, "private", "does-not-exist.jsonl");
    const reader = new TailReader(missingPath);
    const { sink, errors, initialCompletes, initialStarts } = makeSink();
    await reader.readInitial(sink);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]?.fatal).toBe(true);
    expect(errors[0]?.code).toBe("read-stat-failed");
    expect(errors[0]?.message).not.toContain(dir);
    expect(initialStarts).toEqual([]);
    expect(initialCompletes).toEqual([]);
    await reader.dispose();
  });

  it("dispose() awaits watcher close and rejects subsequent startWatch", async () => {
    await writeFile(path, "hello\n");
    const reader = new TailReader(path);
    const { sink } = makeSink();
    await reader.readInitial(sink);
    reader.startWatch(sink);
    await reader.dispose();
    expect(() => reader.startWatch(sink)).toThrow(/disposed/);
  });

  it("surfaces sink callback failures through the read and shutdown promises", async () => {
    await writeFile(path, "hello\n");
    const reader = new TailReader(path);
    const observed = makeSink();
    const sink: WatchSink = {
      ...observed.sink,
      onChunk() {
        throw new Error("sink failed");
      },
    };

    await expect(reader.readInitial(sink)).rejects.toMatchObject({
      code: "reader-callback-failed",
    });
    await expect(reader.dispose()).rejects.toMatchObject({
      code: "reader-callback-failed",
    });
  });

  it("never emits chunks from an old read after a queued shrink reset", async () => {
    await writeFile(path, "");
    const reader = new TailReader(path);
    const observed = makeSink();
    const order: string[] = [];
    let replaced = false;
    const sink: WatchSink = {
      ...observed.sink,
      onChunk(bytes, offset) {
        const text = new TextDecoder().decode(bytes);
        order.push(text.startsWith("N") ? "new-chunk" : "old-chunk");
        observed.sink.onChunk(bytes, offset);
        if (!replaced && text.startsWith("O")) {
          replaced = true;
          writeFileSync(path, "N\n");
        }
      },
      onReset(info) {
        order.push("reset");
        observed.sink.onReset(info);
      },
    };

    reader.startWatch(sink);
    await reader.readInitial(sink);
    appendFileSync(path, `${"O".repeat(512 * 1024)}\n`);
    await settle(1200);

    const resetIndex = order.indexOf("reset");
    expect(resetIndex).toBeGreaterThanOrEqual(0);
    expect(order.slice(resetIndex + 1)).not.toContain("old-chunk");
    expect(order.slice(resetIndex + 1)).toContain("new-chunk");
    expect(decode(observed.chunks.slice(-1))).toBe("N\n");
    expect(observed.chunks.at(-1)?.offset).toBe(0);
    await reader.dispose();
  }, 3000);
});
