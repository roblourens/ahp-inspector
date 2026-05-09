import { describe, expect, it, vi } from "vitest";

interface RegisteredCommand {
  readonly id: string;
  readonly handler: (...args: unknown[]) => unknown;
}

interface FakePanel {
  webview: {
    html: string;
    cspSource: string;
    asWebviewUri: (u: { fsPath: string; toString: () => string }) => {
      toString: () => string;
    };
    postMessage: (m: unknown) => Promise<boolean>;
    onDidReceiveMessage: (cb: (m: unknown) => void) => { dispose: () => void };
  };
  onDidDispose: (cb: () => void) => { dispose: () => void };
  dispose(): void;
  _disposeListeners: Array<() => void>;
  _receiveListeners: Array<(m: unknown) => void>;
  _postedMessages: unknown[];
}

interface FakeVsCode {
  registered: RegisteredCommand[];
  panels: FakePanel[];
  setActiveDocument(doc: unknown): void;
  module: Record<string, unknown>;
}

function makeFakeVsCode(): FakeVsCode {
  const registered: RegisteredCommand[] = [];
  const panels: FakePanel[] = [];
  let activeDocument: unknown = null;

  const Uri = {
    joinPath(base: { fsPath: string }, ...segs: string[]): { fsPath: string; toString(): string } {
      const fsPath = [base.fsPath, ...segs].join("/");
      return { fsPath, toString: () => `file://${fsPath}` };
    },
    file(p: string): { fsPath: string; toString(): string } {
      return { fsPath: p, toString: () => `file://${p}` };
    },
  };

  function createPanel(): FakePanel {
    const disposeListeners: Array<() => void> = [];
    const receiveListeners: Array<(m: unknown) => void> = [];
    const postedMessages: unknown[] = [];
    const panel: FakePanel = {
      webview: {
        html: "",
        cspSource: "vscode-webview://test",
        asWebviewUri: (u) => ({ toString: () => `webview-uri:${u.fsPath}` }),
        async postMessage(m) {
          postedMessages.push(m);
          return true;
        },
        onDidReceiveMessage(cb) {
          receiveListeners.push(cb);
          return { dispose() {} };
        },
      },
      onDidDispose(cb) {
        disposeListeners.push(cb);
        return { dispose() {} };
      },
      dispose() {
        for (const l of disposeListeners) l();
      },
      _disposeListeners: disposeListeners,
      _receiveListeners: receiveListeners,
      _postedMessages: postedMessages,
    };
    return panel;
  }

  const fake: FakeVsCode = {
    registered,
    panels,
    setActiveDocument(doc) {
      activeDocument = doc;
    },
    module: {
      Uri,
      ViewColumn: { Active: -1 },
      commands: {
        registerCommand(id: string, handler: (...args: unknown[]) => unknown) {
          registered.push({ id, handler });
          return { dispose() {} };
        },
      },
      window: {
        get activeTextEditor() {
          return activeDocument ? { document: activeDocument } : undefined;
        },
        get visibleTextEditors() {
          return activeDocument ? [{ document: activeDocument }] : [];
        },
        createWebviewPanel() {
          const p = createPanel();
          panels.push(p);
          return p;
        },
      },
    },
  };
  return fake;
}

const fake = makeFakeVsCode();
vi.mock("vscode", () => fake.module);

const { activate, deactivate } = await import("./extension.js");

interface FakeContext {
  subscriptions: Array<{ dispose(): void }>;
  extensionUri: { fsPath: string; toString(): string };
}

function makeContext(): FakeContext {
  return {
    subscriptions: [],
    extensionUri: { fsPath: "/ext", toString: () => "file:///ext" },
  };
}

describe("ahp-inspector extension", () => {
  it("activate registers ahpInspector.open and deactivate is a no-op", () => {
    fake.registered.length = 0;
    const ctx = makeContext();
    activate(ctx as never);
    expect(fake.registered.map((c) => c.id)).toEqual(["ahpInspector.open"]);
    expect(ctx.subscriptions.length).toBeGreaterThan(0);
    expect(() => deactivate()).not.toThrow();
  });

  it("running the command creates a webview panel with HTML and posts initialLog", async () => {
    fake.registered.length = 0;
    fake.panels.length = 0;
    fake.setActiveDocument(null);
    activate(makeContext() as never);
    const cmd = fake.registered.find((c) => c.id === "ahpInspector.open");
    expect(cmd).toBeDefined();
    cmd?.handler();
    expect(fake.panels).toHaveLength(1);
    const panel = fake.panels[0];
    if (!panel) throw new Error("no panel");
    expect(panel.webview.html).toContain("Content-Security-Policy");
    expect(panel.webview.html).toContain("webview-uri:/ext/ui-dist/assets/main.js");
    // Wait a microtask for async postMessage scheduled by the bridge.
    await Promise.resolve();
    const initial = panel._postedMessages.find(
      (m): m is { kind: "initialLog"; path: string | null } =>
        typeof m === "object" && m !== null && (m as { kind?: unknown }).kind === "initialLog",
    );
    expect(initial).toBeDefined();
    expect(initial?.path).toBeNull();
  });

  it("disposing the panel disposes the bridge", () => {
    fake.registered.length = 0;
    fake.panels.length = 0;
    activate(makeContext() as never);
    fake.registered[0]?.handler();
    const panel = fake.panels[0];
    if (!panel) throw new Error("no panel");
    expect(() => panel.dispose()).not.toThrow();
  });
});
