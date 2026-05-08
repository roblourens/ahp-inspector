// TailReader — incremental file reader on top of node:fs streams.
// Tracks the byte offset consumed so chokidar 'change' events emit only
// the appended tail. RESEARCH Pattern 6 (lines 362-407).

import { createReadStream, statSync } from "node:fs";
import { watch as chokidarWatch, type FSWatcher } from "chokidar";

const CHUNK_BYTES = 256 * 1024;

export type ChunkSink = (bytes: Uint8Array) => void;

/**
 * Phase 4 (Wave 0): forward declaration of the rich watch sink. TailReader
 * adopts it in Wave 1; the existing function-based `ChunkSink` keeps the
 * Phase 2 callsite compiling until then.
 */
export interface WatchSink {
  onChunk(bytes: Uint8Array, byteOffset: number): void;
  onReset(info: { newSize: number; reason: "shrink" | "rename" }): void;
  onError(err: Error, fatal: boolean): void;
}

export class TailReader {
  readonly #path: string;
  #lastOffset = 0;
  #watcher: FSWatcher | null = null;
  #disposed = false;
  #readInFlight = false;

  constructor(path: string) {
    this.#path = path;
  }

  /**
   * Read the existing file contents from offset 0 to the current size and
   * push every chunk to `onChunk`. Resolves when the initial read finishes;
   * `lastOffset` is then advanced to that size.
   */
  readInitial(onChunk: ChunkSink): Promise<void> {
    const sizeAtStart = statSync(this.#path).size;
    if (sizeAtStart === 0) {
      this.#lastOffset = 0;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const stream = createReadStream(this.#path, {
        start: 0,
        end: sizeAtStart - 1,
        highWaterMark: CHUNK_BYTES,
      });
      stream.on("data", (buf: Buffer | string) => {
        if (typeof buf === "string") {
          const enc = new TextEncoder().encode(buf);
          onChunk(enc);
        } else {
          // Copy out of the shared internal buffer to avoid lifetime issues.
          const view = new Uint8Array(buf.byteLength);
          view.set(buf);
          onChunk(view);
        }
      });
      stream.on("end", () => {
        this.#lastOffset = sizeAtStart;
        resolve();
      });
      stream.on("error", reject);
    });
  }

  /**
   * Subscribe to file growth. Each 'change' triggers an incremental read
   * from `lastOffset` to the new size. Returns a disposer that closes the
   * watcher.
   */
  startWatch(onChunk: ChunkSink): () => void {
    if (this.#disposed) throw new Error("TailReader disposed");
    const watcher = chokidarWatch(this.#path, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: false,
    });
    this.#watcher = watcher;
    watcher.on("change", () => {
      if (this.#readInFlight) return; // coalesce — a read is already in progress
      this.#readInFlight = true;
      void this.#readTail(onChunk).finally(() => {
        this.#readInFlight = false;
      });
    });
    return () => this.dispose();
  }

  async #readTail(onChunk: ChunkSink): Promise<void> {
    let nextSize: number;
    try {
      nextSize = statSync(this.#path).size;
    } catch {
      return;
    }
    if (nextSize <= this.#lastOffset) return;
    const start = this.#lastOffset;
    const end = nextSize - 1;
    await new Promise<void>((resolve) => {
      const stream = createReadStream(this.#path, { start, end, highWaterMark: CHUNK_BYTES });
      stream.on("data", (buf: Buffer | string) => {
        if (typeof buf === "string") {
          onChunk(new TextEncoder().encode(buf));
        } else {
          const view = new Uint8Array(buf.byteLength);
          view.set(buf);
          onChunk(view);
        }
      });
      stream.on("end", () => {
        this.#lastOffset = nextSize;
        resolve();
      });
      stream.on("error", (err) => {
        console.warn("[TailReader] read error during tail:", (err as Error).message);
        resolve(); // still resolve to keep the chain going, but log the gap
      });
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#watcher) {
      void this.#watcher.close();
      this.#watcher = null;
    }
  }
}
