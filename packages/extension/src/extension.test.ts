import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface RegisteredCommand {
	readonly id: string;
	readonly handler: (...args: unknown[]) => unknown;
}

interface FakePanel {
	webview: {
		html: string;
		cspSource: string;
		asWebviewUri: (u: { fsPath: string; toString: () => string }) => { toString: () => string };
		postMessage: (m: unknown) => Promise<boolean>;
		onDidReceiveMessage: (cb: (m: unknown) => void) => { dispose: () => void };
	};
	onDidDispose: (cb: () => void) => { dispose: () => void };
	dispose(): void;
	_disposeListeners: Array<() => void>;
	_createOpts: unknown;
}

interface FakeVsCode {
	registered: RegisteredCommand[];
	panels: FakePanel[];
	createCalls: Array<{ viewType: string; title: string; column: unknown; opts: unknown }>;
	setActiveDocument(doc: unknown): void;
	module: Record<string, unknown>;
}

function makeFakeVsCode(): FakeVsCode {
	const registered: RegisteredCommand[] = [];
	const panels: FakePanel[] = [];
	const createCalls: FakeVsCode["createCalls"] = [];
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

	function createPanel(opts: unknown): FakePanel {
		const disposeListeners: Array<() => void> = [];
		const panel: FakePanel = {
			webview: {
				html: "",
				cspSource: "vscode-webview://test",
				asWebviewUri: (u) => ({ toString: () => `webview-uri:${u.fsPath}` }),
				async postMessage() {
					return true;
				},
				onDidReceiveMessage() {
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
			_createOpts: opts,
		};
		return panel;
	}

	const fake: FakeVsCode = {
		registered,
		panels,
		createCalls,
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
				createWebviewPanel(viewType: string, title: string, column: unknown, opts: unknown) {
					createCalls.push({ viewType, title, column, opts });
					const p = createPanel(opts);
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

const fakeServer = { port: 51234, close: vi.fn().mockResolvedValue(undefined) };
const fakeSessions = { open: vi.fn().mockResolvedValue(undefined) };
const getOrStartSpy = vi.fn().mockResolvedValue({ server: fakeServer, sessions: fakeSessions });
const closeSpy = vi.fn().mockResolvedValue(undefined);

vi.mock("./extensionServer.js", () => ({
	getOrStartLogServer: (ctx: unknown) => getOrStartSpy(ctx),
	closeLogServerIfRunning: () => closeSpy(),
}));

const { activate, deactivate, openViewer } = await import("./extension.js");

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

beforeEach(() => {
	fake.registered.length = 0;
	fake.panels.length = 0;
	fake.createCalls.length = 0;
	fake.setActiveDocument(null);
	getOrStartSpy.mockClear();
	closeSpy.mockClear();
	fakeSessions.open.mockClear();
});

afterEach(() => {
	fake.setActiveDocument(null);
});

describe("ahp-inspector extension (Phase 15 server-in-extension)", () => {
	it("activate registers ahpInspector.open", () => {
		const ctx = makeContext();
		activate(ctx as never);
		expect(fake.registered.map((c) => c.id)).toEqual(["ahpInspector.open"]);
		expect(ctx.subscriptions.length).toBe(1);
	});

	it("openViewer creates a panel with portMapping carrying the bound port", async () => {
		await openViewer(makeContext() as never);
		expect(fake.createCalls).toHaveLength(1);
		const opts = fake.createCalls[0]?.opts as {
			portMapping?: Array<{ webviewPort: number; extensionHostPort: number }>;
			enableScripts?: boolean;
			retainContextWhenHidden?: boolean;
		};
		expect(opts.enableScripts).toBe(true);
		expect(opts.retainContextWhenHidden).toBe(true);
		expect(opts.portMapping).toEqual([{ webviewPort: 51234, extensionHostPort: 51234 }]);
	});

	it("webview HTML carries the loopback origin in CSP and the apiBase script", async () => {
		await openViewer(makeContext() as never);
		const html = fake.panels[0]?.webview.html ?? "";
		expect(html).toContain("Content-Security-Policy");
		expect(html).toContain("http://localhost:51234");
		expect(html).toContain('window.__AHP_API_BASE__ = "http://localhost:51234"');
	});

	it("seeds the active session via sessions.open before creating the panel", async () => {
		fake.setActiveDocument({
			uri: { scheme: "file", fsPath: "/abs/log.jsonl" },
			isUntitled: false,
			languageId: "jsonl",
		});
		await openViewer(makeContext() as never);
		expect(fakeSessions.open).toHaveBeenCalledWith({ path: "/abs/log.jsonl" });
	});

	it("does not call sessions.open when no AHP log is active", async () => {
		await openViewer(makeContext() as never);
		expect(fakeSessions.open).not.toHaveBeenCalled();
	});

	it("server is shared across two openViewer calls (singleton)", async () => {
		const ctx = makeContext();
		await openViewer(ctx as never);
		await openViewer(ctx as never);
		// getOrStartLogServer is called twice, but it returns the same handle each time.
		expect(getOrStartSpy).toHaveBeenCalledTimes(2);
		expect(fake.panels).toHaveLength(2);
		const first = fake.createCalls[0]?.opts as {
			portMapping: Array<{ webviewPort: number; extensionHostPort: number }>;
		};
		const second = fake.createCalls[1]?.opts as {
			portMapping: Array<{ webviewPort: number; extensionHostPort: number }>;
		};
		expect(first.portMapping[0]?.webviewPort).toBe(51234);
		expect(second.portMapping[0]?.webviewPort).toBe(51234);
	});

	it("activate command handler invokes openViewer", async () => {
		const ctx = makeContext();
		activate(ctx as never);
		const cmd = fake.registered[0];
		expect(cmd?.id).toBe("ahpInspector.open");
		cmd?.handler();
		// Handler is fire-and-forget; await microtasks for the async path.
		await Promise.resolve();
		await Promise.resolve();
		expect(getOrStartSpy).toHaveBeenCalledTimes(1);
	});

	it("deactivate closes the server", async () => {
		await deactivate();
		expect(closeSpy).toHaveBeenCalledTimes(1);
	});
});
