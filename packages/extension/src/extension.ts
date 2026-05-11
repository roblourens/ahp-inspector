// VS Code AHP Inspector extension entry — Phase 15 rewrite.
//
// Singleton LogServer (the same Hono server the standalone CLI uses), lazy-
// started on first openViewer call and closed in deactivate(). The webview
// reaches it via WebviewOptions.portMapping; the UI bundle reads
// window.__AHP_API_BASE__ to prefix its /api/* requests.

import * as vscode from "vscode";
import {
	type ActiveAhpLogCandidate,
	type ActiveLogTextDocument,
	type ActiveLogWindowState,
	detectActiveAhpLog,
} from "./activeLog.js";
import { closeLogServerIfRunning, getOrStartLogServer } from "./extensionServer.js";
import { generateNonce, renderWebviewHtml } from "./webviewHtml.js";

const COMMAND_ID = "ahpInspector.open";
const VIEW_TYPE = "ahpInspector.panel";
const PANEL_TITLE = "AHP Inspector";

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_ID, () => {
			void openViewer(context);
		}),
	);
}

export async function deactivate(): Promise<void> {
	await closeLogServerIfRunning();
}

export async function openViewer(
	context: vscode.ExtensionContext,
): Promise<vscode.WebviewPanel> {
	const { server, sessions } = await getOrStartLogServer(context);
	const candidate = detectActiveAhpLog(snapshotWindowState());
	if (candidate) {
		// Seed the active session before the webview probes /api/log/meta.
		await sessions.open({ path: candidate.fsPath }).catch(() => undefined);
	}
	const panel = vscode.window.createWebviewPanel(
		VIEW_TYPE,
		PANEL_TITLE,
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "ui-dist")],
			portMapping: [{ webviewPort: server.port, extensionHostPort: server.port }],
		},
	);
	panel.webview.html = buildPanelHtml(panel.webview, context.extensionUri, server.port);
	return panel;
}

function snapshotWindowState(): ActiveLogWindowState {
	const active = vscode.window.activeTextEditor;
	return {
		activeDocument: active ? toDoc(active.document) : null,
		visibleEditors: vscode.window.visibleTextEditors.map((e) => ({ document: toDoc(e.document) })),
	};
}

function toDoc(doc: vscode.TextDocument): ActiveLogTextDocument {
	return {
		uriScheme: doc.uri.scheme,
		fsPath: doc.uri.scheme === "file" ? doc.uri.fsPath : "",
		isUntitled: doc.isUntitled,
		languageId: doc.languageId,
	};
}

function buildPanelHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	port: number,
): string {
	const distRoot = vscode.Uri.joinPath(extensionUri, "ui-dist");
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distRoot, "assets", "main.js"));
	const stylesheetUri = webview.asWebviewUri(vscode.Uri.joinPath(distRoot, "assets", "main.css"));
	const loopback = `http://localhost:${port}`;
	return renderWebviewHtml({
		scriptUri: scriptUri.toString(),
		stylesheetUri: stylesheetUri.toString(),
		nonce: generateNonce(),
		cspSource: webview.cspSource,
		loopbackOrigin: loopback,
		apiBaseUrl: loopback,
	});
}

export type { ActiveAhpLogCandidate };
