// upload-routes.ts — POST /api/sessions/upload
//
// Accepts a raw JSONL body when the browser cannot expose a real filesystem
// path (e.g. a Finder→Chrome drop on http://localhost, where dataTransfer
// only carries a `Files` entry with no `text/uri-list`). The bytes are
// written to a per-process temp directory and opened as a normal session.
// Tailing is harmless on a static temp file.
//
// Privacy: error responses never echo the uploaded filename or temp path.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, basename as pathBasename } from "node:path";
import type { Hono } from "hono";
import type { LogSessionManager } from "./session-manager.js";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const UPLOAD_DIR_PREFIX = "ahp-inspector-upload-";

class BodyTooLargeError extends Error {}

/**
 * Read a request body incrementally, aborting as soon as it exceeds `maxBytes`
 * so an oversized (or chunked, no-Content-Length) upload cannot buffer fully in
 * memory before the size check runs.
 */
async function readBodyCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    let result: Awaited<ReturnType<typeof reader.read>>;
    try {
      result = await reader.read();
    } catch {
      reader.releaseLock();
      throw new Error("read-failed");
    }
    if (result.done) break;
    const value = result.value;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  reader.releaseLock();
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function sanitizeFilename(raw: string): string | null {
  // Strip any path separators and decode. Reject anything not ending .jsonl.
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const stripped = pathBasename(decoded);
  let base = "";
  for (let i = 0; i < stripped.length; i++) {
    const code = stripped.charCodeAt(i);
    if (code >= 0x20 && code !== 0x7f) base += stripped[i];
  }
  if (base.length === 0 || base.length > 255) return null;
  if (extname(base).toLowerCase() !== ".jsonl") return null;
  return base;
}

interface UploadStore {
  write(filename: string, bytes: Uint8Array): Promise<string>;
  cleanupAllExcept(keepPath: string | null): Promise<void>;
  disposeAll(): Promise<void>;
}

function createUploadStore(): UploadStore {
  const dirs = new Map<string, string>(); // tempFilePath -> tempDir

  async function write(filename: string, bytes: Uint8Array): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), UPLOAD_DIR_PREFIX));
    const filePath = join(dir, filename);
    try {
      await writeFile(filePath, bytes);
    } catch (error) {
      await rm(dir, { recursive: true, force: true });
      throw error;
    }
    dirs.set(filePath, dir);
    return filePath;
  }

  async function removeDir(dir: string): Promise<void> {
    await rm(dir, { recursive: true, force: true });
  }

  async function cleanupAllExcept(keepPath: string | null): Promise<void> {
    const tasks: Array<Promise<void>> = [];
    for (const [path, dir] of dirs) {
      if (path === keepPath) continue;
      tasks.push(
        removeDir(dir).then(() => {
          dirs.delete(path);
        }),
      );
    }
    await Promise.all(tasks);
  }

  async function disposeAll(): Promise<void> {
    await cleanupAllExcept(null);
  }

  return { write, cleanupAllExcept, disposeAll };
}

export interface UploadRoutesHandle {
  dispose(): Promise<void>;
}

export interface UploadRoutesOptions {
  /** Override the max upload size (bytes). Defaults to {@link MAX_UPLOAD_BYTES}. */
  readonly maxUploadBytes?: number;
}

export function registerUploadRoutes(
  app: Hono,
  sessions: LogSessionManager,
  opts?: UploadRoutesOptions,
): UploadRoutesHandle {
  const store = createUploadStore();
  const maxBytes = opts?.maxUploadBytes ?? MAX_UPLOAD_BYTES;
  const backgroundCleanups = new Set<Promise<void>>();
  const cleanupErrors: unknown[] = [];
  let disposePromise: Promise<void> | null = null;
  let activeRequests = 0;
  let resolveRequestDrain: (() => void) | null = null;

  const scheduleCleanup = (keepPath: string | null): void => {
    const cleanup = store.cleanupAllExcept(keepPath);
    backgroundCleanups.add(cleanup);
    void cleanup
      .catch((error: unknown) => {
        cleanupErrors.push(error);
      })
      .finally(() => {
        backgroundCleanups.delete(cleanup);
      });
  };

  // When the active session changes, drop any temp uploads that aren't the
  // current source. We don't know which path the manager opened from inside
  // here, so we just leave everything in place if active is non-null and
  // clean up on close. (The next upload also implicitly supersedes the prev.)
  const unsubscribe = sessions.onChange((active) => {
    if (active === null) {
      scheduleCleanup(null);
    }
  });

  app.post("/api/sessions/upload", async (c) => {
    if (disposePromise) {
      return c.json({ code: "unavailable", message: "unavailable" }, 503);
    }
    activeRequests++;
    try {
      const filenameHeader = c.req.header("x-filename");
      if (typeof filenameHeader !== "string" || filenameHeader.length === 0) {
        return c.json({ code: "bad-request", message: "missing X-Filename" }, 400);
      }
      const safeName = sanitizeFilename(filenameHeader);
      if (safeName === null) {
        return c.json({ code: "not-jsonl", message: "not-jsonl" }, 400);
      }

      const lengthHeader = c.req.header("content-length");
      const declaredLength = lengthHeader ? Number.parseInt(lengthHeader, 10) : Number.NaN;
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        return c.json({ code: "too-large", message: "too-large" }, 413);
      }

      let bytes: Uint8Array;
      try {
        bytes = await readBodyCapped(c.req.raw.body, maxBytes);
      } catch (err) {
        if (err instanceof BodyTooLargeError) {
          return c.json({ code: "too-large", message: "too-large" }, 413);
        }
        return c.json({ code: "bad-request", message: "could not read body" }, 400);
      }
      if (bytes.byteLength === 0) {
        return c.json({ code: "bad-request", message: "empty body" }, 400);
      }

      let tempPath: string;
      try {
        tempPath = await store.write(safeName, bytes);
      } catch {
        return c.json({ code: "io-error", message: "io-error" }, 500);
      }

      try {
        const active = await sessions.open({ path: tempPath });
        // Drop any previous uploaded temp dirs now that we have a new active.
        scheduleCleanup(tempPath);
        return c.json({ active: { logKey: active.logKey, meta: active.appState.meta } });
      } catch (err) {
        // Open failed — remove the temp file we just wrote.
        try {
          await store.cleanupAllExcept(null);
        } catch {
          return c.json({ code: "io-error", message: "io-error" }, 500);
        }
        const e = err as { code?: string };
        const code = typeof e.code === "string" ? e.code : "not-found";
        return c.json({ code, message: code }, 400);
      }
    } finally {
      activeRequests--;
      if (activeRequests === 0) {
        resolveRequestDrain?.();
        resolveRequestDrain = null;
      }
    }
  });

  return {
    dispose() {
      disposePromise ??= (async () => {
        unsubscribe();
        if (activeRequests > 0) {
          await new Promise<void>((resolve) => {
            resolveRequestDrain = resolve;
          });
        }
        await Promise.allSettled(backgroundCleanups);
        try {
          await store.disposeAll();
        } catch (error) {
          cleanupErrors.push(error);
        }
        if (cleanupErrors.length === 1) throw cleanupErrors[0];
        if (cleanupErrors.length > 1) {
          throw new AggregateError(cleanupErrors, "Failed to clean up uploaded logs");
        }
      })();
      return disposePromise;
    },
  };
}
