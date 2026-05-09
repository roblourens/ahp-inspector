// Active AHP log detection (Plan 11-01 Task 2).
//
// Pure helper: takes a small abstract window-state object instead of the
// `vscode` API surface so tests don't need a VS Code stub. The extension
// activate() builds an `ActiveLogWindowState` from real `vscode.window`
// state and feeds it through this function.
//
// T-11-01-01: this returns a filesystem path; the extension host caller is
// responsible for never forwarding the absolute path into webview-visible
// metadata (basename/logKey-only crosses that boundary).

export interface ActiveLogTextDocument {
  /** vscode.Uri.scheme — only "file" yields a candidate. */
  readonly uriScheme: string;
  /** Filesystem path. Empty string for non-file URIs. */
  readonly fsPath: string;
  /** True for unsaved/untitled documents. */
  readonly isUntitled: boolean;
  /** vscode.TextDocument.languageId. */
  readonly languageId: string;
}

export interface ActiveLogVisibleEditor {
  readonly document: ActiveLogTextDocument;
}

export interface ActiveLogWindowState {
  readonly activeDocument: ActiveLogTextDocument | null;
  readonly visibleEditors: readonly ActiveLogVisibleEditor[];
}

export interface ActiveAhpLogCandidate {
  readonly fsPath: string;
  readonly source: "active-editor" | "recent-visible-editor";
}

const JSONL_RE = /\.jsonl$/i;
const AHP_HINT_RE = /(ahp|agent[-_]?host)/i;

function isLogLike(doc: ActiveLogTextDocument | null): doc is ActiveLogTextDocument {
  if (!doc) return false;
  if (doc.isUntitled) return false;
  if (doc.uriScheme !== "file") return false;
  if (!doc.fsPath) return false;
  if (JSONL_RE.test(doc.fsPath)) return true;
  // Allow AHP-named files even without `.jsonl` (e.g. `agent-host.log`).
  return doc.languageId === "jsonl" || AHP_HINT_RE.test(doc.fsPath);
}

export function detectActiveAhpLog(state: ActiveLogWindowState): ActiveAhpLogCandidate | null {
  if (isLogLike(state.activeDocument)) {
    return { fsPath: state.activeDocument.fsPath, source: "active-editor" };
  }
  for (const editor of state.visibleEditors) {
    if (isLogLike(editor.document)) {
      return { fsPath: editor.document.fsPath, source: "recent-visible-editor" };
    }
  }
  return null;
}
