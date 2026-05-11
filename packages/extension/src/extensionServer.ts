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
import * as vscode from "vscode";

export interface ExtensionServerHandle {
	readonly server: LogServerHandle;
	readonly sessions: LogSessionManager;
}

let current: ExtensionServerHandle | null = null;
let starting: Promise<ExtensionServerHandle> | null = null;

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
	if (current) return current;
	if (starting) return starting;
	starting = (async () => {
		const sessions = createLogSessionManager({
			host: new NodeHostAdapter(),
			resolveCandidateId,
		});
		const server = await startLogServer({
			sessions,
			port: 0,
			version: readVersion(context),
			uiDistDir: locateUiDist(context),
		});
		current = { server, sessions };
		return current;
	})();
	try {
		return await starting;
	} finally {
		starting = null;
	}
}

export async function closeLogServerIfRunning(): Promise<void> {
	const handle = current;
	current = null;
	starting = null;
	if (handle) {
		await handle.server.close();
	}
}

/** Test-only reset hook. Production code never calls this. */
export function __resetForTest(): void {
	current = null;
	starting = null;
}
