// TailReader — incremental file reader on top of node:fs streams.
// Tracks the byte offset consumed so chokidar 'change'/'unlink'/'add' events
// emit only the appended tail or signal rotation. RESEARCH Pattern 6
// (lines 362-407) + Phase 4 INGEST-04 (shrink/rename/error channels).

import { createReadStream } from "node:fs";
import { stat as fsStat } from "node:fs/promises";
import { watch as chokidarWatch, type FSWatcher } from "chokidar";

const CHUNK_BYTES = 256 * 1024;

export type ChunkSink = (bytes: Uint8Array) => void;

export interface InitialReadProgress {
  readonly loadedBytes: number;
  readonly totalBytes: number;
}

export interface InitialReadStart {
  readonly totalBytes: number;
}

interface ReadRangeResult {
  readonly completed: boolean;
  readonly nextOffset: number;
}

/**
 * Rich watch sink (Phase 4 INGEST-04). TailReader pushes growth via
 * `onChunk(bytes, byteOffset)`, signals shrink/rename via `onReset`, and
 * surfaces stat/stream/watcher errors via `onError(err, fatal)` instead of
 * console.warn (D-11/D-12).
 */
export interface WatchSink {
  onChunk(bytes: Uint8Array, byteOffset: number): void;
  onInitialReadStart?(info: InitialReadStart): void;
  onInitialReadProgress?(info: InitialReadProgress): void;
  onInitialReadComplete?(info: InitialReadProgress): void;
  onReset(info: { newSize: number; reason: "shrink" | "rename" }): void;
  onError(err: Error, fatal: boolean): void;
}

/** Wrap a legacy single-arg ChunkSink into a WatchSink that ignores reset/error. */
export function chunkSinkToWatchSink(fn: ChunkSink): WatchSink {
  return {
    onChunk: (bytes) => fn(bytes),
    onReset: () => {},
    onError: () => {},
  };
}

export class TailReader {
  readonly #path: string;
  #lastOffset = 0;
  #watcher: FSWatcher | null = null;
  #disposed = false;
  #readInFlight = false;
  #readAgainAfterCurrent = false;
  #unlinkPending = false;

  constructor(path: string) {
    this.#path = path;
  }

  /**
   * Read the existing file contents from offset 0 to the current size and
   * push every chunk to `sink.onChunk`. On stat or stream error, calls
   * `sink.onError(err, fatal=true)` and resolves; never throws.
   */
  async readInitial(sink: WatchSink): Promise<void> {
    let sizeAtStart: number;
    try {
      sizeAtStart = (await fsStat(this.#path)).size;
    } catch (err) {
      sink.onError(err as Error, true);
      this.#lastOffset = 0;
      return;
    }
    sink.onInitialReadStart?.({ totalBytes: sizeAtStart });
    if (sizeAtStart === 0) {
      this.#lastOffset = 0;
      sink.onInitialReadComplete?.({ loadedBytes: 0, totalBytes: 0 });
      return;
    }
    const result = await this.#readRange(0, sizeAtStart, sink, (loadedBytes) => {
      sink.onInitialReadProgress?.({ loadedBytes, totalBytes: sizeAtStart });
    });
    this.#lastOffset = result.nextOffset;
    if (result.completed && result.nextOffset >= sizeAtStart) {
      sink.onInitialReadComplete?.({ loadedBytes: sizeAtStart, totalBytes: sizeAtStart });
    }
  }

  /**
   * Subscribe to file growth, rotation, and errors. Returns a disposer that
   * closes the watcher (async; fire-and-forget — call dispose() directly to
   * await the close).
   */
  startWatch(sink: WatchSink): () => void {
    if (this.#disposed) throw new Error("TailReader disposed");
    const watcher = chokidarWatch(this.#path, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 10 },
    });
    this.#watcher = watcher;

    watcher.on("change", () => {
      void this.#onChange(sink);
    });
    watcher.on("unlink", () => {
      this.#unlinkPending = true;
    });
    watcher.on("add", () => {
      if (this.#unlinkPending) {
        this.#unlinkPending = false;
        void this.#onRotation(sink, "rename");
      }
    });
    watcher.on("error", (err) => {
      sink.onError(err as Error, true);
    });

    return () => {
      void this.dispose();
    };
  }

  async #onChange(sink: WatchSink): Promise<void> {
    if (this.#readInFlight) {
      this.#readAgainAfterCurrent = true;
      return;
    }
    this.#readInFlight = true;
    try {
      let nextSize: number;
      try {
        nextSize = (await fsStat(this.#path)).size;
      } catch (err) {
        sink.onError(err as Error, false);
        return;
      }
      if (nextSize < this.#lastOffset) {
        await this.#onRotation(sink, "shrink", nextSize);
        return;
      }
      if (nextSize === this.#lastOffset) return;
      const start = this.#lastOffset;
      const result = await this.#readRange(start, nextSize, sink);
      this.#lastOffset = result.nextOffset;
    } finally {
      this.#readInFlight = false;
      if (this.#readAgainAfterCurrent && !this.#disposed) {
        this.#readAgainAfterCurrent = false;
        void this.#onChange(sink);
      }
    }
  }

  async #onRotation(
    sink: WatchSink,
    reason: "shrink" | "rename",
    knownSize?: number,
  ): Promise<void> {
    let newSize = knownSize;
    if (newSize === undefined) {
      try {
        newSize = (await fsStat(this.#path)).size;
      } catch (err) {
        sink.onError(err as Error, false);
        newSize = 0;
      }
    }
    this.#lastOffset = 0;
    sink.onReset({ newSize, reason });
    if (newSize > 0) {
      const result = await this.#readRange(0, newSize, sink);
      this.#lastOffset = result.nextOffset;
    }
  }

  #readRange(
    start: number,
    end: number,
    sink: WatchSink,
    onProgress?: (loadedBytes: number) => void,
  ): Promise<ReadRangeResult> {
    return new Promise<ReadRangeResult>((resolve) => {
      const stream = createReadStream(this.#path, {
        start,
        end: end - 1,
        highWaterMark: CHUNK_BYTES,
      });
      let cursor = start;
      stream.on("data", (buf: Buffer | string) => {
        const bytes =
          typeof buf === "string"
            ? new TextEncoder().encode(buf)
            : (() => {
                // Copy out of the shared internal buffer to avoid lifetime issues.
                const v = new Uint8Array(buf.byteLength);
                v.set(buf);
                return v;
              })();
        sink.onChunk(bytes, cursor);
        cursor += bytes.byteLength;
        onProgress?.(cursor);
      });
      stream.on("end", () => resolve({ completed: true, nextOffset: cursor }));
      stream.on("error", (err) => {
        sink.onError(err as Error, false);
        resolve({ completed: false, nextOffset: cursor }); // keep the watcher alive
      });
    });
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    const w = this.#watcher;
    this.#watcher = null;
    if (w) {
      try {
        await w.close();
      } catch {
        /* ignore */
      }
    }
  }
}
