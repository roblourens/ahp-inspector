// Owns the singleton LogServer for the extension's lifetime.
//
// Lazy-start on first openViewer; reuse handle on subsequent invocations;
// closed in deactivate(). Concurrent callers share the in-flight start
// promise so we never double-start.

import { join } from "node:path";
import { NodeHostAdapter, resolveCandidateId } from "@ahp-inspector/host-node";
import {
  createLogSessionManager,
  type LogServerHandle,
  type LogSessionManager,
  startLogServer,
} from "@ahp-inspector/server";
import type * as vscode from "vscode";

export interface ExtensionServerHandle {
  readonly server: LogServerHandle;
  readonly sessions: LogSessionManager;
}

let current: ExtensionServerHandle | null = null;
let starting: Promise<ExtensionServerHandle> | null = null;
let closing: Promise<void> | null = null;

function locateUiDist(context: vscode.ExtensionContext): string {
  return join(context.extensionUri.fsPath, "ui-dist");
}

function readVersion(context: vscode.ExtensionContext): string {
  const pkg = context.extension?.packageJSON as { version?: unknown } | undefined;
  return typeof pkg?.version === "string" ? pkg.version : "0.0.0";
}

export async function getOrStartLogServer(
  context: vscode.ExtensionContext,
): Promise<ExtensionServerHandle> {
  if (closing) await closing;
  if (current) return current;
  if (starting) return starting;
  const start = (async () => {
    const sessions = createLogSessionManager({
      host: new NodeHostAdapter(),
      resolveCandidateId,
    });
    try {
      const server = await startLogServer({
        sessions,
        port: 0,
        version: readVersion(context),
        uiDistDir: locateUiDist(context),
      });
      const handle = { server, sessions };
      current = handle;
      return handle;
    } catch (startError) {
      try {
        await sessions.dispose();
      } catch (disposeError) {
        throw new AggregateError(
          [startError, disposeError],
          "Failed to start and clean up AHP Inspector server",
        );
      }
      throw startError;
    }
  })();
  starting = start;
  try {
    return await start;
  } finally {
    if (starting === start) starting = null;
  }
}

export async function closeLogServerIfRunning(): Promise<void> {
  if (closing) return closing;
  const close = (async () => {
    const inFlightStart = starting;
    let handle = current;
    current = null;
    if (inFlightStart) {
      handle = await inFlightStart;
    }
    if (!handle) return;
    if (current === handle) current = null;

    const errors: unknown[] = [];
    try {
      await handle.server.close();
    } catch (error) {
      errors.push(error);
    }
    try {
      await handle.sessions.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, "Failed to close AHP Inspector server");
    }
  })();
  closing = close;
  try {
    await close;
  } finally {
    if (closing === close) closing = null;
  }
}

/** Test-only reset hook. Production code never calls this. */
export async function __resetForTest(): Promise<void> {
  await closeLogServerIfRunning();
}
