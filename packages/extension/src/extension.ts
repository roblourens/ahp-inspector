// VS Code AHP Log Viewer extension entry (Plan 11-01 Task 3).
//
// Phase 11 boundary:
//   - Registers the `ahpViewer.open` command (D-01, D-03).
//   - Opens a webview panel directly via `vscode.window.createWebviewPanel`
//     (no CustomEditorProvider — D-02).
//   - Loads bundled UI assets through `webview.asWebviewUri` under a
//     restrictive CSP (T-11-01-02).
//   - Detects the most recently active AHP JSONL log and forwards it to
//     the webview via `postMessage` (D-08, T-11-01-01 — webview only sees
//     basename, never the absolute fsPath; the bridge in Plan 11-03 owns
//     that mapping).
//
// Loopback HTTP server / browser open is intentionally NOT used here
// (T-11-01-03, EXT-04). Plan 11-03 wires the postMessage transport.

import * as vscode from "vscode";
import {
  type ActiveAhpLogCandidate,
  type ActiveLogTextDocument,
  type ActiveLogWindowState,
  detectActiveAhpLog,
} from "./activeLog.js";
import { ViewerSessionBridge } from "./viewerSession.js";
import { generateNonce, renderWebviewHtml } from "./webviewHtml.js";

const COMMAND_ID = "ahpViewer.open";
const VIEW_TYPE = "ahpViewer.panel";
const PANEL_TITLE = "AHP Log Viewer";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_ID, () => openViewer(context)),
  );
}

export function deactivate(): void {
  // Subscriptions are tracked on the ExtensionContext; nothing extra to do.
}

function openViewer(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const candidate = detectActiveAhpLog(snapshotWindowState());
  const panel = vscode.window.createWebviewPanel(VIEW_TYPE, PANEL_TITLE, vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "ui-dist")],
  });
  panel.webview.html = buildPanelHtml(panel.webview, context.extensionUri);

  const bridge = new ViewerSessionBridge({
    postMessage: (notification) => {
      void panel.webview.postMessage(notification);
    },
  });
  bridge.notifyInitialLog(candidate ? candidate.fsPath : null);
  if (candidate) void bridge.openInitialLogPath(candidate.fsPath);

  const sub = panel.webview.onDidReceiveMessage((message: unknown) => {
    void bridge.handle(message);
  });
  panel.onDidDispose(() => {
    sub.dispose();
    void bridge.dispose();
  });
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

function buildPanelHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const distRoot = vscode.Uri.joinPath(extensionUri, "ui-dist");
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distRoot, "assets", "main.js"));
  const stylesheetUri = webview.asWebviewUri(vscode.Uri.joinPath(distRoot, "assets", "main.css"));
  return renderWebviewHtml({
    scriptUri: scriptUri.toString(),
    stylesheetUri: stylesheetUri.toString(),
    nonce: generateNonce(),
    cspSource: webview.cspSource,
  });
}

// Re-exports kept silent to avoid unused-symbol warnings in the bundle entrypoint.
export type { ActiveAhpLogCandidate };
