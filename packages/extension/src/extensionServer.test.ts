import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startLogServerSpy = vi.fn();
const createSessionsSpy = vi.fn();
const fakeServer = {
	url: "http://127.0.0.1:51234",
	port: 51234,
	server: {} as never,
	close: vi.fn().mockResolvedValue(undefined),
};
const fakeSessions = { open: vi.fn(), close: vi.fn(), dispose: vi.fn() };

vi.mock("@ahp-inspector/server", () => ({
	startLogServer: (opts: unknown) => {
		startLogServerSpy(opts);
		return Promise.resolve(fakeServer);
	},
	createLogSessionManager: (opts: unknown) => {
		createSessionsSpy(opts);
		return fakeSessions;
	},
}));

vi.mock("@ahp-inspector/host-node", () => ({
	NodeHostAdapter: class {},
	resolveCandidateId: (id: string) => id,
}));

vi.mock("vscode", () => ({}));

const { getOrStartLogServer, closeLogServerIfRunning, __resetForTest } = await import(
	"./extensionServer.js"
);

interface FakeContext {
	extensionUri: { fsPath: string };
	extension?: { packageJSON?: { version?: string } };
}

function makeContext(): FakeContext {
	return {
		extensionUri: { fsPath: "/abs/extroot" },
		extension: { packageJSON: { version: "1.2.3" } },
	};
}

beforeEach(() => {
	startLogServerSpy.mockClear();
	createSessionsSpy.mockClear();
	fakeServer.close.mockClear();
	__resetForTest();
});

afterEach(() => {
	__resetForTest();
});

describe("extensionServer", () => {
	it("lazy-starts the server on first call", async () => {
		const handle = await getOrStartLogServer(makeContext() as never);
		expect(startLogServerSpy).toHaveBeenCalledTimes(1);
		expect(handle.server).toBe(fakeServer);
		expect(handle.sessions).toBe(fakeSessions);
	});

	it("reuses the singleton across sequential calls", async () => {
		const ctx = makeContext();
		const a = await getOrStartLogServer(ctx as never);
		const b = await getOrStartLogServer(ctx as never);
		expect(a).toBe(b);
		expect(startLogServerSpy).toHaveBeenCalledTimes(1);
	});

	it("dedupes concurrent starts", async () => {
		const ctx = makeContext();
		const [a, b] = await Promise.all([
			getOrStartLogServer(ctx as never),
			getOrStartLogServer(ctx as never),
		]);
		expect(a).toBe(b);
		expect(startLogServerSpy).toHaveBeenCalledTimes(1);
	});

	it("closeLogServerIfRunning closes once and is idempotent", async () => {
		await getOrStartLogServer(makeContext() as never);
		await closeLogServerIfRunning();
		await closeLogServerIfRunning();
		expect(fakeServer.close).toHaveBeenCalledTimes(1);
	});

	it("restart after close starts a fresh server", async () => {
		const ctx = makeContext();
		await getOrStartLogServer(ctx as never);
		await closeLogServerIfRunning();
		await getOrStartLogServer(ctx as never);
		expect(startLogServerSpy).toHaveBeenCalledTimes(2);
	});

	it("passes version + uiDistDir derived from context", async () => {
		await getOrStartLogServer(makeContext() as never);
		expect(startLogServerSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				port: 0,
				version: "1.2.3",
				uiDistDir: "/abs/extroot/ui-dist",
				sessions: fakeSessions,
			}),
		);
	});
});
