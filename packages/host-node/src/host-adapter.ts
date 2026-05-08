// NodeHostAdapter — Node implementation of the shared HostAdapter contract.
// RESEARCH Pattern 6 (lines 362-407), Pitfall 7 (lines 468-470), Security
// Domain / Path traversal (line 779).
//
// Locked decision: viewer reads user-chosen paths anywhere on disk; no chroot.
// Defensive: error messages only echo the basename of the resolved path,
// never the parent directory (T-03-03).

import { accessSync, constants, statSync } from "node:fs";
import { basename, resolve as pathResolve } from "node:path";
import type { DiscoveryResult, Disposable, HostAdapter, LogHandle } from "@ahp-viewer/shared";
import { discoverVsCodeLogs } from "./discovery.js";
import { TailReader } from "./tail-reader.js";

/** Node-side LogHandle extension — adds the resolved path + observed size. */
export interface NodeLogHandle extends LogHandle {
  readonly path: string;
  readonly size: number;
}

export class NodeHostAdapter implements HostAdapter {
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

  watchLog(handle: LogHandle, onChunk: (bytes: Uint8Array) => void): Disposable {
    const node = handle as NodeLogHandle;
    if (typeof node.path !== "string") {
      throw new Error("watchLog: handle missing path (must be a NodeLogHandle)");
    }
    const reader = new TailReader(node.path);
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      reader.dispose();
    };
    void reader
      .readInitial(onChunk)
      .then(() => {
        if (!stopped) reader.startWatch(onChunk);
      })
      .catch(() => {
        // Initial read failure — best-effort: leave reader disposed.
        stop();
      });
    return { dispose: stop };
  }

  async close(_handle: LogHandle): Promise<void> {
    // No-op: each watchLog call returns its own Disposable that owns the watcher.
  }
}
