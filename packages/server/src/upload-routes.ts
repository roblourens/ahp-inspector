// upload-routes.ts — POST /api/sessions/upload
//
// Accepts a raw JSONL body when the browser cannot expose a real filesystem
// path (e.g. a Finder→Chrome drop on http://localhost, where dataTransfer
// only carries a `Files` entry with no `text/uri-list`). The bytes are
// written to a per-process temp directory and opened as a normal session.
// Tailing is harmless on a static temp file.
//
// Privacy: error responses never echo the uploaded filename or temp path.

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, basename as pathBasename } from "node:path";
import type { Hono } from "hono";
import type { LogSessionManager } from "./session-manager.js";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const UPLOAD_DIR_PREFIX = "ahp-inspector-upload-";

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
    const dir = join(
      tmpdir(),
      `${UPLOAD_DIR_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    );
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, filename);
    await writeFile(filePath, bytes);
    dirs.set(filePath, dir);
    return filePath;
  }

  async function removeDir(dir: string): Promise<void> {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }

  async function cleanupAllExcept(keepPath: string | null): Promise<void> {
    const tasks: Array<Promise<void>> = [];
    for (const [path, dir] of dirs) {
      if (path === keepPath) continue;
      dirs.delete(path);
      tasks.push(removeDir(dir));
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

export function registerUploadRoutes(app: Hono, sessions: LogSessionManager): UploadRoutesHandle {
  const store = createUploadStore();

  // When the active session changes, drop any temp uploads that aren't the
  // current source. We don't know which path the manager opened from inside
  // here, so we just leave everything in place if active is non-null and
  // clean up on close. (The next upload also implicitly supersedes the prev.)
  const unsubscribe = sessions.onChange((active) => {
    if (active === null) {
      void store.disposeAll();
    }
  });

  const exitCleanup = (): void => {
    void store.disposeAll();
  };
  process.once("exit", exitCleanup);

  app.post("/api/sessions/upload", async (c) => {
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
    if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
      return c.json({ code: "too-large", message: "too-large" }, 413);
    }

    let buf: ArrayBuffer;
    try {
      buf = await c.req.arrayBuffer();
    } catch {
      return c.json({ code: "bad-request", message: "could not read body" }, 400);
    }
    if (buf.byteLength === 0) {
      return c.json({ code: "bad-request", message: "empty body" }, 400);
    }
    if (buf.byteLength > MAX_UPLOAD_BYTES) {
      return c.json({ code: "too-large", message: "too-large" }, 413);
    }

    let tempPath: string;
    try {
      tempPath = await store.write(safeName, new Uint8Array(buf));
    } catch {
      return c.json({ code: "io-error", message: "io-error" }, 500);
    }

    try {
      const active = await sessions.open({ path: tempPath });
      // Drop any previous uploaded temp dirs now that we have a new active.
      void store.cleanupAllExcept(tempPath);
      return c.json({ active: { logKey: active.logKey, meta: active.appState.meta } });
    } catch (err) {
      // Open failed — remove the temp file we just wrote.
      void store.cleanupAllExcept(null);
      const e = err as { code?: string };
      const code = typeof e.code === "string" ? e.code : "not-found";
      return c.json({ code, message: code }, 400);
    }
  });

  return {
    async dispose() {
      unsubscribe();
      process.removeListener("exit", exitCleanup);
      await store.disposeAll();
    },
  };
}
