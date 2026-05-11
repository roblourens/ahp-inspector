import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiUrl } from "./api-base.js";

describe("apiUrl", () => {
	beforeEach(() => {
		delete (window as Window & { __AHP_API_BASE__?: string }).__AHP_API_BASE__;
	});
	afterEach(() => {
		delete (window as Window & { __AHP_API_BASE__?: string }).__AHP_API_BASE__;
	});

	it("returns path unchanged when window.__AHP_API_BASE__ is unset", () => {
		expect(apiUrl("/api/x")).toBe("/api/x");
	});

	it("prefixes path when window.__AHP_API_BASE__ is set", () => {
		(window as Window).__AHP_API_BASE__ = "http://localhost:51234";
		expect(apiUrl("/api/x")).toBe("http://localhost:51234/api/x");
	});

	it("strips a trailing slash on the base so paths are not double-slashed", () => {
		(window as Window).__AHP_API_BASE__ = "http://localhost:51234/";
		expect(apiUrl("/api/x")).toBe("http://localhost:51234/api/x");
	});

	it("prefixes the SSE stream path correctly", () => {
		(window as Window).__AHP_API_BASE__ = "http://localhost:51234";
		expect(apiUrl("/api/log/stream")).toBe("http://localhost:51234/api/log/stream");
	});
});
