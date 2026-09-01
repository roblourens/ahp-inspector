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

export type TailReaderErrorCode =
  | "read-stat-failed"
  | "read-stream-failed"
  | "reader-callback-failed"
  | "watch-failed"
  | "watch-close-failed";

const ERROR_MESSAGES: Record<TailReaderErrorCode, string> = {
  "read-stat-failed": "Unable to read log metadata.",
  "read-stream-failed": "Unable to read log data.",
  "reader-callback-failed": "The log reader callback failed.",
  "watch-failed": "Unable to watch the log for changes.",
  "watch-close-failed": "Unable to stop watching the log.",
};

export class TailReaderError extends Error {
  readonly systemCode: string | undefined;

  constructor(
    readonly code: TailReaderErrorCode,
    cause?: unknown,
  ) {
    const systemCode =
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      typeof cause.code === "string" &&
      /^[A-Z0-9_]+$/.test(cause.code)
        ? ` (${cause.code})`
        : "";
    super(`${ERROR_MESSAGES[code].slice(0, -1)}${systemCode}.`, { cause });
    this.name = "TailReaderError";
    this.systemCode = systemCode.length > 0 ? systemCode.slice(2, -1) : undefined;
  }
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
  #unlinkPending = false;
  #reconcileQueued = false;
  #operationQueue: Promise<void> = Promise.resolve();
  #operationFailure: TailReaderError | null = null;
  #activeStream: ReturnType<typeof createReadStream> | null = null;
  #watchReady: Promise<void> = Promise.resolve();
  #resolveWatchReady: (() => void) | null = null;
  #disposePromise: Promise<void> | null = null;

  constructor(path: string) {
    this.#path = path;
  }

  /**
   * Read the existing file contents from offset 0 to the current size and
   * push every chunk to `sink.onChunk`. Errors are reported through
   * `sink.onError`; callback failures also reject the returned promise.
   */
  async readInitial(sink: WatchSink): Promise<void> {
    await this.#enqueue(async () => {
      await this.#watchReady;
      if (this.#disposed) return;
      const completed = await this.#readSnapshot(sink);
      await this.#reconcile(sink);
      if (completed === false) await this.#completeRecoveredInitialRead(sink);
    });
  }

  async #readSnapshot(sink: WatchSink, knownSize?: number): Promise<boolean | null> {
    let sizeAtStart = knownSize;
    if (sizeAtStart === undefined) {
      try {
        sizeAtStart = (await fsStat(this.#path)).size;
      } catch (err) {
        this.#reportError(sink, new TailReaderError("read-stat-failed", err), true);
        this.#lastOffset = 0;
        return null;
      }
    }
    sink.onInitialReadStart?.({ totalBytes: sizeAtStart });
    if (sizeAtStart === 0) {
      this.#lastOffset = 0;
      sink.onInitialReadComplete?.({ loadedBytes: 0, totalBytes: 0 });
      return true;
    }
    const result = await this.#readRange(0, sizeAtStart, sink, (loadedBytes) => {
      sink.onInitialReadProgress?.({ loadedBytes, totalBytes: sizeAtStart });
    });
    this.#lastOffset = result.nextOffset;
    if (result.completed && result.nextOffset >= sizeAtStart) {
      sink.onInitialReadComplete?.({ loadedBytes: sizeAtStart, totalBytes: sizeAtStart });
      return true;
    }
    return false;
  }

  async #completeRecoveredInitialRead(sink: WatchSink): Promise<void> {
    let size: number;
    try {
      size = (await fsStat(this.#path)).size;
    } catch (err) {
      this.#reportError(sink, new TailReaderError("read-stat-failed", err), false);
      return;
    }
    if (this.#lastOffset >= size) {
      sink.onInitialReadComplete?.({ loadedBytes: size, totalBytes: size });
    }
  }

  /**
   * Subscribe to file growth, rotation, and errors. The owner must call and
   * await `dispose()` to stop the watcher and any active read.
   */
  startWatch(sink: WatchSink): void {
    if (this.#disposed) throw new Error("TailReader disposed");
    if (this.#watcher) throw new Error("TailReader watch already started");
    const watcher = chokidarWatch(this.#path, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 10 },
    });
    this.#watcher = watcher;
    this.#watchReady = new Promise<void>((resolve) => {
      this.#resolveWatchReady = resolve;
    });

    watcher.on("change", () => {
      this.#queueReconcile(sink);
    });
    watcher.on("unlink", () => {
      this.#queueEvent(
        this.#enqueue(async () => {
          this.#unlinkPending = true;
        }),
        sink,
      );
    });
    watcher.on("add", () => {
      this.#queueEvent(
        this.#enqueue(async () => {
          if (!this.#unlinkPending) return;
          this.#unlinkPending = false;
          await this.#onRotation(sink, "rename");
        }),
        sink,
      );
    });
    watcher.on("ready", () => {
      this.#resolveWatchReady?.();
      this.#resolveWatchReady = null;
    });
    watcher.on("error", (err) => {
      this.#resolveWatchReady?.();
      this.#resolveWatchReady = null;
      this.#reportError(sink, new TailReaderError("watch-failed", err), true);
    });
  }

  #queueReconcile(sink: WatchSink): void {
    if (this.#reconcileQueued || this.#disposed) return;
    this.#reconcileQueued = true;
    this.#queueEvent(
      this.#enqueue(async () => {
        this.#reconcileQueued = false;
        await this.#reconcile(sink);
      }),
      sink,
    );
  }

  async #reconcile(sink: WatchSink): Promise<void> {
    let nextSize: number;
    try {
      nextSize = (await fsStat(this.#path)).size;
    } catch (err) {
      this.#reportError(sink, new TailReaderError("read-stat-failed", err), false);
      return;
    }
    if (nextSize < this.#lastOffset) {
      await this.#onRotation(sink, "shrink", nextSize);
      return;
    }
    if (nextSize === this.#lastOffset) return;
    const result = await this.#readRange(this.#lastOffset, nextSize, sink);
    this.#lastOffset = result.nextOffset;
  }

  async #onRotation(
    sink: WatchSink,
    reason: "shrink" | "rename",
    knownSize?: number,
  ): Promise<void> {
    let newSize = knownSize;
    let readable = true;
    if (newSize === undefined) {
      try {
        newSize = (await fsStat(this.#path)).size;
      } catch (err) {
        this.#reportError(sink, new TailReaderError("read-stat-failed", err), false);
        newSize = 0;
        readable = false;
      }
    }
    this.#lastOffset = 0;
    sink.onReset({ newSize, reason });
    if (readable) await this.#readSnapshot(sink, newSize);
  }

  #readRange(
    start: number,
    end: number,
    sink: WatchSink,
    onProgress?: (loadedBytes: number) => void,
  ): Promise<ReadRangeResult> {
    return new Promise<ReadRangeResult>((resolve, reject) => {
      const stream = createReadStream(this.#path, {
        start,
        end: end - 1,
        highWaterMark: CHUNK_BYTES,
      });
      this.#activeStream = stream;
      let cursor = start;
      let settled = false;
      const finish = (result: ReadRangeResult): void => {
        if (settled) return;
        settled = true;
        if (this.#activeStream === stream) this.#activeStream = null;
        resolve(result);
      };
      const fail = (err: unknown): void => {
        if (settled) return;
        settled = true;
        if (this.#activeStream === stream) this.#activeStream = null;
        stream.destroy();
        reject(new TailReaderError("reader-callback-failed", err));
      };
      stream.on("data", (buf: Buffer | string) => {
        if (this.#disposed) return;
        const bytes =
          typeof buf === "string"
            ? new TextEncoder().encode(buf)
            : (() => {
                // Copy out of the shared internal buffer to avoid lifetime issues.
                const v = new Uint8Array(buf.byteLength);
                v.set(buf);
                return v;
              })();
        try {
          sink.onChunk(bytes, cursor);
          cursor += bytes.byteLength;
          onProgress?.(cursor);
        } catch (err) {
          fail(err);
        }
      });
      stream.on("end", () => finish({ completed: true, nextOffset: cursor }));
      stream.on("error", (err) => {
        if (!this.#disposed) {
          this.#reportError(sink, new TailReaderError("read-stream-failed", err), false);
        }
        finish({ completed: false, nextOffset: cursor });
      });
      stream.on("close", () => finish({ completed: false, nextOffset: cursor }));
    });
  }

  #enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.#operationQueue.then(async () => {
      if (this.#disposed) return;
      await operation();
    });
    this.#operationQueue = result.catch((err) => {
      this.#operationFailure ??= new TailReaderError("reader-callback-failed", err);
    });
    return result;
  }

  #queueEvent(operation: Promise<void>, sink: WatchSink): void {
    void operation.catch((err) => {
      const failure = new TailReaderError("reader-callback-failed", err);
      this.#operationFailure ??= failure;
      if (!this.#disposed) this.#reportError(sink, failure, true);
    });
  }

  #reportError(sink: WatchSink, error: TailReaderError, fatal: boolean): void {
    try {
      sink.onError(error, fatal);
    } catch (err) {
      this.#operationFailure ??= new TailReaderError("reader-callback-failed", err);
    }
  }

  dispose(): Promise<void> {
    if (this.#disposePromise) return this.#disposePromise;
    this.#disposed = true;
    this.#resolveWatchReady?.();
    this.#resolveWatchReady = null;
    this.#activeStream?.destroy();
    const w = this.#watcher;
    this.#watcher = null;
    this.#disposePromise = (async () => {
      await this.#operationQueue;
      if (w) {
        try {
          await w.close();
        } catch (err) {
          throw new TailReaderError("watch-close-failed", err);
        }
      }
      if (this.#operationFailure) throw this.#operationFailure;
    })();
    return this.#disposePromise;
  }
}
