// TailReader tests — covers append, shrink, rename, error channels (Phase 4
// INGEST-04). Uses real chokidar against tmpdir so timing is realistic; each
// `settle()` is generous to keep CI stable across filesystems.

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
  resets: Array<{ newSize: number; reason: "shrink" | "rename" }>;
  errors: Array<{ message: string; fatal: boolean }>;
}

function makeSink(): Sinks {
  const chunks: Sinks["chunks"] = [];
  const resets: Sinks["resets"] = [];
  const errors: Sinks["errors"] = [];
  const sink: WatchSink = {
    onChunk(bytes, offset) {
      chunks.push({ bytes, offset });
    },
    onReset(info) {
      resets.push(info);
    },
    onError(err, fatal) {
      errors.push({ message: err.message, fatal });
    },
  };
  return { sink, chunks, resets, errors };
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
    const { sink, chunks } = makeSink();
    await reader.readInitial(sink);
    expect(decode(chunks)).toBe('{"a":1}\n{"b":2}\n');
    expect(chunks[0]?.offset).toBe(0);
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
    expect(decode(chunks)).toContain('{"new":1}');
    await reader.dispose();
  });

  it("onError(fatal=true) fires when initial stat fails", async () => {
    const reader = new TailReader(join(dir, "does-not-exist.jsonl"));
    const { sink, errors } = makeSink();
    await reader.readInitial(sink);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]?.fatal).toBe(true);
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
});
