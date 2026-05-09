import { describe, expect, it } from "vitest";
import {
  type ActiveLogTextDocument,
  type ActiveLogWindowState,
  detectActiveAhpLog,
} from "./activeLog.js";

function fileDoc(
  fsPath: string,
  overrides: Partial<ActiveLogTextDocument> = {},
): ActiveLogTextDocument {
  return {
    uriScheme: "file",
    fsPath,
    isUntitled: false,
    languageId: "jsonl",
    ...overrides,
  };
}

function state(
  active: ActiveLogTextDocument | null,
  visible: ActiveLogTextDocument[] = [],
): ActiveLogWindowState {
  return {
    activeDocument: active,
    visibleEditors: visible.map((document) => ({ document })),
  };
}

describe("detectActiveAhpLog", () => {
  it("returns the active editor path when it is a .jsonl file", () => {
    const result = detectActiveAhpLog(state(fileDoc("/logs/run.jsonl")));
    expect(result).toEqual({ fsPath: "/logs/run.jsonl", source: "active-editor" });
  });

  it("returns null for untitled, non-file, or non-log documents", () => {
    expect(detectActiveAhpLog(state(fileDoc("", { isUntitled: true })))).toBeNull();
    expect(
      detectActiveAhpLog(state(fileDoc("/tmp/scratch.txt", { languageId: "plaintext" }))),
    ).toBeNull();
    expect(
      detectActiveAhpLog(
        state(fileDoc("/tmp/run.jsonl", { uriScheme: "untitled", isUntitled: true })),
      ),
    ).toBeNull();
    expect(detectActiveAhpLog(state(null))).toBeNull();
  });

  it("falls back to a recently visible .jsonl editor when active is not log-like", () => {
    const result = detectActiveAhpLog(
      state(fileDoc("/tmp/notes.md", { languageId: "markdown" }), [
        fileDoc("/logs/agent-host.jsonl"),
      ]),
    );
    expect(result).toEqual({
      fsPath: "/logs/agent-host.jsonl",
      source: "recent-visible-editor",
    });
  });

  it("matches AHP-named files even without a .jsonl extension", () => {
    const result = detectActiveAhpLog(
      state(fileDoc("/logs/agent-host.log", { languageId: "log" })),
    );
    expect(result).toEqual({ fsPath: "/logs/agent-host.log", source: "active-editor" });
  });
});
