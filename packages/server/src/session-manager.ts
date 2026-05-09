// LogSessionManager — owns the single active log lifecycle for the server.
// Phase 04-03: switchable AppState; serialized open/close; logKey derived
// from mtimeMs at open time (D-16); listeners get notified on every state
// change so /api/log/stream can emit log-reset and bye cleanly.

import { stat as fsStat } from "node:fs/promises";
import { resolve as pathResolve } from "node:path";
import type { Direction, HostAdapter } from "@ahp-inspector/shared";
import { type AppState, type AppStateOptions, createAppState } from "./app-state.js";
import { computeLogKey } from "./log-key.js";

export interface ActiveSession {
  readonly logKey: string;
  readonly appState: AppState;
}

export interface LogSessionManager {
  current(): ActiveSession | null;
  open(input: { path: string } | { id: string }): Promise<ActiveSession>;
  close(): Promise<void>;
  /** Subscribe; emits null on close, ActiveSession on open/switch. */
  onChange(listener: (active: ActiveSession | null) => void): () => void;
  /** Test/disposal — closes any active log + clears listeners. */
  dispose(): Promise<void>;
}

export interface CreateLogSessionManagerOpts {
  readonly host: HostAdapter;
  readonly directionInference?: (raw: unknown) => Direction;
  readonly resolveCandidateId: (id: string) => string | null;
}

export type SessionOpenErrorCode =
  | "bad-request"
  | "not-found"
  | "not-a-file"
  | "not-readable"
  | "path-too-long";

export class SessionOpenError extends Error {
  readonly code: SessionOpenErrorCode;
  constructor(code: SessionOpenErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "SessionOpenError";
  }
}

const MAX_PATH_LEN = 4096;

export function createLogSessionManager(opts: CreateLogSessionManagerOpts): LogSessionManager {
  let active: ActiveSession | null = null;
  const listeners = new Set<(a: ActiveSession | null) => void>();
  let chain: Promise<unknown> = Promise.resolve();

  function notify(a: ActiveSession | null): void {
    for (const l of listeners) {
      try {
        l(a);
      } catch {
        /* never let one listener block */
      }
    }
  }

  async function disposeCurrent(): Promise<void> {
    if (!active) return;
    const cur = active;
    active = null;
    try {
      await cur.appState.dispose();
    } catch {
      /* ignore */
    }
  }

  function classifyHostErr(err: Error): SessionOpenError {
    const m = err.message;
    if (/cannot stat/i.test(m)) return new SessionOpenError("not-found", m);
    if (/not a regular file/i.test(m)) return new SessionOpenError("not-a-file", m);
    if (/not readable/i.test(m)) return new SessionOpenError("not-readable", m);
    return new SessionOpenError("not-found", m);
  }

  async function doOpen(rawPath: string): Promise<ActiveSession> {
    if (rawPath.length > MAX_PATH_LEN) {
      throw new SessionOpenError("path-too-long", `path exceeds ${MAX_PATH_LEN} chars`);
    }
    const absPath = pathResolve(rawPath);
    let initialMtimeMs: number;
    try {
      initialMtimeMs = (await fsStat(absPath)).mtimeMs;
    } catch (err) {
      throw new SessionOpenError("not-found", (err as Error).message);
    }
    await disposeCurrent();
    const stateOpts: AppStateOptions = {
      host: opts.host,
      file: absPath,
      logKey: computeLogKey(absPath, initialMtimeMs),
      initialMtimeMs,
      ...(opts.directionInference ? { directionInference: opts.directionInference } : {}),
    };
    let appState: AppState;
    try {
      appState = await createAppState(stateOpts);
    } catch (err) {
      throw classifyHostErr(err as Error);
    }
    active = { logKey: appState.meta.logKey, appState };
    notify(active);
    return active;
  }

  return {
    current: () => active,
    async open(input) {
      const next = chain.then(async () => {
        if ("path" in input) return doOpen(input.path);
        const abs = opts.resolveCandidateId(input.id);
        if (!abs) throw new SessionOpenError("not-found", "unknown candidate id");
        return doOpen(abs);
      });
      chain = next.catch(() => undefined);
      return next as Promise<ActiveSession>;
    },
    async close() {
      const next = chain.then(async () => {
        await disposeCurrent();
        notify(null);
      });
      chain = next.catch(() => undefined);
      await next;
    },
    onChange(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    async dispose() {
      await disposeCurrent();
      listeners.clear();
    },
  };
}
