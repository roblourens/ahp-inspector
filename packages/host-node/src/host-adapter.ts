// NodeHostAdapter — Node implementation of the shared HostAdapter contract.
// RESEARCH Pattern 6 (lines 362-407), Pitfall 7 (lines 468-470), Security
// Domain / Path traversal (line 779).
//
// Locked decision: viewer reads user-chosen paths anywhere on disk; no chroot.
// Defensive: error messages only echo the basename of the resolved path,
// never the parent directory (T-03-03).

import { accessSync, constants, statSync } from "node:fs";
import { basename, resolve as pathResolve } from "node:path";
import type { DiscoveryResult, Disposable, HostAdapter, LogHandle } from "@ahp-inspector/shared";
import { discoverVsCodeLogs } from "./discovery.js";
import {
  type ChunkSink,
  chunkSinkToWatchSink,
  TailReader,
  TailReaderError,
  type WatchSink,
} from "./tail-reader.js";

/** Node-side LogHandle extension — adds the resolved path + observed size. */
export interface NodeLogHandle extends LogHandle {
  readonly path: string;
  readonly size: number;
}

interface ReaderRegistration {
  readonly reader: TailReader;
  shutdown: Promise<void> | null;
}

interface ReaderGroup {
  readonly registrations: Set<ReaderRegistration>;
  closePromise: Promise<void> | null;
}

function isNodeLogHandle(handle: LogHandle): handle is NodeLogHandle {
  return "path" in handle && typeof handle.path === "string";
}

export class NodeHostAdapter implements HostAdapter {
  readonly #readers = new WeakMap<LogHandle, ReaderGroup>();

  async discoverLogs(): Promise<DiscoveryResult> {
    return discoverVsCodeLogs();
  }

  async openLog(path: string): Promise<NodeLogHandle> {
    const resolved = pathResolve(process.cwd(), path);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(resolved);
    } catch {
      throw new Error(`openLog: cannot stat '${basename(resolved)}'`);
    }
    if (!stat.isFile()) {
      throw new Error(`openLog: '${basename(resolved)}' is not a regular file`);
    }
    try {
      accessSync(resolved, constants.R_OK);
    } catch {
      throw new Error(`openLog: '${basename(resolved)}' is not readable`);
    }
    return { id: resolved, path: resolved, size: stat.size };
  }

  watchLog(handle: LogHandle, sinkOrChunk: WatchSink | ChunkSink): Disposable {
    if (!isNodeLogHandle(handle)) {
      throw new Error("watchLog: handle missing path (must be a NodeLogHandle)");
    }
    const sink: WatchSink =
      typeof sinkOrChunk === "function" ? chunkSinkToWatchSink(sinkOrChunk) : sinkOrChunk;
    const reader = new TailReader(handle.path);
    const registration: ReaderRegistration = { reader, shutdown: null };
    let group = this.#readers.get(handle);
    if (!group || group.closePromise) {
      group = { registrations: new Set(), closePromise: null };
      this.#readers.set(handle, group);
    }
    group.registrations.add(registration);

    let stopped = false;
    const stop = (): void => {
      if (stopped) return;
      stopped = true;
      registration.shutdown = reader.dispose();
      // The rejection remains observable through close(handle), which awaits
      // every registered reader shutdown.
      void registration.shutdown.catch(() => undefined);
    };
    reader.startWatch(sink);
    void reader.readInitial(sink).catch((err) => {
      sink.onError(
        err instanceof Error ? err : new TailReaderError("reader-callback-failed", err),
        true,
      );
    });
    return { dispose: stop };
  }

  close(handle: LogHandle): Promise<void> {
    if (!isNodeLogHandle(handle)) return Promise.resolve();
    const group = this.#readers.get(handle);
    if (!group) return Promise.resolve();
    if (group.closePromise) return group.closePromise;

    group.closePromise = (async () => {
      const shutdowns: Promise<void>[] = [];
      for (const registration of group.registrations) {
        if (!registration.shutdown) registration.shutdown = registration.reader.dispose();
        shutdowns.push(registration.shutdown);
      }
      const results = await Promise.allSettled(shutdowns);
      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason);
      if (failures.length > 0) {
        throw new AggregateError(failures, "One or more log readers failed to shut down.");
      }
    })().finally(() => {
      if (this.#readers.get(handle) === group) this.#readers.delete(handle);
    });
    return group.closePromise;
  }
}
